// TODO: Import LGraph from its future module
// TODO: Import LGraphNode from its future module
// TODO: Import LGraphGroup from its future module

import type { Vector2, Vector4 } from "../types/core-types";
import { DragAndScale } from "./DragAndScale";
import { LGraphCanvas as LGraphCanvasStatic } from "./LGraphCanvas.static";

type CanvasPointerListener = (event: Event) => unknown;

interface LGraphCanvasLifecycleHost {
    NODE_TEXT_SIZE: number;
    NODE_SUBTEXT_SIZE: number;
    NODE_TITLE_COLOR: string;
    LINK_COLOR: string;
    SPLINE_LINK: number;
    pointerevents_method: "mouse" | "pointer" | "touch" | string;
    isTouchDevice: () => boolean;
    pointerListenerAdd: (
        dom: EventTarget,
        eventName: string,
        callback: CanvasPointerListener,
        capture?: boolean
    ) => void;
    pointerListenerRemove: (
        dom: EventTarget,
        eventName: string,
        callback: CanvasPointerListener,
        capture?: boolean
    ) => void;
}

interface LGraphCanvasOptions {
    skip_render?: boolean;
    skip_events?: boolean;
    autoresize?: boolean;
    viewport?: Vector4 | null;
}

interface GraphLike {
    _subgraph_node?: unknown;
    attachCanvas: (canvas: unknown) => void;
    detachCanvas: (canvas: unknown) => void;
}

interface CanvasLike extends HTMLCanvasElement {
    data?: unknown;
    webgl_enabled?: boolean;
}

interface MouseLikeEvent extends MouseEvent {
    canvasx?: number;
    canvasy?: number;
    dragging?: boolean;
    wheel?: number;
    eventType?: string;
    delta?: number;
}

const pointerEventNameMaps: Record<string, Record<string, string>> = {
    mouse: {
        down: "mousedown",
        move: "mousemove",
        up: "mouseup",
        cancel: "mouseup",
        gotpointercapture: "mousedown",
        lostpointercapture: "mouseup",
    },
    pointer: {
        down: "pointerdown",
        move: "pointermove",
        up: "pointerup",
        cancel: "pointercancel",
        gotpointercapture: "gotpointercapture",
        lostpointercapture: "lostpointercapture",
    },
    touch: {
        down: "touchstart",
        move: "touchmove",
        up: "touchend",
        cancel: "touchcancel",
        gotpointercapture: "touchstart",
        lostpointercapture: "touchend",
    },
};

function resolvePointerEventName(
    method: string,
    semanticName: string
): string | null {
    const requested = String(semanticName || "").toLowerCase();
    if (
        requested.startsWith("mouse") ||
        requested.startsWith("pointer") ||
        requested.startsWith("touch")
    ) {
        return requested;
    }
    const group = pointerEventNameMaps[method] || pointerEventNameMaps.mouse;
    return group[requested] || null;
}

function defaultPointerListenerAdd(
    method: string,
    dom: EventTarget,
    eventName: string,
    callback: CanvasPointerListener,
    capture = false
): void {
    if (!("addEventListener" in dom)) {
        return;
    }
    const resolved = resolvePointerEventName(method, eventName);
    if (!resolved) {
        return;
    }
    (dom as EventTarget & { addEventListener: EventTarget["addEventListener"] }).addEventListener(
        resolved,
        callback as EventListener,
        resolved.startsWith("touch")
            ? ({ capture: !!capture, passive: false } as AddEventListenerOptions)
            : !!capture
    );
}

function defaultPointerListenerRemove(
    method: string,
    dom: EventTarget,
    eventName: string,
    callback: CanvasPointerListener,
    capture = false
): void {
    if (!("removeEventListener" in dom)) {
        return;
    }
    const resolved = resolvePointerEventName(method, eventName);
    if (!resolved) {
        return;
    }
    (dom as EventTarget & { removeEventListener: EventTarget["removeEventListener"] }).removeEventListener(
        resolved,
        callback as EventListener,
        resolved.startsWith("touch")
            ? ({ capture: !!capture, passive: false } as AddEventListenerOptions)
            : !!capture
    );
}

