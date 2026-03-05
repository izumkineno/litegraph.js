// TODO: Import LiteGraph runtime host from its future module

export type PointerEventsMethod = "mouse" | "pointer" | "touch";
export type SemanticPointerEvent =
    | "down"
    | "move"
    | "up"
    | "over"
    | "out"
    | "enter"
    | "leave"
    | "cancel"
    | "gotpointercapture"
    | "lostpointercapture";

type PointerEventName = SemanticPointerEvent | string;

type ListenerFn = (event: Event | TouchNormalizedEvent) => unknown;

interface ListenerRegistryEntry {
    original: ListenerFn;
    wrapped: ListenerFn;
}

type ListenerRegistryBucket = Record<string, ListenerRegistryEntry[]>;

interface ResolvedPointerEventName {
    dom_event: string;
    use_touch_wrapper: boolean;
}

export interface TouchNormalizedEvent {
    type: string;
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
    screenX: number;
    screenY: number;
    which: number;
    button: number;
    buttons: number;
    isPrimary: boolean;
    pointerId: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    target: EventTarget | null;
    originalEvent: TouchEvent;
    preventDefault: () => void;
    stopPropagation: () => void;
    stopImmediatePropagation: () => void;
}

export interface PointerEventsHost {
    pointerevents_method: PointerEventsMethod | string;
    _pointer_listener_registry: WeakMap<EventTarget, ListenerRegistryBucket>;
    _normalizeTouchEvent: (e: TouchEvent) => TouchNormalizedEvent | null;
    _resolvePointerEventName: (
        event_name: PointerEventName
    ) => ResolvedPointerEventName | null;
    _pointerListenerOptions: (dom_event: string, capture: boolean) => boolean | AddEventListenerOptions;
    pointerListenerAdd: (
        oDOM: EventTarget | null | undefined,
        sEvIn: PointerEventName,
        fCall: ListenerFn,
        capture?: boolean
    ) => void;
    pointerListenerRemove: (
        oDOM: EventTarget | null | undefined,
        sEvent: PointerEventName,
        fCall: ListenerFn,
        capture?: boolean
    ) => void;
}

function isTouchEvent(event: Event | TouchNormalizedEvent): event is TouchEvent {
    if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
        return true;
    }
    const maybeTouch = event as Partial<TouchEvent>;
    return (
        !!maybeTouch &&
        typeof maybeTouch === "object" &&
        ("changedTouches" in maybeTouch || "touches" in maybeTouch)
    );
}

/**
 * helper for interaction: pointer, touch, mouse Listeners
 * used by LGraphCanvas DragAndScale ContextMenu
 */
export function createPointerEventsHost(
    pointerevents_method: PointerEventsMethod | string = "mouse"
): PointerEventsHost {
    const host = {
        pointerevents_method,
        _pointer_listener_registry: new WeakMap<EventTarget, ListenerRegistryBucket>(),
        _normalizeTouchEvent,
        _resolvePointerEventName(event_name: PointerEventName): ResolvedPointerEventName | null {
            return resolvePointerEventName(host, event_name);
        },
        _pointerListenerOptions,
        pointerListenerAdd(
            oDOM: EventTarget | null | undefined,
            sEvIn: PointerEventName,
            fCall: ListenerFn,
            capture = false
        ): void {
            pointerListenerAdd(host, oDOM, sEvIn, fCall, capture);
        },
        pointerListenerRemove(
            oDOM: EventTarget | null | undefined,
            sEvent: PointerEventName,
            fCall: ListenerFn,
            capture = false
        ): void {
            pointerListenerRemove(host, oDOM, sEvent, fCall, capture);
        },
    };

    return host;
}

export function _normalizeTouchEvent(e: TouchEvent): TouchNormalizedEvent | null {
    const touch =
        (e.changedTouches && e.changedTouches.length && e.changedTouches[0]) ||
        (e.touches && e.touches.length && e.touches[0]);
    if (!touch) {
        return null;
    }
    return {
        type: e.type,
        clientX: touch.clientX,
        clientY: touch.clientY,
        pageX: touch.pageX,
        pageY: touch.pageY,
        screenX: touch.screenX,
        screenY: touch.screenY,
        which: 1,
        button: 0,
        buttons: e.type == "touchend" || e.type == "touchcancel" ? 0 : 1,
        isPrimary: true,
        pointerId: touch.identifier || 1,
        shiftKey: !!e.shiftKey,
        ctrlKey: !!e.ctrlKey,
        altKey: !!e.altKey,
        metaKey: !!e.metaKey,
        target: e.target,
        originalEvent: e,
        preventDefault: function(): void {
            if (e.cancelable && e.preventDefault) {
                e.preventDefault();
            }
        },
        stopPropagation: function(): void {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
        },
        stopImmediatePropagation: function(): void {
            if (e.stopImmediatePropagation) {
                e.stopImmediatePropagation();
            }
        },
    };
}

