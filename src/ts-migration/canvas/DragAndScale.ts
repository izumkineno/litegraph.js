import type { Vector2, Vector4 } from "../types/core-types";
import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import {
    createPointerEventsHost,
    type PointerEventsHost,
    type TouchNormalizedEvent,
} from "../compat/pointer-events";
import type { DragAndScaleViewportPort } from "../leafer/ViewportController";

type DragAndScaleCallback = (instance: DragAndScale) => void;

interface DragAndScalePointerEvent {
    type: string;
    clientX: number;
    clientY: number;
    deltaY?: number;
    detail?: number;
    wheelDelta?: number;
    wheelDeltaY?: number;
    canvasx?: number;
    canvasy?: number;
    dragging?: boolean;
    eventType?: string;
    wheel?: number;
    delta?: number;
    preventDefault: () => void;
    stopPropagation: () => void;
}

interface DragAndScaleHost {
    pointerevents_method: LiteGraphConstantsShape["pointerevents_method"] | string;
    pointerListenerAdd: PointerEventsHost["pointerListenerAdd"];
    pointerListenerRemove: PointerEventsHost["pointerListenerRemove"];
}

type CanvasElementLike = HTMLElement & {
    width?: number;
    height?: number;
    getBoundingClientRect: () => DOMRect;
};

/**
 * Scale and translate helper for canvas interactions.
 * Source: `function DragAndScale` + `DragAndScale.prototype.*`.
 */
export class DragAndScale {
    static liteGraph?: Partial<DragAndScaleHost>;

    max_scale: number;
    min_scale: number;
    onredraw: DragAndScaleCallback | null;
    enabled: boolean;
    last_mouse: Vector2;
    element: HTMLElement | null;
    visible_area: Vector4;

    viewport?: Vector4;
    dragging?: boolean;
    onmouse?: (e: DragAndScalePointerEvent) => boolean | void;

    private _binded_mouse_callback?:
        | ((event: Event | TouchNormalizedEvent) => unknown)
        | null;
    private pointerHost: PointerEventsHost;
    private _offset: Vector2;
    private _scale: number;
    private viewportPort: DragAndScaleViewportPort | null;
    private readonly viewportOffsetProxy: Vector2;

    constructor(element?: HTMLElement, skipEvents?: boolean) {
        this._offset = new Float32Array([0, 0]) as unknown as Vector2;
        this._scale = 1;
        this.max_scale = 10;
        this.min_scale = 0.1;
        this.onredraw = null;
        this.enabled = true;
        this.last_mouse = [0, 0];
        this.element = null;
        this.visible_area = new Float32Array(4) as unknown as Vector4;
        this.pointerHost = createPointerEventsHost("mouse");
        this.viewportPort = null;
        this.viewportOffsetProxy = this.createViewportOffsetProxy();

        if (element) {
            this.element = element;
            if (!skipEvents) {
                this.bindEvents(element);
            }
        }
    }

    get offset(): Vector2 {
        return this.viewportPort ? this.viewportOffsetProxy : this._offset;
    }

    set offset(value: Vector2) {
        if (this.viewportPort) {
            this.viewportPort.setOffset(value?.[0] || 0, value?.[1] || 0);
            return;
        }

        this._offset[0] = value?.[0] || 0;
        this._offset[1] = value?.[1] || 0;
    }

    get scale(): number {
        return this.viewportPort ? this.viewportPort.getScale() : this._scale;
    }

    set scale(value: number) {
        if (this.viewportPort) {
            this.viewportPort.setScale(value);
            return;
        }

        this._scale = value;
    }

    attachViewportPort(port: DragAndScaleViewportPort): void {
        this.viewportPort = port;
    }

    detachViewportPort(port?: DragAndScaleViewportPort): void {
        if (!port || this.viewportPort === port) {
            this.viewportPort = null;
        }
    }

    private getHost(): DragAndScaleHost {
        const injected = (this.constructor as typeof DragAndScale).liteGraph || {};
        if (injected.pointerevents_method) {
            this.pointerHost.pointerevents_method = injected.pointerevents_method;
        }
        return {
            pointerevents_method:
                injected.pointerevents_method || this.pointerHost.pointerevents_method,
            pointerListenerAdd:
                injected.pointerListenerAdd || this.pointerHost.pointerListenerAdd,
            pointerListenerRemove:
                injected.pointerListenerRemove || this.pointerHost.pointerListenerRemove,
        };
    }