const defaultLifecycleHost: LGraphCanvasLifecycleHost = {
    NODE_TEXT_SIZE: 14,
    NODE_SUBTEXT_SIZE: 12,
    NODE_TITLE_COLOR: "#999",
    LINK_COLOR: "#9A9",
    SPLINE_LINK: 2,
    pointerevents_method: "mouse",
    isTouchDevice: () =>
        typeof window !== "undefined" &&
        (("ontouchstart" in window) ||
            (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)),
    pointerListenerAdd: (
        dom: EventTarget,
        eventName: string,
        callback: CanvasPointerListener,
        capture?: boolean
    ) => {
        defaultPointerListenerAdd(
            defaultLifecycleHost.pointerevents_method,
            dom,
            eventName,
            callback,
            capture
        );
    },
    pointerListenerRemove: (
        dom: EventTarget,
        eventName: string,
        callback: CanvasPointerListener,
        capture?: boolean
    ) => {
        defaultPointerListenerRemove(
            defaultLifecycleHost.pointerevents_method,
            dom,
            eventName,
            callback,
            capture
        );
    },
};

/**
 * LGraphCanvas lifecycle and event-binding layer.
 * Source: constructor + `clear/setGraph/openSubgraph/closeSubgraph/setCanvas/bindEvents/unbindEvents`.
 */
export class LGraphCanvasLifecycle extends LGraphCanvasStatic {
    options: LGraphCanvasOptions;
    graph: GraphLike | null;

    background_image: string;
    ds: DragAndScale;
    canvas: CanvasLike | null;
    bgcanvas: CanvasLike | null;
    ctx: CanvasRenderingContext2D | null;
    bgctx: CanvasRenderingContext2D | null;

    title_text_font: string;
    inner_text_font: string;
    node_title_color: string;
    default_link_color: string;
    default_connection_color: Record<string, string>;
    default_connection_color_byType: Record<string, string>;
    default_connection_color_byTypeOff: Record<string, string>;

    highquality_render: boolean;
    use_gradients: boolean;
    editor_alpha: number;
    pause_rendering: boolean;
    clear_background: boolean;
    clear_background_color: string;
    read_only: boolean;
    render_only_selected: boolean;
    live_mode: boolean;
    show_info: boolean;
    allow_dragcanvas: boolean;
    allow_dragnodes: boolean;
    allow_interaction: boolean;
    multi_select: boolean;
    allow_searchbox: boolean;
    allow_reconnect_links: boolean;
    align_to_grid: boolean;
    drag_mode: boolean;
    dragging_rectangle: Vector4 | null;
    filter: unknown;
    set_canvas_dirty_on_mouse_event: boolean;
    always_render_background: boolean;
    render_shadows: boolean;
    render_canvas_border: boolean;
    render_connections_shadows: boolean;
    render_connections_border: boolean;
    render_curved_connections: boolean;
    render_connection_arrows: boolean;
    render_collapsed_slots: boolean;
    render_execution_order: boolean;
    render_title_colored: boolean;
    render_link_tooltip: boolean;
    zoom_modify_alpha: boolean;
    links_render_mode: number;

    mouse: Vector2;
    graph_mouse: Vector2;
    canvas_mouse: Vector2;
    onSearchBox: ((...args: unknown[]) => unknown) | null;
    onSearchBoxSelection: ((...args: unknown[]) => unknown) | null;
    onMouse: ((...args: unknown[]) => unknown) | null;
    onDrawBackground: ((...args: unknown[]) => unknown) | null;
    onDrawForeground: ((...args: unknown[]) => unknown) | null;
    onDrawOverlay: ((...args: unknown[]) => unknown) | null;
    onDrawLinkTooltip: ((...args: unknown[]) => unknown) | null;
    onNodeMoved: ((...args: unknown[]) => unknown) | null;
    onSelectionChange: ((...args: unknown[]) => unknown) | null;
    onConnectingChange: ((...args: unknown[]) => unknown) | null;
    onBeforeChange: ((...args: unknown[]) => unknown) | null;
    onAfterChange: ((...args: unknown[]) => unknown) | null;
    connections_width: number;
    round_radius: number;
    current_node: unknown;
    node_widget: unknown;
    over_link_center: unknown;
    last_mouse_position: Vector2;
    visible_area: Float32Array;
    visible_links: unknown[];
    viewport: Vector4 | null;
    autoresize?: boolean;