export function resolvePointerEventName(
    host: Pick<PointerEventsHost, "pointerevents_method">,
    event_name: PointerEventName
): ResolvedPointerEventName | null {
    const requested = String(event_name || "").toLowerCase();
    let method = host.pointerevents_method || "mouse";
    if (
        method == "pointer" &&
        (typeof window === "undefined" || !window.PointerEvent)
    ) {
        method = "touch";
    }

    const maps = {
        mouse: {
            down: "mousedown",
            move: "mousemove",
            up: "mouseup",
            over: "mouseover",
            out: "mouseout",
            enter: "mouseenter",
            leave: "mouseleave",
            cancel: "mouseup",
        },
        pointer: {
            down: "pointerdown",
            move: "pointermove",
            up: "pointerup",
            over: "pointerover",
            out: "pointerout",
            enter: "pointerenter",
            leave: "pointerleave",
            cancel: "pointercancel",
            gotpointercapture: "gotpointercapture",
            lostpointercapture: "lostpointercapture",
        },
        touch: {
            down: "touchstart",
            move: "touchmove",
            up: "touchend",
            cancel: "touchcancel",
        },
    } as const;

    if (
        requested.indexOf("mouse") === 0 ||
        requested.indexOf("pointer") === 0 ||
        requested.indexOf("touch") === 0
    ) {
        return {
            dom_event: requested,
            use_touch_wrapper: requested.indexOf("touch") === 0,
        };
    }

    const map = maps[(method as keyof typeof maps) || "mouse"] || maps.mouse;
    let dom_event: string | undefined = map[requested as keyof typeof map];
    if (!dom_event) {
        if (
            method == "touch" &&
            (requested == "enter" ||
                requested == "leave" ||
                requested == "over" ||
                requested == "out")
        ) {
            return null;
        }
        dom_event = requested;
    }

    return {
        dom_event,
        use_touch_wrapper: dom_event.indexOf("touch") === 0,
    };
}

export function _pointerListenerOptions(
    dom_event: string,
    capture: boolean
): boolean | AddEventListenerOptions {
    if (dom_event && dom_event.indexOf("touch") === 0) {
        return { capture: !!capture, passive: false };
    }
    return !!capture;
}

export function pointerListenerAdd(
    host: PointerEventsHost,
    oDOM: EventTarget | null | undefined,
    sEvIn: PointerEventName,
    fCall: ListenerFn,
    capture = false
): void {
    if (
        !oDOM ||
        !("addEventListener" in oDOM) ||
        !sEvIn ||
        typeof fCall !== "function"
    ) {
        return; // -- break --
    }

    const resolved = host._resolvePointerEventName(sEvIn);
    if (!resolved || !resolved.dom_event) {
        return;
    }

    const dom_event = resolved.dom_event;
    let registry = host._pointer_listener_registry.get(oDOM);
    if (!registry) {
        registry = {};
        host._pointer_listener_registry.set(oDOM, registry);
    }
    const key = dom_event + "|" + (capture ? "1" : "0");
    if (!registry[key]) {
        registry[key] = [];
    }

    const existing = registry[key].find((entry) => entry.original === fCall);
    if (existing) {
        return;
    }

    let wrapped = fCall;
    if (resolved.use_touch_wrapper) {
        const semantic_event = String(sEvIn || "").toLowerCase();
        wrapped = function(this: unknown, ev: Event | TouchNormalizedEvent): unknown {
            if (!isTouchEvent(ev)) {
                return;
            }
            const normalized = host._normalizeTouchEvent(ev);
            if (!normalized) {
                return;
            }
            if (
                semantic_event == "down" ||
                semantic_event == "move" ||
                semantic_event == "up" ||
                semantic_event == "cancel" ||
                semantic_event == "enter" ||
                semantic_event == "leave" ||
                semantic_event == "over" ||
                semantic_event == "out" ||
                semantic_event == "gotpointercapture" ||
                semantic_event == "lostpointercapture"
            ) {
                normalized.type = (host.pointerevents_method || "mouse") + semantic_event;
            }
            return fCall.call(this, normalized);
        };
    }

    registry[key].push({
        original: fCall,
        wrapped,
    });

    (oDOM as EventTarget & { addEventListener: EventTarget["addEventListener"] }).addEventListener(
        dom_event,
        wrapped as EventListener,
        host._pointerListenerOptions(dom_event, capture)
    );
}

export function pointerListenerRemove(
    host: PointerEventsHost,
    oDOM: EventTarget | null | undefined,
    sEvent: PointerEventName,
    fCall: ListenerFn,
    capture = false
): void {
    if (
        !oDOM ||
        !("removeEventListener" in oDOM) ||
        !sEvent ||
        typeof fCall !== "function"
    ) {
        return; // -- break --
    }

    const resolved = host._resolvePointerEventName(sEvent);
    if (!resolved || !resolved.dom_event) {
        return;
    }
    const dom_event = resolved.dom_event;
    const key = dom_event + "|" + (capture ? "1" : "0");
    let wrapped = fCall;

    const registry = host._pointer_listener_registry.get(oDOM);
    if (registry && registry[key]) {
        const index = registry[key].findIndex((entry) => entry.original === fCall);
        if (index >= 0) {
            wrapped = registry[key][index].wrapped;
            registry[key].splice(index, 1);
        }
    }

    (oDOM as EventTarget & { removeEventListener: EventTarget["removeEventListener"] }).removeEventListener(
        dom_event,
        wrapped as EventListener,
        host._pointerListenerOptions(dom_event, capture)
    );
}
