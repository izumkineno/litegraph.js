import type { Vector2, Vector4 } from "../types/core-types";
import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import type { LGraphPersistence as LGraph } from "../models/LGraph.persistence";
import type { LGraphGroup } from "../models/LGraphGroup";
import type { LGraphNodeCanvasCollab as LGraphNode } from "../models/LGraphNode.canvas-collab";
import { distance, isInsideRectangle, overlapBounding } from "../utils/math-geometry";
import { LGraphCanvasLifecycle } from "./LGraphCanvas.lifecycle";

type CanvasMouseEventLike = any;
type CanvasGraphRuntime = LGraph;
type CanvasNodeRuntime = LGraphNode;
type CanvasGroupRuntime = LGraphGroup;

type LGraphCanvasInputHost = Pick<
    LiteGraphConstantsShape,
    | "NODE_TITLE_HEIGHT"
    | "EVENT"
    | "alt_drag_do_clone_nodes"
    | "middle_click_slot_add_default_node"
    | "release_link_on_empty_shows_menu"
    | "click_do_break_link_to"
    | "ctrl_shift_v_paste_connect_unselected_outputs"
> & {
    node_types_by_file_extension: Record<string, { type: string }>;
    isBreakLinkModifierPressed: (e?: MouseEvent) => boolean;
    isValidConnection: (...args: any[]) => boolean;
    createNode: (type?: string) => LGraphNode | null;
    getTime: () => number;
    closeAllContextMenus: (...args: any[]) => void;
    pointerListenerAdd: (
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => void;
    pointerListenerRemove: (
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => void;
};

const defaultLiteGraphHost: LGraphCanvasInputHost = {
    NODE_TITLE_HEIGHT: 30,
    EVENT: -1,
    alt_drag_do_clone_nodes: false,
    middle_click_slot_add_default_node: false,
    release_link_on_empty_shows_menu: false,
    click_do_break_link_to: false,
    ctrl_shift_v_paste_connect_unselected_outputs: false,
    node_types_by_file_extension: {} as Record<string, { type: string }>,
    isBreakLinkModifierPressed: (e?: MouseEvent): boolean => !!e?.shiftKey,
    isValidConnection: (..._args: any[]): boolean => true,
    createNode: (_type?: string): any => null,
    getTime: (): number => Date.now(),
    closeAllContextMenus: (..._args: any[]): void => {},
    pointerListenerAdd: (
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture?: boolean
    ): void => {
        if ("addEventListener" in dom) {
            (dom as any).addEventListener(eventName, callback, !!capture);
        }
    },
    pointerListenerRemove: (
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture?: boolean
    ): void => {
        if ("removeEventListener" in dom) {
            (dom as any).removeEventListener(eventName, callback, !!capture);
        }
    },
};

const temp = new Float32Array(4) as unknown as Vector4;

/**
 * LGraphCanvas input interaction layer.
 * Source: `processMouse*`、`processKey`、`copy/paste`、`processDrop`、选择与视图控制.
 */
export class LGraphCanvasInput extends LGraphCanvasLifecycle {
    declare graph: any;
    declare selected_nodes: Record<string, any>;
    declare highlighted_links: Record<string, any>;
    declare selected_group: any;
    declare node_over: any;
    declare node_capturing_input: any;
    declare node_dragged: any;
    declare connecting_node: any;
    declare node_widget: any;
    declare visible_nodes: any[];
    declare visible_links: any[];

    block_click = false;
    last_click_position: Vector2 | null = null;
    last_mouse_dragging = false;
    selected_group_resizing = false;
    resizing_node: any = null;
    connecting_output: any = null;
    connecting_input: any = null;
    connecting_pos: Vector2 | null = null;
    connecting_slot = -1;
    _highlight_input: Vector2 | null = null;
    _highlight_output: Vector2 | null = null;
    _highlight_input_slot: any = null;

    node_panel?: { close: () => void } | null;
    options_panel?: { close: () => void } | null;
    onMouseDown?: (event: CanvasMouseEventLike) => void;
    onDropItem?: (event: Event) => unknown;
    onNodeSelected?: (node: any) => void;
    onNodeDeselected?: (node: any) => void;
    onShowNodePanel?: (node: any) => void;
    onNodeDblClicked?: (node: any) => void;

    protected getLiteGraphHost(): LGraphCanvasInputHost & Record<string, any> {
        const injected = (this.constructor as any).liteGraph || {};
        return { ...defaultLiteGraphHost, ...injected };
    }

    protected graphRef(): any {
        return this.graph as any;
    }

    private selectedNodesRef(): Record<string, any> {
        return (this.selected_nodes || {}) as Record<string, any>;
    }

    private callProcessNodeWidgets(
        node: any,
        pos: Vector2,
        event: Event,
        active_widget?: unknown
    ): unknown {
        return (this as any).processNodeWidgets(node, pos, event, active_widget);
    }

    private dispatchNodeKeyHook(
        selected_nodes: Record<string, any>,
        hook_name: "onKeyDown" | "onKeyUp",
        key_event: KeyboardEvent
    ): boolean {
        let consumed = false;
        if (!selected_nodes) {
            return consumed;
        }
        for (const id in selected_nodes) {
            const selected_node = selected_nodes[id];
            if (selected_node && selected_node[hook_name]) {
                const result = selected_node[hook_name](key_event);
                if (result === true) {
                    consumed = true;
                }
            }
        }
        return consumed;
    }

    // used to block future mouse events (because of im gui)
    blockClick(): void {
        this.block_click = true;
        this.last_mouseclick = 0;
    }

    processMouseDown(e: CanvasMouseEventLike): boolean | undefined {
        if (this.set_canvas_dirty_on_mouse_event) {
            this.dirty_canvas = true;
        }

        const graph = this.graphRef();
        if (!graph) {
            return;
        }

        this.adjustMouseEvent(e);

        const ref_window = this.getCanvasWindow();
        const LiteGraph = this.getLiteGraphHost();
        LGraphCanvasInput.active_canvas = this as any;

        const x = e.clientX;
        const y = e.clientY;

        this.ds.viewport = this.viewport || undefined;
        const is_inside =
            !this.viewport ||
            (this.viewport &&
                x >= this.viewport[0] &&
                x < this.viewport[0] + this.viewport[2] &&
                y >= this.viewport[1] &&
                y < this.viewport[1] + this.viewport[3]);

        // move mouse move event to the window in case it drags outside of the canvas
        if (!this.options.skip_events) {
            const moveCallback = this._mousemove_callback;
            const upCallback = this._mouseup_callback;
            if (this.canvas && moveCallback) {
                LiteGraph.pointerListenerRemove(
                    this.canvas,
                    "move",
                    moveCallback,
                    false
                );
            }
            if (moveCallback) {
                LiteGraph.pointerListenerAdd(
                    ref_window.document,
                    "move",
                    moveCallback,
                    true
                );
            }
            if (upCallback) {
                LiteGraph.pointerListenerAdd(
                    ref_window.document,
                    "up",
                    upCallback,
                    true
                );
            }
        }

        if (!is_inside) {
            return;
        }

        let node = graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes, 5);
        let skip_action = false;
        let block_drag_node: boolean | undefined;
        const now = LiteGraph.getTime();
        const is_primary = e.isPrimary === undefined || !e.isPrimary;
        const is_double_click = now - this.last_mouseclick < 300 && is_primary;
        this.mouse[0] = e.clientX;
        this.mouse[1] = e.clientY;
        this.graph_mouse[0] = e.canvasX;
        this.graph_mouse[1] = e.canvasY;
        this.last_click_position = [this.mouse[0], this.mouse[1]];

        if (this.pointer_is_down && is_primary) {
            this.pointer_is_double = true;
        } else {
            this.pointer_is_double = false;
        }
        this.pointer_is_down = true;

        (this.canvas as HTMLCanvasElement).focus();
        LiteGraph.closeAllContextMenus(ref_window);

        if (this.onMouse) {
            if (this.onMouse(e) == true) {
                return;
            }
        }

        // left button mouse / single finger
        if (e.which == 1 && !this.pointer_is_double) {
            if (e.ctrlKey) {
                this.dragging_rectangle = new Float32Array(4) as unknown as Vector4;
                this.dragging_rectangle[0] = e.canvasX;
                this.dragging_rectangle[1] = e.canvasY;
                this.dragging_rectangle[2] = 1;
                this.dragging_rectangle[3] = 1;
                skip_action = true;
            }

            // clone node ALT dragging
            if (LiteGraph.alt_drag_do_clone_nodes && e.altKey && node && this.allow_interaction && !skip_action && !this.read_only) {
                const cloned = node.clone();
                if (cloned) {
                    cloned.pos[0] += 5;
                    cloned.pos[1] += 5;
                    graph.add(cloned, false, { doCalcSize: false });
                    node = cloned;
                    skip_action = true;
                    if (!block_drag_node) {
                        if (this.allow_dragnodes) {
                            graph.beforeChange();
                            this.node_dragged = node;
                        }
                        const selected_nodes = this.selectedNodesRef();
                        if (!selected_nodes[String(node.id)]) {
                            this.processNodeSelected(node, e);
                        }
                    }
                }
            }

            let clicking_canvas_bg = false;

            // when clicked on top of a node
            if (node && (this.allow_interaction || node.flags.allow_interaction) && !skip_action && !this.read_only) {
                if (!this.live_mode && !node.flags.pinned) {
                    this.bringToFront(node);
                }

                if (this.allow_interaction && !this.connecting_node && !node.flags.collapsed && !this.live_mode) {
                    if (
                        !skip_action &&
                        node.resizable !== false &&
                        isInsideRectangle(
                            e.canvasX,
                            e.canvasY,
                            node.pos[0] + node.size[0] - 5,
                            node.pos[1] + node.size[1] - 5,
                            10,
                            10
                        )
                    ) {
                        graph.beforeChange();
                        this.resizing_node = node;
                        if (this.canvas) {
                            this.canvas.style.cursor = "se-resize";
                        }
                        skip_action = true;
                    } else {
                        if (node.outputs) {
                            for (let i = 0, l = node.outputs.length; i < l; ++i) {
                                const output = node.outputs[i];
                                const link_pos = node.getConnectionPos(false, i);
                                if (
                                    isInsideRectangle(
                                        e.canvasX,
                                        e.canvasY,
                                        link_pos[0] - 15,
                                        link_pos[1] - 10,
                                        30,
                                        20
                                    )
                                ) {
                                    this.connecting_node = node;
                                    this.connecting_output = output;
                                    this.connecting_output.slot_index = i;
                                    this.connecting_pos = node.getConnectionPos(false, i);
                                    this.connecting_slot = i;

                                    if (LiteGraph.isBreakLinkModifierPressed(e)) {
                                        node.disconnectOutput(i);
                                    }

                                    if (is_double_click) {
                                        if (node.onOutputDblClick) {
                                            node.onOutputDblClick(i, e);
                                        }
                                    } else {
                                        if (node.onOutputClick) {
                                            node.onOutputClick(i, e);
                                        }
                                    }

                                    skip_action = true;
                                    break;
                                }
                            }
                        }

                        if (node.inputs) {
                            for (let i = 0, l = node.inputs.length; i < l; ++i) {
                                const input = node.inputs[i];
                                const link_pos = node.getConnectionPos(true, i);
                                if (
                                    isInsideRectangle(
                                        e.canvasX,
                                        e.canvasY,
                                        link_pos[0] - 15,
                                        link_pos[1] - 10,
                                        30,
                                        20
                                    )
                                ) {
                                    if (is_double_click) {
                                        if (node.onInputDblClick) {
                                            node.onInputDblClick(i, e);
                                        }
                                    } else {
                                        if (node.onInputClick) {
                                            node.onInputClick(i, e);
                                        }
                                    }

                                    if (input.link !== null) {
                                        const link_info = graph.links[input.link];
                                        if (LiteGraph.click_do_break_link_to) {
                                            node.disconnectInput(i);
                                            this.dirty_bgcanvas = true;
                                            skip_action = true;
                                        }

                                        if (this.allow_reconnect_links || e.shiftKey) {
                                            if (!LiteGraph.click_do_break_link_to) {
                                                node.disconnectInput(i);
                                            }
                                            this.connecting_node = graph._nodes_by_id[link_info.origin_id];
                                            this.connecting_slot = link_info.origin_slot;
                                            this.connecting_output =
                                                this.connecting_node.outputs[this.connecting_slot];
                                            this.connecting_pos = this.connecting_node.getConnectionPos(
                                                false,
                                                this.connecting_slot
                                            );
                                            this.dirty_bgcanvas = true;
                                            skip_action = true;
                                        }
                                    }

                                    if (!skip_action) {
                                        this.connecting_node = node;
                                        this.connecting_input = input;
                                        this.connecting_input.slot_index = i;
                                        this.connecting_pos = node.getConnectionPos(true, i);
                                        this.connecting_slot = i;
                                        this.dirty_bgcanvas = true;
                                        skip_action = true;
                                    }
                                }
                            }
                        }
                    }
                }

                if (!skip_action) {
                    block_drag_node = false;
                    const pos: Vector2 = [e.canvasX - node.pos[0], e.canvasY - node.pos[1]];
                    const widget = this.callProcessNodeWidgets(node, this.graph_mouse, e);
                    if (widget) {
                        block_drag_node = true;
                        this.node_widget = [node, widget] as any;
                    }

                    const selected_nodes = this.selectedNodesRef();
                    if (this.allow_interaction && is_double_click && selected_nodes[String(node.id)]) {
                        if (node.onDblClick) {
                            node.onDblClick(e, pos, this);
                        }
                        this.processNodeDblClicked(node);
                        block_drag_node = true;
                    }

                    if (node.onMouseDown && node.onMouseDown(e, pos, this)) {
                        block_drag_node = true;
                    } else {
                        if (node.subgraph && !node.skip_subgraph_button) {
                            if (
                                !node.flags.collapsed &&
                                pos[0] > node.size[0] - LiteGraph.NODE_TITLE_HEIGHT &&
                                pos[1] < 0
                            ) {
                                setTimeout(() => {
                                    this.openSubgraph(node.subgraph);
                                }, 10);
                            }
                        }

                        if (this.live_mode) {
                            clicking_canvas_bg = true;
                            block_drag_node = true;
                        }
                    }

                    if (!block_drag_node) {
                        if (this.allow_dragnodes) {
                            graph.beforeChange();
                            this.node_dragged = node;
                        }
                        this.processNodeSelected(node, e);
                    } else {
                        if (!node.is_selected) {
                            this.processNodeSelected(node, e);
                        }
                    }

                    this.dirty_canvas = true;
                }
            } else {
                if (!skip_action) {
                    if (!this.read_only) {
                        for (let i = 0; i < this.visible_links.length; ++i) {
                            const link = this.visible_links[i] as any;
                            const center = link._pos;
                            if (
                                !center ||
                                e.canvasX < center[0] - 4 ||
                                e.canvasX > center[0] + 4 ||
                                e.canvasY < center[1] - 4 ||
                                e.canvasY > center[1] + 4
                            ) {
                                continue;
                            }
                            (this as any).showLinkMenu(link, e);
                            this.over_link_center = null;
                            break;
                        }
                    }

                    this.selected_group = graph.getGroupOnPos(e.canvasX, e.canvasY);
                    this.selected_group_resizing = false;
                    if (this.selected_group && !this.read_only) {
                        if (e.ctrlKey) {
                            this.dragging_rectangle = null;
                        }

                        const dist = distance(
                            [e.canvasX, e.canvasY],
                            [
                                this.selected_group.pos[0] + this.selected_group.size[0],
                                this.selected_group.pos[1] + this.selected_group.size[1],
                            ]
                        );
                        if (dist * this.ds.scale < 10) {
                            this.selected_group_resizing = true;
                        } else {
                            this.selected_group.recomputeInsideNodes();
                        }
                    }

                    if (is_double_click && !this.read_only && this.allow_searchbox) {
                        (this as any).showSearchBox(e);
                        e.preventDefault();
                        e.stopPropagation();
                    }

                    clicking_canvas_bg = true;
                }
            }

            if (!skip_action && clicking_canvas_bg && this.allow_dragcanvas) {
                this.dragging_canvas = true;
            }
        } else if (e.which == 2) {
            if (LiteGraph.middle_click_slot_add_default_node) {
                if (node && this.allow_interaction && !skip_action && !this.read_only) {
                    if (!this.connecting_node && !node.flags.collapsed && !this.live_mode) {
                        let mClikSlot: any = false;
                        let mClikSlot_index: any = false;
                        let mClikSlot_isOut = false;

                        if (node.outputs) {
                            for (let i = 0, l = node.outputs.length; i < l; ++i) {
                                const output = node.outputs[i];
                                const link_pos = node.getConnectionPos(false, i);
                                if (isInsideRectangle(e.canvasX, e.canvasY, link_pos[0] - 15, link_pos[1] - 10, 30, 20)) {
                                    mClikSlot = output;
                                    mClikSlot_index = i;
                                    mClikSlot_isOut = true;
                                    break;
                                }
                            }
                        }

                        if (node.inputs) {
                            for (let i = 0, l = node.inputs.length; i < l; ++i) {
                                const input = node.inputs[i];
                                const link_pos = node.getConnectionPos(true, i);
                                if (isInsideRectangle(e.canvasX, e.canvasY, link_pos[0] - 15, link_pos[1] - 10, 30, 20)) {
                                    mClikSlot = input;
                                    mClikSlot_index = i;
                                    mClikSlot_isOut = false;
                                    break;
                                }
                            }
                        }

                        if (mClikSlot && mClikSlot_index !== false) {
                            const slot_length = mClikSlot_isOut
                                ? node.outputs.length
                                : node.inputs.length;
                            const alphaPosY = 0.5 - (mClikSlot_index + 1) / slot_length;
                            const node_bounding = node.getBounding();
                            const posRef: Vector2 = [
                                !mClikSlot_isOut ? node_bounding[0] : node_bounding[0] + node_bounding[2],
                                e.canvasY - 80,
                            ];

                            (this as any).createDefaultNodeForSlot({
                                nodeFrom: !mClikSlot_isOut ? null : node,
                                slotFrom: !mClikSlot_isOut ? null : mClikSlot_index,
                                nodeTo: !mClikSlot_isOut ? node : null,
                                slotTo: !mClikSlot_isOut ? mClikSlot_index : null,
                                position: posRef,
                                nodeType: "AUTO",
                                posAdd: [!mClikSlot_isOut ? -30 : 30, -alphaPosY * 130],
                                posSizeFix: [!mClikSlot_isOut ? -1 : 0, 0],
                            });
                        }
                    }
                }
            } else if (!skip_action && this.allow_dragcanvas) {
                this.dragging_canvas = true;
            }
        } else if (e.which == 3 || this.pointer_is_double) {
            if (this.allow_interaction && !skip_action && !this.read_only) {
                if (node) {
                    const selected_nodes = this.selectedNodesRef();
                    if (
                        Object.keys(selected_nodes).length &&
                        (selected_nodes[String(node.id)] || e.shiftKey || e.ctrlKey || e.metaKey)
                    ) {
                        if (!selected_nodes[String(node.id)]) {
                            this.selectNodes([node], true);
                        }
                    } else {
                        this.selectNodes([node]);
                    }
                }
                (this as any).processContextMenu(node, e);
            }
        }

        this.last_mouse[0] = e.clientX;
        this.last_mouse[1] = e.clientY;
        this.last_mouseclick = LiteGraph.getTime();
        this.last_mouse_dragging = true;

        graph.change();

        const active = ref_window.document.activeElement;
        const node_name = active && "nodeName" in active ? String(active.nodeName).toLowerCase() : "";
        if (!active || (node_name != "input" && node_name != "textarea")) {
            e.preventDefault();
        }
        e.stopPropagation();

        if (this.onMouseDown) {
            this.onMouseDown(e);
        }
        return false;
    }

    /**
     * Called when a mouse move event has to be processed
     * @method processMouseMove
     **/
    processMouseMove(e: CanvasMouseEventLike): boolean | undefined {
        if (this.autoresize) {
            (this as any).resize();
        }

        if (this.set_canvas_dirty_on_mouse_event) {
            this.dirty_canvas = true;
        }

        const graph = this.graphRef();
        if (!graph) {
            return;
        }
        const LiteGraph = this.getLiteGraphHost();

        LGraphCanvasInput.active_canvas = this as any;
        this.adjustMouseEvent(e);
        const mouse: Vector2 = [e.clientX, e.clientY];
        this.mouse[0] = mouse[0];
        this.mouse[1] = mouse[1];
        const delta: Vector2 = [mouse[0] - this.last_mouse[0], mouse[1] - this.last_mouse[1]];
        this.last_mouse = mouse;
        this.graph_mouse[0] = e.canvasX;
        this.graph_mouse[1] = e.canvasY;

        if (this.block_click) {
            e.preventDefault();
            return false;
        }

        e.dragging = this.last_mouse_dragging;

        if (this.node_widget) {
            const widget_context = this.node_widget as any[];
            this.callProcessNodeWidgets(widget_context[0], this.graph_mouse, e, widget_context[1]);
            this.dirty_canvas = true;
        }

        // get node over
        const node = graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes);

        if (this.dragging_rectangle) {
            this.dragging_rectangle[2] = e.canvasX - this.dragging_rectangle[0];
            this.dragging_rectangle[3] = e.canvasY - this.dragging_rectangle[1];
            this.dirty_canvas = true;
        } else if (this.selected_group && !this.read_only) {
            // moving/resizing a group
            if (this.selected_group_resizing) {
                this.selected_group.size = [
                    e.canvasX - this.selected_group.pos[0],
                    e.canvasY - this.selected_group.pos[1],
                ];
            } else {
                const deltax = delta[0] / this.ds.scale;
                const deltay = delta[1] / this.ds.scale;
                this.selected_group.move(deltax, deltay, e.ctrlKey);
                if (this.selected_group._nodes.length) {
                    this.dirty_canvas = true;
                }
            }
            this.dirty_bgcanvas = true;
        } else if (this.dragging_canvas) {
            this.ds.offset[0] += delta[0] / this.ds.scale;
            this.ds.offset[1] += delta[1] / this.ds.scale;
            this.dirty_canvas = true;
            this.dirty_bgcanvas = true;
        } else if ((this.allow_interaction || (node && node.flags.allow_interaction)) && !this.read_only) {
            if (this.connecting_node) {
                this.dirty_canvas = true;
            }

            // remove mouseover flag
            for (let i = 0, l = graph._nodes.length; i < l; ++i) {
                if (graph._nodes[i].mouseOver && node != graph._nodes[i]) {
                    graph._nodes[i].mouseOver = false;
                    if (this.node_over && this.node_over.onMouseLeave) {
                        this.node_over.onMouseLeave(e);
                    }
                    this.node_over = null;
                    this.dirty_canvas = true;
                }
            }

            // mouse over a node
            if (node) {
                if (node.redraw_on_mouse) {
                    this.dirty_canvas = true;
                }

                if (!node.mouseOver) {
                    node.mouseOver = true;
                    this.node_over = node;
                    this.dirty_canvas = true;
                    if (node.onMouseEnter) {
                        node.onMouseEnter(e);
                    }
                }

                if (node.onMouseMove) {
                    node.onMouseMove(e, [e.canvasX - node.pos[0], e.canvasY - node.pos[1]], this);
                }

                // if dragging a link
                if (this.connecting_node) {
                    if (this.connecting_output) {
                        const pos = this._highlight_input || ([0, 0] as Vector2);
                        if (!this.isOverNodeBox(node, e.canvasX, e.canvasY)) {
                            const slot = this.isOverNodeInput(node, e.canvasX, e.canvasY, pos);
                            if (slot != -1 && node.inputs[slot]) {
                                const slot_type = node.inputs[slot].type;
                                if (LiteGraph.isValidConnection(this.connecting_output.type, slot_type)) {
                                    this._highlight_input = pos;
                                    this._highlight_input_slot = node.inputs[slot];
                                }
                            } else {
                                this._highlight_input = null;
                                this._highlight_input_slot = null;
                            }
                        }
                    } else if (this.connecting_input) {
                        const pos = this._highlight_output || ([0, 0] as Vector2);
                        if (!this.isOverNodeBox(node, e.canvasX, e.canvasY)) {
                            const slot = this.isOverNodeOutput(node, e.canvasX, e.canvasY, pos);
                            if (slot != -1 && node.outputs[slot]) {
                                const slot_type = node.outputs[slot].type;
                                if (LiteGraph.isValidConnection(this.connecting_input.type, slot_type)) {
                                    this._highlight_output = pos;
                                }
                            } else {
                                this._highlight_output = null;
                            }
                        }
                    }
                }

                // Search for corner
                if (this.canvas) {
                    if (
                        isInsideRectangle(
                            e.canvasX,
                            e.canvasY,
                            node.pos[0] + node.size[0] - 5,
                            node.pos[1] + node.size[1] - 5,
                            5,
                            5
                        )
                    ) {
                        this.canvas.style.cursor = "se-resize";
                    } else {
                        this.canvas.style.cursor = "crosshair";
                    }
                }
            } else {
                // not over a node
                let over_link = null;
                for (let i = 0; i < this.visible_links.length; ++i) {
                    const link = this.visible_links[i] as any;
                    const center = link._pos;
                    if (
                        !center ||
                        e.canvasX < center[0] - 4 ||
                        e.canvasX > center[0] + 4 ||
                        e.canvasY < center[1] - 4 ||
                        e.canvasY > center[1] + 4
                    ) {
                        continue;
                    }
                    over_link = link;
                    break;
                }
                if (over_link != this.over_link_center) {
                    this.over_link_center = over_link;
                    this.dirty_canvas = true;
                }

                if (this.canvas) {
                    this.canvas.style.cursor = "";
                }
            }

            // send event to node if capturing input
            if (this.node_capturing_input && this.node_capturing_input != node && this.node_capturing_input.onMouseMove) {
                this.node_capturing_input.onMouseMove(
                    e,
                    [e.canvasX - this.node_capturing_input.pos[0], e.canvasY - this.node_capturing_input.pos[1]],
                    this
                );
            }

            // node being dragged
            if (this.node_dragged && !this.live_mode) {
                const selected_nodes = this.selectedNodesRef();
                for (const i in selected_nodes) {
                    const n = selected_nodes[i];
                    n.pos[0] += delta[0] / this.ds.scale;
                    n.pos[1] += delta[1] / this.ds.scale;
                    if (!n.is_selected) {
                        this.processNodeSelected(n, e);
                    }
                }

                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
            }

            if (this.resizing_node && !this.live_mode) {
                const desired_size: Vector2 = [
                    e.canvasX - this.resizing_node.pos[0],
                    e.canvasY - this.resizing_node.pos[1],
                ];
                const min_size = this.resizing_node.computeSize();
                desired_size[0] = Math.max(min_size[0], desired_size[0]);
                desired_size[1] = Math.max(min_size[1], desired_size[1]);
                this.resizing_node.setSize(desired_size);

                (this.canvas as HTMLCanvasElement).style.cursor = "se-resize";
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
            }
        }

        e.preventDefault();
        return false;
    }

    /**
     * Called when a mouse up event has to be processed
     * @method processMouseUp
     **/
    processMouseUp(e: CanvasMouseEventLike): boolean | undefined {
        const is_primary = e.isPrimary === undefined || e.isPrimary;
        if (!is_primary) {
            return false;
        }

        if (this.set_canvas_dirty_on_mouse_event) {
            this.dirty_canvas = true;
        }

        const graph = this.graphRef();
        if (!graph) {
            return;
        }

        const ref_window = this.getCanvasWindow();
        const document = ref_window.document;
        const LiteGraph = this.getLiteGraphHost();
        LGraphCanvasInput.active_canvas = this as any;

        // restore the mousemove event back to the canvas
        if (!this.options.skip_events) {
            const moveCallback = this._mousemove_callback;
            const upCallback = this._mouseup_callback;
            if (moveCallback) {
                LiteGraph.pointerListenerRemove(
                    document,
                    "move",
                    moveCallback,
                    true
                );
                if (this.canvas) {
                    LiteGraph.pointerListenerAdd(
                        this.canvas,
                        "move",
                        moveCallback
                    );
                }
            }
            if (upCallback) {
                LiteGraph.pointerListenerRemove(
                    document,
                    "up",
                    upCallback,
                    true
                );
            }
        }

        this.adjustMouseEvent(e);
        const now = LiteGraph.getTime();
        e.click_time = now - this.last_mouseclick;
        this.last_mouse_dragging = false;
        this.last_click_position = null;

        if (this.block_click) {
            this.block_click = false;
        }

        if (e.which == 1) {
            if (this.node_widget) {
                const widget_context = this.node_widget as any[];
                this.callProcessNodeWidgets(widget_context[0], this.graph_mouse, e);
            }
            this.node_widget = null;

            if (this.selected_group) {
                const diffx = this.selected_group.pos[0] - Math.round(this.selected_group.pos[0]);
                const diffy = this.selected_group.pos[1] - Math.round(this.selected_group.pos[1]);
                this.selected_group.move(diffx, diffy, e.ctrlKey);
                this.selected_group.pos[0] = Math.round(this.selected_group.pos[0]);
                this.selected_group.pos[1] = Math.round(this.selected_group.pos[1]);
                if (this.selected_group._nodes.length) {
                    this.dirty_canvas = true;
                }
                this.selected_group = null;
            }
            this.selected_group_resizing = false;

            const node = graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes);

            if (this.dragging_rectangle) {
                const nodes = graph._nodes;
                const node_bounding = new Float32Array(4) as unknown as Vector4;

                // compute bounding and flip if left to right
                const w = Math.abs(this.dragging_rectangle[2]);
                const h = Math.abs(this.dragging_rectangle[3]);
                const startx =
                    this.dragging_rectangle[2] < 0
                        ? this.dragging_rectangle[0] - w
                        : this.dragging_rectangle[0];
                const starty =
                    this.dragging_rectangle[3] < 0
                        ? this.dragging_rectangle[1] - h
                        : this.dragging_rectangle[1];
                this.dragging_rectangle[0] = startx;
                this.dragging_rectangle[1] = starty;
                this.dragging_rectangle[2] = w;
                this.dragging_rectangle[3] = h;

                // test dragging rect size, if minimum simulate a click
                if (!node || (w > 10 && h > 10)) {
                    const to_select: any[] = [];
                    for (let i = 0; i < nodes.length; ++i) {
                        const nodeX = nodes[i];
                        nodeX.getBounding(node_bounding);
                        if (!overlapBounding(this.dragging_rectangle, node_bounding)) {
                            continue;
                        }
                        to_select.push(nodeX);
                    }
                    if (to_select.length) {
                        this.selectNodes(to_select, e.shiftKey);
                    }
                } else {
                    this.selectNodes([node], e.shiftKey || e.ctrlKey);
                }

                this.dragging_rectangle = null;
            } else if (this.connecting_node) {
                // dragging a connection
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;

                const connInOrOut = this.connecting_output || this.connecting_input;
                const connType = connInOrOut.type;

                // node below mouse
                if (node) {
                    if (this.connecting_output) {
                        const slot = this.isOverNodeInput(node, e.canvasX, e.canvasY);
                        if (slot != -1) {
                            this.connecting_node.connect(this.connecting_slot, node, slot);
                        } else {
                            this.connecting_node.connectByType(this.connecting_slot, node, connType);
                        }
                    } else if (this.connecting_input) {
                        const slot = this.isOverNodeOutput(node, e.canvasX, e.canvasY);
                        if (slot != -1) {
                            node.connect(slot, this.connecting_node, this.connecting_slot);
                        } else {
                            this.connecting_node.connectByTypeOutput(this.connecting_slot, node, connType);
                        }
                    }
                } else {
                    if (LiteGraph.release_link_on_empty_shows_menu) {
                        if (e.shiftKey && this.allow_searchbox) {
                            if (this.connecting_output) {
                                (this as any).showSearchBox(e, {
                                    node_from: this.connecting_node,
                                    slot_from: this.connecting_output,
                                    type_filter_in: this.connecting_output.type,
                                });
                            } else if (this.connecting_input) {
                                (this as any).showSearchBox(e, {
                                    node_to: this.connecting_node,
                                    slot_from: this.connecting_input,
                                    type_filter_out: this.connecting_input.type,
                                });
                            }
                        } else {
                            if (this.connecting_output) {
                                (this as any).showConnectionMenu({
                                    nodeFrom: this.connecting_node,
                                    slotFrom: this.connecting_output,
                                    e,
                                });
                            } else if (this.connecting_input) {
                                (this as any).showConnectionMenu({
                                    nodeTo: this.connecting_node,
                                    slotTo: this.connecting_input,
                                    e,
                                });
                            }
                        }
                    }
                }

                this.connecting_output = null;
                this.connecting_input = null;
                this.connecting_pos = null;
                this.connecting_node = null;
                this.connecting_slot = -1;
            } else if (this.resizing_node) {
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
                graph.afterChange(this.resizing_node);
                this.resizing_node = null;
            } else if (this.node_dragged) {
                const node_dragged = this.node_dragged;
                if (
                    node_dragged &&
                    e.click_time < 300 &&
                    isInsideRectangle(
                        e.canvasX,
                        e.canvasY,
                        node_dragged.pos[0],
                        node_dragged.pos[1] - LiteGraph.NODE_TITLE_HEIGHT,
                        LiteGraph.NODE_TITLE_HEIGHT,
                        LiteGraph.NODE_TITLE_HEIGHT
                    )
                ) {
                    node_dragged.collapse();
                }

                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
                this.node_dragged.pos[0] = Math.round(this.node_dragged.pos[0]);
                this.node_dragged.pos[1] = Math.round(this.node_dragged.pos[1]);
                if (graph.config.align_to_grid || this.align_to_grid) {
                    this.node_dragged.alignToGrid();
                }
                if (this.onNodeMoved) {
                    this.onNodeMoved(this.node_dragged);
                }
                graph.afterChange(this.node_dragged);
                this.node_dragged = null;
            } else {
                const node_over = graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes);

                if (!node_over && e.click_time < 300) {
                    this.deselectAllNodes();
                }

                this.dirty_canvas = true;
                this.dragging_canvas = false;

                if (this.node_over && this.node_over.onMouseUp) {
                    this.node_over.onMouseUp(
                        e,
                        [e.canvasX - this.node_over.pos[0], e.canvasY - this.node_over.pos[1]],
                        this
                    );
                }
                if (this.node_capturing_input && this.node_capturing_input.onMouseUp) {
                    this.node_capturing_input.onMouseUp(e, [
                        e.canvasX - this.node_capturing_input.pos[0],
                        e.canvasY - this.node_capturing_input.pos[1],
                    ]);
                }
            }
        } else if (e.which == 2) {
            this.dirty_canvas = true;
            this.dragging_canvas = false;
        } else if (e.which == 3) {
            this.dirty_canvas = true;
            this.dragging_canvas = false;
        }

        if (is_primary) {
            this.pointer_is_down = false;
            this.pointer_is_double = false;
        }

        graph.change();
        e.stopPropagation();
        e.preventDefault();
        return false;
    }

    /**
     * Called when a mouse wheel event has to be processed
     * @method processMouseWheel
     **/
    processMouseWheel(e: CanvasMouseEventLike): boolean | undefined {
        if (!this.graph || !this.allow_dragcanvas) {
            return;
        }

        const delta =
            e.wheelDeltaY != null
                ? e.wheelDeltaY
                : e.wheelDelta != null
                  ? e.wheelDelta
                  : e.deltaY != null
                    ? -e.deltaY
                    : e.detail != null
                      ? e.detail * -60
                      : 0;
        this.adjustMouseEvent(e);

        const x = e.clientX;
        const y = e.clientY;
        const is_inside =
            !this.viewport ||
            (this.viewport &&
                x >= this.viewport[0] &&
                x < this.viewport[0] + this.viewport[2] &&
                y >= this.viewport[1] &&
                y < this.viewport[1] + this.viewport[3]);
        if (!is_inside) {
            return;
        }

        let scale = this.ds.scale;
        if (delta > 0) {
            scale *= 1.1;
        } else if (delta < 0) {
            scale *= 1 / 1.1;
        }

        this.ds.changeScale(scale, [e.clientX, e.clientY]);
        this.graph.change();
        e.preventDefault();
        return false;
    }

    /**
     * returns true if a position (in graph space) is on top of a node little corner box
     * @method isOverNodeBox
     **/
    isOverNodeBox(node: any, canvasx: number, canvasy: number): boolean {
        const title_height = this.getLiteGraphHost().NODE_TITLE_HEIGHT;
        if (
            isInsideRectangle(
                canvasx,
                canvasy,
                node.pos[0] + 2,
                node.pos[1] + 2 - title_height,
                title_height - 4,
                title_height - 4
            )
        ) {
            return true;
        }
        return false;
    }

    /**
     * returns the INDEX if a position (in graph space) is on top of a node input slot
     * @method isOverNodeInput
     **/
    isOverNodeInput(node: any, canvasx: number, canvasy: number, slot_pos?: Vector2): number {
        if (node.inputs) {
            for (let i = 0, l = node.inputs.length; i < l; ++i) {
                const link_pos = node.getConnectionPos(true, i);
                let is_inside = false;
                if (node.horizontal) {
                    is_inside = isInsideRectangle(canvasx, canvasy, link_pos[0] - 5, link_pos[1] - 10, 10, 20);
                } else {
                    is_inside = isInsideRectangle(canvasx, canvasy, link_pos[0] - 10, link_pos[1] - 5, 40, 10);
                }
                if (is_inside) {
                    if (slot_pos) {
                        slot_pos[0] = link_pos[0];
                        slot_pos[1] = link_pos[1];
                    }
                    return i;
                }
            }
        }
        return -1;
    }

    /**
     * returns the INDEX if a position (in graph space) is on top of a node output slot
     * @method isOverNodeOutput
     **/
    isOverNodeOutput(node: any, canvasx: number, canvasy: number, slot_pos?: Vector2): number {
        if (node.outputs) {
            for (let i = 0, l = node.outputs.length; i < l; ++i) {
                const link_pos = node.getConnectionPos(false, i);
                let is_inside = false;
                if (node.horizontal) {
                    is_inside = isInsideRectangle(canvasx, canvasy, link_pos[0] - 5, link_pos[1] - 10, 10, 20);
                } else {
                    is_inside = isInsideRectangle(canvasx, canvasy, link_pos[0] - 10, link_pos[1] - 5, 40, 10);
                }
                if (is_inside) {
                    if (slot_pos) {
                        slot_pos[0] = link_pos[0];
                        slot_pos[1] = link_pos[1];
                    }
                    return i;
                }
            }
        }
        return -1;
    }

    /**
     * process a key event
     * @method processKey
     **/
    processKey(e: KeyboardEvent): boolean | undefined {
        if (!this.graph) {
            return;
        }

        let block_default = false;
        let node_consumed = false;
        const target = e.target as unknown as { localName: string };
        if (target.localName == "input") {
            return;
        }

        if (e.type == "keydown") {
            if (e.keyCode == 32) {
                // space
                this.dragging_canvas = true;
                block_default = true;
            }

            if (e.keyCode == 27) {
                // esc
                if (this.node_panel) {
                    this.node_panel.close();
                }
                if (this.options_panel) {
                    this.options_panel.close();
                }
                block_default = true;
            }

            // select all Control A
            if (e.keyCode == 65 && e.ctrlKey) {
                this.selectNodes();
                block_default = true;
            }

            if (e.keyCode === 67 && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                // copy
                if (this.selected_nodes) {
                    this.copyToClipboard();
                    block_default = true;
                }
            }

            if (e.keyCode === 86 && (e.metaKey || e.ctrlKey)) {
                // paste
                this.pasteFromClipboard(e.shiftKey);
                block_default = true;
            }

            // delete or backspace
            if (e.keyCode == 46 || e.keyCode == 8) {
                if (target.localName != "input" && target.localName != "textarea") {
                    this.deleteSelectedNodes();
                    block_default = true;
                }
            }

            node_consumed = this.dispatchNodeKeyHook(this.selectedNodesRef(), "onKeyDown", e);
        } else if (e.type == "keyup") {
            if (e.keyCode == 32) {
                // space
                this.dragging_canvas = false;
            }
            node_consumed = this.dispatchNodeKeyHook(this.selectedNodesRef(), "onKeyUp", e);
        }

        this.graph.change();
        if (block_default || node_consumed) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        }
    }

    copyToClipboard(): void {
        const clipboard_info: any = {
            nodes: [],
            links: [],
        };
        let index = 0;
        const selected_nodes_array = [];
        for (const i in this.selected_nodes) {
            const node: any = this.selected_nodes[i];
            if (node.clonable === false) {
                continue;
            }
            node._relative_id = index;
            selected_nodes_array.push(node);
            index += 1;
        }

        for (let i = 0; i < selected_nodes_array.length; ++i) {
            const node = selected_nodes_array[i];
            if (node.clonable === false) {
                continue;
            }
            const cloned = node.clone();
            if (!cloned) {
                console.warn("node type not found: " + node.type);
                continue;
            }
            clipboard_info.nodes.push(cloned.serialize());
            if (node.inputs && node.inputs.length) {
                for (let j = 0; j < node.inputs.length; ++j) {
                    const input = node.inputs[j];
                    if (!input || input.link == null) {
                        continue;
                    }
                    const link_info = this.graph.links[input.link];
                    if (!link_info) {
                        continue;
                    }
                    const target_node = this.graph.getNodeById(link_info.origin_id);
                    if (!target_node) {
                        continue;
                    }
                    clipboard_info.links.push([
                        target_node._relative_id,
                        link_info.origin_slot,
                        node._relative_id,
                        link_info.target_slot,
                        target_node.id,
                    ]);
                }
            }
        }
        localStorage.setItem("litegrapheditor_clipboard", JSON.stringify(clipboard_info));
    }

    pasteFromClipboard(isConnectUnselected = false): void {
        const LiteGraph = this.getLiteGraphHost();
        // if ctrl + shift + v is off, return when isConnectUnselected is true (shift is pressed) to maintain old behavior
        if (!LiteGraph.ctrl_shift_v_paste_connect_unselected_outputs && isConnectUnselected) {
            return;
        }
        const data = localStorage.getItem("litegrapheditor_clipboard");
        if (!data) {
            return;
        }

        this.graph.beforeChange();

        // create nodes
        const clipboard_info = JSON.parse(data);
        let posMin: Vector2 | false = false;
        for (let i = 0; i < clipboard_info.nodes.length; ++i) {
            if (posMin) {
                if (posMin[0] > clipboard_info.nodes[i].pos[0]) {
                    posMin[0] = clipboard_info.nodes[i].pos[0];
                }
                if (posMin[1] > clipboard_info.nodes[i].pos[1]) {
                    posMin[1] = clipboard_info.nodes[i].pos[1];
                }
            } else {
                posMin = [clipboard_info.nodes[i].pos[0], clipboard_info.nodes[i].pos[1]];
            }
        }

        const nodes = [];
        for (let i = 0; i < clipboard_info.nodes.length; ++i) {
            const node_data = clipboard_info.nodes[i];
            const node = LiteGraph.createNode(node_data.type);
            if (node) {
                node.configure(node_data);
                const sourceMinPos: Vector2 = posMin || [0, 0];
                // paste in last known mouse position
                node.pos[0] += this.graph_mouse[0] - sourceMinPos[0];
                node.pos[1] += this.graph_mouse[1] - sourceMinPos[1];
                this.graph.add(node, { doProcessChange: false });
                nodes.push(node);
            }
        }

        // create links
        for (let i = 0; i < clipboard_info.links.length; ++i) {
            const link_info = clipboard_info.links[i];
            let origin_node;
            const origin_node_relative_id = link_info[0];
            if (origin_node_relative_id != null) {
                origin_node = nodes[origin_node_relative_id];
            } else if (LiteGraph.ctrl_shift_v_paste_connect_unselected_outputs && isConnectUnselected) {
                const origin_node_id = link_info[4];
                if (origin_node_id) {
                    origin_node = this.graph.getNodeById(origin_node_id);
                }
            }
            const target_node = nodes[link_info[2]];
            if (origin_node && target_node) {
                origin_node.connect(link_info[1], target_node, link_info[3]);
            } else {
                console.warn("Warning, nodes missing on pasting");
            }
        }

        this.selectNodes(nodes);
        this.graph.afterChange();
    }

    /**
     * process a item drop event on top the canvas
     * @method processDrop
     **/
    processDrop(e: DragEvent): void {
        e.preventDefault();
        this.adjustMouseEvent(e as CanvasMouseEventLike);
        const x = e.clientX;
        const y = e.clientY;
        const is_inside =
            !this.viewport ||
            (this.viewport &&
                x >= this.viewport[0] &&
                x < this.viewport[0] + this.viewport[2] &&
                y >= this.viewport[1] &&
                y < this.viewport[1] + this.viewport[3]);
        if (!is_inside) {
            return;
        }

        const pos = [(e as any).canvasX, (e as any).canvasY];
        const node = this.graph ? this.graph.getNodeOnPos(pos[0], pos[1]) : null;

        if (!node) {
            let r = null;
            if (this.onDropItem) {
                r = this.onDropItem(event as Event);
            }
            if (!r) {
                this.checkDropItem(e);
            }
            return;
        }

        if (node.onDropFile || node.onDropData) {
            const files = (e.dataTransfer as DataTransfer).files;
            if (files && files.length) {
                for (let i = 0; i < files.length; i++) {
                    const file = e.dataTransfer!.files[0];
                    const filename = file.name;
                    (this.constructor as any).getFileExtension(filename);

                    if (node.onDropFile) {
                        node.onDropFile(file);
                    }

                    if (node.onDropData) {
                        // prepare reader
                        const reader = new FileReader();
                        reader.onload = function(event): void {
                            const data = event.target!.result;
                            node.onDropData(data, filename, file);
                        };

                        // read data
                        const type = file.type.split("/")[0];
                        if (type == "text" || type == "") {
                            reader.readAsText(file);
                        } else if (type == "image") {
                            reader.readAsDataURL(file);
                        } else {
                            reader.readAsArrayBuffer(file);
                        }
                    }
                }
            }
        }

        if (node.onDropItem) {
            if (node.onDropItem(event as Event)) {
                return;
            }
        }

        if (this.onDropItem) {
            this.onDropItem(event as Event);
            return;
        }
    }

    // called if the graph doesn't have a default drop item behaviour
    checkDropItem(e: DragEvent): void {
        const LiteGraph = this.getLiteGraphHost();
        if ((e.dataTransfer as DataTransfer).files.length) {
            const file = (e.dataTransfer as DataTransfer).files[0];
            const ext = (this.constructor as any).getFileExtension(file.name).toLowerCase();
            const nodetype = LiteGraph.node_types_by_file_extension[ext];
            if (nodetype) {
                this.graph.beforeChange();
                const node = LiteGraph.createNode(nodetype.type) as any;
                node.pos = [(e as any).canvasX, (e as any).canvasY];
                this.graph.add(node);
                if (node.onDropFile) {
                    node.onDropFile(file);
                }
                this.graph.afterChange();
            }
        }
    }

    processNodeDblClicked(n: any): void {
        if (this.onShowNodePanel) {
            this.onShowNodePanel(n);
        } else {
            (this as any).showShowNodePanel(n);
        }

        if (this.onNodeDblClicked) {
            this.onNodeDblClicked(n);
        }
        (this as any).setDirty(true);
    }

    processNodeSelected(node: any, e?: MouseEvent): void {
        this.selectNode(node, !!(e && ((e as any).shiftKey || (e as any).ctrlKey || this.multi_select)));
        if (this.onNodeSelected) {
            this.onNodeSelected(node);
        }
    }

    /**
     * selects a given node (or adds it to the current selection)
     * @method selectNode
     **/
    selectNode(node?: any, add_to_current_selection?: boolean): void {
        if (node == null) {
            this.deselectAllNodes();
        } else {
            this.selectNodes([node], add_to_current_selection);
        }
    }

    /**
     * selects several nodes (or adds them to the current selection)
     * @method selectNodes
     **/
    selectNodes(nodes?: any[], add_to_current_selection?: boolean): void {
        if (!add_to_current_selection) {
            this.deselectAllNodes();
        }

        const sourceNodes = (nodes || this.graph?._nodes || []) as any[];
        if (typeof sourceNodes == "string") {
            return;
        }

        for (const node of sourceNodes) {
            if (node.is_selected) {
                this.deselectNode(node);
                continue;
            }

            if (!node.is_selected && node.onSelected) {
                node.onSelected();
            }
            node.is_selected = true;
            this.selected_nodes[node.id] = node;

            if (node.inputs) {
                for (let j = 0; j < node.inputs.length; ++j) {
                    this.highlighted_links[node.inputs[j].link] = true;
                }
            }
            if (node.outputs) {
                for (let j = 0; j < node.outputs.length; ++j) {
                    const out = node.outputs[j];
                    if (out.links) {
                        for (let k = 0; k < out.links.length; ++k) {
                            this.highlighted_links[out.links[k]] = true;
                        }
                    }
                }
            }
        }

        if (this.onSelectionChange) {
            this.onSelectionChange(this.selected_nodes);
        }
        this.setDirty(true, false);
    }

    /**
     * removes a node from the current selection
     * @method deselectNode
     **/
    deselectNode(node: any): void {
        if (!node.is_selected) {
            return;
        }
        if (node.onDeselected) {
            node.onDeselected();
        }
        node.is_selected = false;

        if (this.onNodeDeselected) {
            this.onNodeDeselected(node);
        }

        // remove highlighted
        if (node.inputs) {
            for (let i = 0; i < node.inputs.length; ++i) {
                delete this.highlighted_links[node.inputs[i].link];
            }
        }
        if (node.outputs) {
            for (let i = 0; i < node.outputs.length; ++i) {
                const out = node.outputs[i];
                if (out.links) {
                    for (let j = 0; j < out.links.length; ++j) {
                        delete this.highlighted_links[out.links[j]];
                    }
                }
            }
        }
    }

    /**
     * removes all nodes from the current selection
     * @method deselectAllNodes
     **/
    deselectAllNodes(): void {
        if (!this.graph) {
            return;
        }
        const nodes = this.graph._nodes;
        for (let i = 0, l = nodes.length; i < l; ++i) {
            const node = nodes[i];
            if (!node.is_selected) {
                continue;
            }
            if (node.onDeselected) {
                node.onDeselected();
            }
            node.is_selected = false;
            if (this.onNodeDeselected) {
                this.onNodeDeselected(node);
            }
        }
        this.selected_nodes = {};
        this.current_node = null;
        this.highlighted_links = {};
        if (this.onSelectionChange) {
            this.onSelectionChange(this.selected_nodes);
        }
        this.setDirty(true, false);
    }

    /**
     * deletes all nodes in the current selection from the graph
     * @method deleteSelectedNodes
     **/
    deleteSelectedNodes(): void {
        const LiteGraph = this.getLiteGraphHost();
        this.graph.beforeChange();

        for (const i in this.selected_nodes) {
            const node = this.selected_nodes[i] as any;
            if (node.block_delete) {
                continue;
            }

            // autoconnect when possible
            if (
                node.inputs &&
                node.inputs.length &&
                node.outputs &&
                node.outputs.length &&
                LiteGraph.isValidConnection(node.inputs[0].type, node.outputs[0].type) &&
                node.inputs[0].link &&
                node.outputs[0].links &&
                node.outputs[0].links.length
            ) {
                const input_link = node.graph.links[node.inputs[0].link];
                const output_link = node.graph.links[node.outputs[0].links[0]];
                const input_node = node.getInputNode(0);
                const output_node = node.getOutputNodes(0)[0];
                if (input_node && output_node) {
                    input_node.connect(input_link.origin_slot, output_node, output_link.target_slot);
                }
            }
            this.graph.remove(node);
            if (this.onNodeDeselected) {
                this.onNodeDeselected(node);
            }
        }
        this.selected_nodes = {};
        this.current_node = null;
        this.highlighted_links = {};
        this.setDirty(true, false);
        this.graph.afterChange();
    }

    /**
     * centers the camera on a given node
     * @method centerOnNode
     **/
    centerOnNode(node: any): void {
        this.ds.offset[0] =
            -node.pos[0] - node.size[0] * 0.5 + ((this.canvas as HTMLCanvasElement).width * 0.5) / this.ds.scale;
        this.ds.offset[1] =
            -node.pos[1] - node.size[1] * 0.5 + ((this.canvas as HTMLCanvasElement).height * 0.5) / this.ds.scale;
        this.setDirty(true, true);
    }

    /**
     * adds some useful properties to a mouse event, like the position in graph coordinates
     * @method adjustMouseEvent
     **/
    adjustMouseEvent(e: CanvasMouseEventLike): void {
        let clientX_rel = 0;
        let clientY_rel = 0;

        if (this.canvas) {
            const b = this.canvas.getBoundingClientRect();
            clientX_rel = e.clientX - b.left;
            clientY_rel = e.clientY - b.top;
        } else {
            clientX_rel = e.clientX;
            clientY_rel = e.clientY;
        }

        this.last_mouse_position[0] = clientX_rel;
        this.last_mouse_position[1] = clientY_rel;

        e.canvasX = clientX_rel / this.ds.scale - this.ds.offset[0];
        e.canvasY = clientY_rel / this.ds.scale - this.ds.offset[1];
    }

    /**
     * changes the zoom level of the graph (default is 1), you can pass also a place used to pivot the zoom
     * @method setZoom
     **/
    setZoom(value: number, zooming_center?: Vector2): void {
        this.ds.changeScale(value, zooming_center);
        this.dirty_canvas = true;
        this.dirty_bgcanvas = true;
    }

    /**
     * converts a coordinate from graph coordinates to canvas2D coordinates
     * @method convertOffsetToCanvas
     **/
    convertOffsetToCanvas(pos: Vector2, out?: Vector2): Vector2 {
        return (this.ds as unknown as { convertOffsetToCanvas: (position: Vector2, output?: Vector2) => Vector2 }).convertOffsetToCanvas(pos, out);
    }

    /**
     * converts a coordinate from Canvas2D coordinates to graph space
     * @method convertCanvasToOffset
     **/
    convertCanvasToOffset(pos: Vector2, out?: Vector2): Vector2 {
        return this.ds.convertCanvasToOffset(pos, out);
    }

    // converts event coordinates from canvas2D to graph coordinates
    convertEventToCanvasOffset(e: MouseEvent): Vector2 {
        const rect = (this.canvas as HTMLCanvasElement).getBoundingClientRect();
        return this.convertCanvasToOffset([e.clientX - rect.left, e.clientY - rect.top]);
    }

    /**
     * brings a node to front (above all other nodes)
     * @method bringToFront
     **/
    bringToFront(node: any): void {
        const i = this.graph._nodes.indexOf(node);
        if (i == -1) {
            return;
        }
        this.graph._nodes.splice(i, 1);
        this.graph._nodes.push(node);
    }

    /**
     * sends a node to the back (below all other nodes)
     * @method sendToBack
     **/
    sendToBack(node: any): void {
        const i = this.graph._nodes.indexOf(node);
        if (i == -1) {
            return;
        }
        this.graph._nodes.splice(i, 1);
        this.graph._nodes.unshift(node);
    }

    /**
     * checks which nodes are visible (inside the camera area)
     * @method computeVisibleNodes
     **/
    computeVisibleNodes(nodes?: any[], out?: any[]): any[] {
        const visible_nodes = out || [];
        visible_nodes.length = 0;
        const sourceNodes = nodes || this.graph._nodes || [];
        for (let i = 0, l = sourceNodes.length; i < l; ++i) {
            const n = sourceNodes[i];

            // skip rendering nodes in live mode
            if (this.live_mode && !n.onDrawBackground && !n.onDrawForeground) {
                continue;
            }

            if (!overlapBounding(this.visible_area as any, n.getBounding(temp, true))) {
                continue;
            }
            visible_nodes.push(n);
        }
        return visible_nodes;
    }
}