    frame: number;
    last_draw_time: number;
    render_time: number;
    fps: number;
    selected_nodes: Record<string, unknown>;
    selected_group: unknown;
    visible_nodes: unknown[];
    node_dragged: unknown;
    node_over: unknown;
    node_capturing_input: unknown;
    connecting_node: unknown;
    highlighted_links: Record<string, unknown>;
    dragging_canvas: boolean;
    dirty_canvas: boolean;
    dirty_bgcanvas: boolean;
    dirty_area: Vector4 | null;
    node_in_panel: unknown;
    last_mouse: Vector2;
    last_mouseclick: number;
    pointer_is_down: boolean;
    pointer_is_double: boolean;

    _graph_stack: GraphLike[] | null;
    _events_binded: boolean;
    is_rendering: boolean;

    _mousedown_callback: CanvasPointerListener | null;
    _mousewheel_callback: CanvasPointerListener | null;
    _mousemove_callback: CanvasPointerListener | null;
    _mouseup_callback: CanvasPointerListener | null;
    _pointercancel_callback: CanvasPointerListener | null;
    _pointercapture_callback: CanvasPointerListener | null;
    _touch_callback: CanvasPointerListener | null;
    _key_callback: CanvasPointerListener | null;
    _ondrop_callback: CanvasPointerListener | null;

    constructor(
        canvas?: HTMLCanvasElement | string | null,
        graph?: GraphLike | null,
        options?: LGraphCanvasOptions
    ) {
        super();
        this.options = options || {};
        this.graph = null;
        this._graph_stack = null;
        this._events_binded = false;
        this.is_rendering = false;

        this.background_image = LGraphCanvasLifecycle.DEFAULT_BACKGROUND_IMAGE;
        let targetCanvas = canvas || null;
        if (targetCanvas && (targetCanvas as unknown as { constructor?: unknown }).constructor === String) {
            targetCanvas = document.querySelector(
                targetCanvas as unknown as string
            ) as HTMLCanvasElement | null;
        }

        this.ds = new DragAndScale();
        this.zoom_modify_alpha = true;
        const host = this.host();
        this.title_text_font = "" + host.NODE_TEXT_SIZE + "px Arial";
        this.inner_text_font = "normal " + host.NODE_SUBTEXT_SIZE + "px Arial";
        this.node_title_color = host.NODE_TITLE_COLOR;
        this.default_link_color = host.LINK_COLOR;
        this.default_connection_color = {
            input_off: "#778",
            input_on: "#7F7",
            output_off: "#778",
            output_on: "#7F7",
        };
        this.default_connection_color_byType = {};
        this.default_connection_color_byTypeOff = {};

        this.highquality_render = true;
        this.use_gradients = false;
        this.editor_alpha = 1;
        this.pause_rendering = false;
        this.clear_background = true;
        this.clear_background_color = "#222";
        this.read_only = false;
        this.render_only_selected = true;
        this.live_mode = false;
        this.show_info = true;
        this.allow_dragcanvas = true;
        this.allow_dragnodes = true;
        this.allow_interaction = true;
        this.multi_select = false;
        this.allow_searchbox = true;
        this.allow_reconnect_links = true;
        this.align_to_grid = false;
        this.drag_mode = false;
        this.dragging_rectangle = null;
        this.filter = null;
        this.set_canvas_dirty_on_mouse_event = true;
        this.always_render_background = false;
        this.render_shadows = true;
        this.render_canvas_border = true;
        this.render_connections_shadows = false;
        this.render_connections_border = true;
        this.render_curved_connections = false;
        this.render_connection_arrows = false;
        this.render_collapsed_slots = true;
        this.render_execution_order = false;
        this.render_title_colored = true;
        this.render_link_tooltip = true;
        this.links_render_mode = host.SPLINE_LINK;

        this.mouse = [0, 0];
        this.graph_mouse = [0, 0];
        this.canvas_mouse = this.graph_mouse;
        this.onSearchBox = null;
        this.onSearchBoxSelection = null;
        this.onMouse = null;
        this.onDrawBackground = null;
        this.onDrawForeground = null;
        this.onDrawOverlay = null;
        this.onDrawLinkTooltip = null;
        this.onNodeMoved = null;
        this.onSelectionChange = null;
        this.onConnectingChange = null;
        this.onBeforeChange = null;
        this.onAfterChange = null;
        this.connections_width = 3;
        this.round_radius = 8;
        this.current_node = null;
        this.node_widget = null;
        this.over_link_center = null;
        this.last_mouse_position = [0, 0];
        this.visible_area = this.ds.visible_area as unknown as Float32Array;
        this.visible_links = [];
        this.viewport = this.options.viewport || null;

        this.canvas = null;
        this.bgcanvas = null;
        this.ctx = null;
        this.bgctx = null;

        this.frame = 0;
        this.last_draw_time = 0;
        this.render_time = 0;
        this.fps = 0;
        this.selected_nodes = {};
        this.selected_group = null;
        this.visible_nodes = [];
        this.node_dragged = null;
        this.node_over = null;
        this.node_capturing_input = null;
        this.connecting_node = null;
        this.highlighted_links = {};
        this.dragging_canvas = false;
        this.dirty_canvas = true;
        this.dirty_bgcanvas = true;
        this.dirty_area = null;
        this.node_in_panel = null;
        this.last_mouse = [0, 0];
        this.last_mouseclick = 0;
        this.pointer_is_down = false;
        this.pointer_is_double = false;

        this._mousedown_callback = null;
        this._mousewheel_callback = null;
        this._mousemove_callback = null;
        this._mouseup_callback = null;
        this._pointercancel_callback = null;
        this._pointercapture_callback = null;
        this._touch_callback = null;
        this._key_callback = null;
        this._ondrop_callback = null;

        if (graph) {
            graph.attachCanvas(this);
        }

        this.setCanvas(targetCanvas, this.options.skip_events);
        this.clear();

        if (!this.options.skip_render) {
            this.startRendering();
        }

        this.autoresize = this.options.autoresize;
    }