    bindEvents(element: HTMLElement): void {
        if (this.viewportPort) {
            return;
        }
        this.last_mouse = new Float32Array(2) as unknown as Vector2;

        this._binded_mouse_callback = this.onMouse.bind(this) as (
            event: Event | TouchNormalizedEvent
        ) => unknown;

        const host = this.getHost();
        host.pointerListenerAdd(element, "down", this._binded_mouse_callback);
        host.pointerListenerAdd(element, "move", this._binded_mouse_callback);
        host.pointerListenerAdd(element, "up", this._binded_mouse_callback);

        const wheelEventOptions = { passive: false } as AddEventListenerOptions;
        element.addEventListener(
            "wheel",
            this._binded_mouse_callback as EventListener,
            wheelEventOptions
        );
        const wheelCapableElement = element as HTMLElement & { onwheel?: unknown };
        if (typeof wheelCapableElement.onwheel === "undefined") {
            element.addEventListener(
                "mousewheel",
                this._binded_mouse_callback as EventListener,
                wheelEventOptions
            );
        }
    }

    computeVisibleArea(viewport?: Vector4): void {
        const element = this.element as CanvasElementLike | null;
        if (!element) {
            this.visible_area[0] =
                this.visible_area[1] =
                this.visible_area[2] =
                this.visible_area[3] =
                    0;
            return;
        }

        let width = element.width as number;
        let height = element.height as number;
        let startx = -this.offset[0];
        let starty = -this.offset[1];
        if (viewport) {
            startx += viewport[0] / this.scale;
            starty += viewport[1] / this.scale;
            width = viewport[2];
            height = viewport[3];
        }
        const endx = startx + width / this.scale;
        const endy = starty + height / this.scale;
        this.visible_area[0] = startx;
        this.visible_area[1] = starty;
        this.visible_area[2] = endx - startx;
        this.visible_area[3] = endy - starty;
    }

    onMouse(e: DragAndScalePointerEvent): false | void {
        if (!this.enabled) {
            return;
        }
        if (this.viewportPort) {
            return;
        }

        const canvas = this.element as CanvasElementLike;

        const host = this.getHost();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        e.canvasx = x;
        e.canvasy = y;
        e.dragging = this.dragging;

        const is_inside =
            !this.viewport ||
            (x >= this.viewport[0] &&
                x < this.viewport[0] + this.viewport[2] &&
                y >= this.viewport[1] &&
                y < this.viewport[1] + this.viewport[3]);

        let ignore = false;
        if (this.onmouse) {
            ignore = !!this.onmouse(e);
        }

        if (e.type == host.pointerevents_method + "down" && is_inside) {
            this.dragging = true;
            host.pointerListenerRemove(canvas, "move", this._binded_mouse_callback!);
            host.pointerListenerAdd(document, "move", this._binded_mouse_callback!);
            host.pointerListenerAdd(document, "up", this._binded_mouse_callback!);
        } else if (e.type == host.pointerevents_method + "move") {
            if (!ignore) {
                const deltax = x - this.last_mouse[0];
                const deltay = y - this.last_mouse[1];
                if (this.dragging) {
                    this.mouseDrag(deltax, deltay);
                }
            }
        } else if (e.type == host.pointerevents_method + "up") {
            this.dragging = false;
            host.pointerListenerRemove(document, "move", this._binded_mouse_callback!);
            host.pointerListenerRemove(document, "up", this._binded_mouse_callback!);
            host.pointerListenerAdd(canvas, "move", this._binded_mouse_callback!);
        } else if (
            is_inside &&
            (e.type == "mousewheel" || e.type == "wheel" || e.type == "DOMMouseScroll")
        ) {
            e.eventType = "mousewheel";
            if (e.type == "wheel") {
                e.wheel = -e.deltaY!;
            } else {
                e.wheel = e.wheelDeltaY != null ? e.wheelDeltaY : e.detail! * -60;
            }

            // from stack overflow
            e.delta = e.wheelDelta
                ? e.wheelDelta / 40
                : e.deltaY
                  ? -e.deltaY / 3
                  : 0;
            this.changeDeltaScale(1.0 + e.delta * 0.05);
        }

        this.last_mouse[0] = x;
        this.last_mouse[1] = y;

        if (is_inside) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }

    toCanvasContext(ctx: CanvasRenderingContext2D): void {
        ctx.scale(this.scale, this.scale);
        ctx.translate(this.offset[0], this.offset[1]);
    }

    convertOffsetToCanvas(pos: Vector2): Vector2 {
        // return [pos[0] / this.scale - this.offset[0], pos[1] / this.scale - this.offset[1]];
        return [
            (pos[0] + this.offset[0]) * this.scale,
            (pos[1] + this.offset[1]) * this.scale,
        ];
    }

    convertCanvasToOffset(pos: Vector2, out?: Vector2): Vector2 {
        const target = out || ([0, 0] as Vector2);
        target[0] = pos[0] / this.scale - this.offset[0];
        target[1] = pos[1] / this.scale - this.offset[1];
        return target;
    }

    mouseDrag(x: number, y: number): void {
        if (this.viewportPort) {
            this.viewportPort.moveByScreenDelta(x, y);
            if (this.onredraw) {
                this.onredraw(this);
            }
            return;
        }

        this.offset[0] += x / this.scale;
        this.offset[1] += y / this.scale;

        if (this.onredraw) {
            this.onredraw(this);
        }
    }

    changeScale(value: number, zooming_center?: Vector2): void {
        if (value < this.min_scale) {
            value = this.min_scale;
        } else if (value > this.max_scale) {
            value = this.max_scale;
        }

        if (value == this.scale) {
            return;
        }

        if (this.viewportPort) {
            this.viewportPort.setScale(value, zooming_center);
            if (this.onredraw) {
                this.onredraw(this);
            }
            return;
        }

        const element = this.element as CanvasElementLike | null;
        if (!element) {
            return;
        }

        const rect = element.getBoundingClientRect();
        if (!rect) {
            return;
        }

        const centerOnCanvas = zooming_center || ([rect.width * 0.5, rect.height * 0.5] as Vector2);
        const center = this.convertCanvasToOffset(centerOnCanvas);
        this.scale = value;
        if (Math.abs(this.scale - 1) < 0.01) {
            this.scale = 1;
        }

        const new_center = this.convertCanvasToOffset(centerOnCanvas);
        const delta_offset: Vector2 = [
            new_center[0] - center[0],
            new_center[1] - center[1],
        ];

        this.offset[0] += delta_offset[0];
        this.offset[1] += delta_offset[1];

        if (this.onredraw) {
            this.onredraw(this);
        }
    }

    changeDeltaScale(value: number, zooming_center?: Vector2): void {
        this.changeScale(this.scale * value, zooming_center);
    }

    reset(): void {
        if (this.viewportPort) {
            this.viewportPort.reset();
            return;
        }

        this.scale = 1;
        this.offset[0] = 0;
        this.offset[1] = 0;
    }

    private createViewportOffsetProxy(): Vector2 {
        const target = [0, 0];

        return new Proxy(target, {
            get: (source, property, receiver) => {
                source[0] = this.viewportPort
                    ? this.viewportPort.getOffsetX()
                    : this._offset[0];
                source[1] = this.viewportPort
                    ? this.viewportPort.getOffsetY()
                    : this._offset[1];
                return Reflect.get(source, property, receiver);
            },
            set: (source, property, value, receiver) => {
                if (property === "0") {
                    const nextX = Number.isFinite(Number(value))
                        ? Number(value)
                        : 0;
                    if (this.viewportPort) {
                        this.viewportPort.setOffset(
                            nextX,
                            this.viewportPort.getOffsetY()
                        );
                    } else {
                        this._offset[0] = nextX;
                    }
                    source[0] = nextX;
                    return true;
                }

                if (property === "1") {
                    const nextY = Number.isFinite(Number(value))
                        ? Number(value)
                        : 0;
                    if (this.viewportPort) {
                        this.viewportPort.setOffset(
                            this.viewportPort.getOffsetX(),
                            nextY
                        );
                    } else {
                        this._offset[1] = nextY;
                    }
                    source[1] = nextY;
                    return true;
                }

                return Reflect.set(source, property, value, receiver);
            },
        }) as unknown as Vector2;
    }
}