    private host(): LGraphCanvasLifecycleHost {
        const injected = (this.constructor as typeof LGraphCanvasLifecycle & {
            liteGraph?: Partial<LGraphCanvasLifecycleHost>;
        }).liteGraph;
        const merged = { ...defaultLifecycleHost, ...(injected || {}) };
        return {
            ...merged,
            pointerListenerAdd:
                merged.pointerListenerAdd ||
                ((dom, ev, cb, capture) =>
                    defaultPointerListenerAdd(
                        merged.pointerevents_method,
                        dom,
                        ev,
                        cb,
                        capture
                    )),
            pointerListenerRemove:
                merged.pointerListenerRemove ||
                ((dom, ev, cb, capture) =>
                    defaultPointerListenerRemove(
                        merged.pointerevents_method,
                        dom,
                        ev,
                        cb,
                        capture
                    )),
        };
    }

    clear(): void {
        this.frame = 0;
        this.last_draw_time = 0;
        this.render_time = 0;
        this.fps = 0;
        this.dragging_rectangle = null;
        this.selected_nodes = {};
        this.selected_group = null;
        this.visible_nodes = [];
        this.node_dragged = null;
        this.node_over = null;
        this.node_capturing_input = null;
        this.connecting_node = null;
        this.highlighted_links = {};
        this.dragging_canvas = false;
        this.dirty_canvas = true;
        this.dirty_bgcanvas = true;
        this.dirty_area = null;
        this.node_in_panel = null;
        this.node_widget = null;
        this.last_mouse = [0, 0];
        this.last_mouseclick = 0;
        this.pointer_is_down = false;
        this.pointer_is_double = false;
        this.visible_area.set([0, 0, 0, 0]);

        const self = this as unknown as { onClear?: () => void };
        self.onClear?.();
    }

    setGraph(graph: GraphLike | null, skip_clear?: boolean): void {
        if (this.graph == graph) {
            return;
        }

        if (!skip_clear) {
            this.clear();
        }

        if (!graph && this.graph) {
            this.graph.detachCanvas(this);
            return;
        }

        (graph as GraphLike).attachCanvas(this);
        if (this._graph_stack) {
            this._graph_stack = null;
        }

        this.setDirty(true, true);
    }

    getTopGraph(): GraphLike | null {
        if ((this._graph_stack as GraphLike[]).length) {
            return (this._graph_stack as GraphLike[])[0];
        }
        return this.graph;
    }

    openSubgraph(graph: GraphLike): void {
        if (!graph) {
            throw "graph cannot be null";
        }
        if (this.graph == graph) {
            throw "graph cannot be the same";
        }

        this.clear();
        if (this.graph) {
            if (!this._graph_stack) {
                this._graph_stack = [];
            }
            this._graph_stack.push(this.graph);
        }

        graph.attachCanvas(this);
        (this as unknown as { checkPanels: () => void }).checkPanels();
        this.setDirty(true, true);
    }

    closeSubgraph(): void {
        if (!this._graph_stack || this._graph_stack.length == 0) {
            return;
        }
        const subgraph_node = (this.graph as GraphLike)._subgraph_node;
        const graph = this._graph_stack.pop() as GraphLike;
        this.selected_nodes = {};
        this.highlighted_links = {};
        graph.attachCanvas(this);
        this.setDirty(true, true);
        if (subgraph_node) {
            const self = this as unknown as {
                centerOnNode: (node: unknown) => void;
                selectNodes: (nodes: unknown) => void;
            };
            self.centerOnNode(subgraph_node);
            self.selectNodes([subgraph_node]);
        }
        this.ds.offset = [0, 0];
        this.ds.scale = 1;
    }

    getCurrentGraph(): GraphLike | null {
        return this.graph;
    }

    setCanvas(
        canvas: HTMLCanvasElement | string | null | undefined,
        skip_events?: boolean
    ): void {
        let targetCanvas = canvas;

        if (targetCanvas) {
            if (
                (targetCanvas as unknown as { constructor?: unknown }).constructor ===
                String
            ) {
                targetCanvas = document.getElementById(
                    targetCanvas as unknown as string
                ) as HTMLCanvasElement | null;
                if (!targetCanvas) {
                    throw "Error creating LiteGraph canvas: Canvas not found";
                }
            }
        }

        if (targetCanvas === this.canvas) {
            return;
        }

        if (!targetCanvas && this.canvas) {
            if (!skip_events) {
                this.unbindEvents();
            }
        }

        this.canvas = (targetCanvas as CanvasLike) || null;
        this.ds.element = (targetCanvas as HTMLElement) || null;
        if (!targetCanvas) {
            return;
        }

        const canvasRef = targetCanvas as CanvasLike;
        canvasRef.className += " lgraphcanvas";
        canvasRef.data = this;
        canvasRef.tabIndex = 1;

        this.bgcanvas = null;
        if (!this.bgcanvas) {
            const bg = document.createElement("canvas") as CanvasLike;
            bg.width = canvasRef.width;
            bg.height = canvasRef.height;
            this.bgcanvas = bg;
        }

        if ((canvasRef as unknown as { getContext?: unknown }).getContext == null) {
            if (canvasRef.localName != "canvas") {
                throw (
                    "Element supplied for LGraphCanvas must be a <canvas> element, you passed a " +
                    canvasRef.localName
                );
            }
            throw "This browser doesn't support Canvas";
        }

        const ctx = canvasRef.getContext("2d");
        this.ctx = ctx;
        if (ctx == null) {
            if (!canvasRef.webgl_enabled) {
                console.warn(
                    "This canvas seems to be WebGL, enabling WebGL renderer"
                );
            }
            this.enableWebGL();
        }

        if (!skip_events) {
            this.bindEvents();
        }
    }

    _doNothing(e: Event): boolean {
        e.preventDefault();
        return false;
    }

    _doReturnTrue(e: Event): boolean {
        e.preventDefault();
        return true;
    }

    bindEvents(): void {
        if (this._events_binded) {
            console.warn("LGraphCanvas: events already binded");
            return;
        }
        const canvas = this.canvas as CanvasLike;

        const ref_window = this.getCanvasWindow();
        const doc = ref_window.document;
        const host = this.host();

        this._mousedown_callback = this.processMouseDown.bind(this) as CanvasPointerListener;
        this._mousewheel_callback = this.processMouseWheel.bind(this) as CanvasPointerListener;
        this._mousemove_callback = this.processMouseMove.bind(this) as CanvasPointerListener;
        this._mouseup_callback = this.processMouseUp.bind(this) as CanvasPointerListener;
        this._pointercancel_callback = this.processPointerCancel.bind(this) as CanvasPointerListener;
        this._pointercapture_callback = this.processPointerCapture.bind(this) as CanvasPointerListener;
        this._touch_callback = this.processTouch.bind(this) as CanvasPointerListener;

        host.pointerListenerAdd(canvas, "down", this._mousedown_callback, true);
        canvas.addEventListener("mousewheel", this._mousewheel_callback as EventListener, false);
        host.pointerListenerAdd(canvas, "up", this._mouseup_callback, true);
        host.pointerListenerAdd(canvas, "move", this._mousemove_callback);
        host.pointerListenerAdd(
            canvas,
            "cancel",
            this._pointercancel_callback,
            true
        );
        host.pointerListenerAdd(
            canvas,
            "gotpointercapture",
            this._pointercapture_callback,
            true
        );
        host.pointerListenerAdd(
            canvas,
            "lostpointercapture",
            this._pointercancel_callback,
            true
        );

        canvas.addEventListener("contextmenu", this._doNothing);
        canvas.addEventListener(
            "DOMMouseScroll",
            this._mousewheel_callback as EventListener,
            false
        );

        if (host.pointerevents_method === "mouse" && host.isTouchDevice()) {
            const options = { capture: true, passive: false } as AddEventListenerOptions;
            canvas.addEventListener(
                "touchstart",
                this._touch_callback as EventListener,
                options
            );
            canvas.addEventListener(
                "touchmove",
                this._touch_callback as EventListener,
                options
            );
            canvas.addEventListener(
                "touchend",
                this._touch_callback as EventListener,
                options
            );
            canvas.addEventListener(
                "touchcancel",
                this._touch_callback as EventListener,
                options
            );
        }

        this._key_callback = this.processKey.bind(this) as CanvasPointerListener;
        canvas.setAttribute("tabindex", "1");
        canvas.addEventListener("keydown", this._key_callback as EventListener, true);
        doc.addEventListener("keyup", this._key_callback as EventListener, true);

        this._ondrop_callback = this.processDrop.bind(this) as CanvasPointerListener;
        canvas.addEventListener("dragover", this._doNothing, false);
        canvas.addEventListener("dragend", this._doNothing, false);
        canvas.addEventListener("drop", this._ondrop_callback as EventListener, false);
        canvas.addEventListener("dragenter", this._doReturnTrue, false);

        this._events_binded = true;
    }

    unbindEvents(): void {
        if (!this._events_binded) {
            console.warn("LGraphCanvas: no events binded");
            return;
        }
        const canvas = this.canvas as CanvasLike;
        const ref_window = this.getCanvasWindow();
        const doc = ref_window.document;
        const host = this.host();

        host.pointerListenerRemove(
            canvas,
            "move",
            this._mousemove_callback as CanvasPointerListener
        );
        host.pointerListenerRemove(
            canvas,
            "up",
            this._mouseup_callback as CanvasPointerListener,
            true
        );
        host.pointerListenerRemove(
            canvas,
            "down",
            this._mousedown_callback as CanvasPointerListener,
            true
        );
        host.pointerListenerRemove(
            canvas,
            "cancel",
            this._pointercancel_callback as CanvasPointerListener,
            true
        );
        host.pointerListenerRemove(
            canvas,
            "gotpointercapture",
            this._pointercapture_callback as CanvasPointerListener,
            true
        );
        host.pointerListenerRemove(
            canvas,
            "lostpointercapture",
            this._pointercancel_callback as CanvasPointerListener,
            true
        );
        canvas.removeEventListener(
            "mousewheel",
            this._mousewheel_callback as EventListener
        );
        canvas.removeEventListener(
            "DOMMouseScroll",
            this._mousewheel_callback as EventListener
        );
        canvas.removeEventListener("keydown", this._key_callback as EventListener);
        doc.removeEventListener("keyup", this._key_callback as EventListener);
        canvas.removeEventListener("contextmenu", this._doNothing);
        canvas.removeEventListener("drop", this._ondrop_callback as EventListener);
        canvas.removeEventListener("dragenter", this._doReturnTrue);
        canvas.removeEventListener(
            "touchstart",
            this._touch_callback as EventListener,
            true
        );
        canvas.removeEventListener(
            "touchmove",
            this._touch_callback as EventListener,
            true
        );
        canvas.removeEventListener(
            "touchend",
            this._touch_callback as EventListener,
            true
        );
        canvas.removeEventListener(
            "touchcancel",
            this._touch_callback as EventListener,
            true
        );

        this._mousedown_callback = null;
        this._mousewheel_callback = null;
        this._mousemove_callback = null;
        this._mouseup_callback = null;
        this._pointercancel_callback = null;
        this._pointercapture_callback = null;
        this._touch_callback = null;
        this._key_callback = null;
        this._ondrop_callback = null;
        this._events_binded = false;
    }

    processPointerCapture(e: Event & { isPrimary?: boolean }): void {
        if (!e || e.isPrimary === false) {
            return;
        }
        this.pointer_is_down = true;
    }

    processPointerCancel(
        e: Event & {
            which?: number;
            button?: number;
            buttons?: number;
        }
    ): unknown {
        if (!e || !this.graph) {
            return;
        }
        if (e.which == null) {
            e.which = 1;
        }
        if (e.button == null) {
            e.button = 0;
        }
        if (e.buttons == null) {
            e.buttons = 0;
        }
        return this.processMouseUp(e as unknown as MouseLikeEvent);
    }

    processTouch(event: TouchEvent): unknown {
        if (!event || !this.graph) {
            return;
        }

        const changed =
            event.changedTouches && event.changedTouches.length
                ? event.changedTouches[0]
                : null;
        const active =
            event.touches && event.touches.length ? event.touches[0] : null;
        const touch = changed || active;
        if (!touch) {
            return;
        }

        let type: "mousedown" | "mousemove" | "mouseup" | null = null;
        if (event.type == "touchstart") {
            type = "mousedown";
        } else if (event.type == "touchmove") {
            type = "mousemove";
        } else if (event.type == "touchend" || event.type == "touchcancel") {
            type = "mouseup";
        } else {
            return;
        }

        const synthetic = {
            type,
            clientX: touch.clientX,
            clientY: touch.clientY,
            pageX: touch.pageX,
            pageY: touch.pageY,
            screenX: touch.screenX,
            screenY: touch.screenY,
            which: 1,
            button: 0,
            buttons: type == "mouseup" ? 0 : 1,
            isPrimary: true,
            pointerId: touch.identifier || 1,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            target: event.target || this.canvas,
            originalEvent: event,
            preventDefault: () => {
                if (event.cancelable && event.preventDefault) {
                    event.preventDefault();
                }
            },
            stopPropagation: () => {
                if (event.stopPropagation) {
                    event.stopPropagation();
                }
            },
            stopImmediatePropagation: () => {
                if (event.stopImmediatePropagation) {
                    event.stopImmediatePropagation();
                }
            },
        } as unknown as MouseLikeEvent;

        if (type == "mousedown") {
            return this.processMouseDown(synthetic);
        }
        if (type == "mousemove") {
            return this.processMouseMove(synthetic);
        }
        return this.processMouseUp(synthetic);
    }

    getCanvasWindow(): Window {
        if (!this.canvas) {
            return window;
        }
        const doc = this.canvas.ownerDocument as Document & {
            parentWindow?: Window;
        };
        return (doc.defaultView || doc.parentWindow) as Window;
    }

    setDirty(fgcanvas: boolean, bgcanvas: boolean): void {
        if (fgcanvas) {
            this.dirty_canvas = true;
        }
        if (bgcanvas) {
            this.dirty_bgcanvas = true;
        }
    }

    startRendering(): void {
        if (this.is_rendering) {
            return;
        }
        this.is_rendering = true;
        const renderFrame = function (this: LGraphCanvasLifecycle): void {
            if (!this.pause_rendering) {
                (this as unknown as {
                    draw: (force_canvas?: boolean, force_bgcanvas?: boolean) => void;
                }).draw();
            }
            const windowRef = this.getCanvasWindow();
            if (this.is_rendering) {
                windowRef.requestAnimationFrame(renderFrame.bind(this));
            }
        };
        renderFrame.call(this);
    }

    stopRendering(): void {
        this.is_rendering = false;
    }

    enableWebGL(): void {
        // implemented in a later canvas migration task
    }

    // placeholder methods consumed by bindEvents/processTouch until Task24 migrates input stack.
    processMouseDown(_e: MouseLikeEvent): boolean | undefined {
        return undefined;
    }

    processMouseMove(_e: MouseLikeEvent): boolean | undefined {
        return undefined;
    }

    processMouseUp(_e: MouseLikeEvent): boolean | undefined {
        return undefined;
    }

    processMouseWheel(_e: MouseLikeEvent): boolean | undefined {
        return undefined;
    }

    processKey(_e: KeyboardEvent): boolean | undefined {
        return undefined;
    }

    processDrop(_e: DragEvent): void {}
}
