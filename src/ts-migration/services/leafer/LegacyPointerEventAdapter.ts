import type { Group } from "leafer-ui";

import type { GraphMutationNodeId } from "./GraphMutationBus";

export interface LegacyPointerTarget {
    readonly nodeId: GraphMutationNodeId;
    readonly nodeRoot: Group;
    readonly nodePosition?: readonly [number, number];
}

export interface LegacyPointerEventSource {
    readonly altKey?: boolean;
    readonly ctrlKey?: boolean;
    readonly shiftKey?: boolean;
    readonly metaKey?: boolean;
    readonly buttons?: number;
    readonly target?: unknown;
    readonly current?: unknown;
    readonly time?: number;
    readonly clientX?: number;
    readonly clientY?: number;
    readonly pageX?: number;
    readonly pageY?: number;
    readonly screenX?: number;
    readonly screenY?: number;
    readonly left?: boolean;
    readonly middle?: boolean;
    readonly right?: boolean;
    getPagePoint: () => { x: number; y: number };
    getInnerPoint: (relative?: Group) => { x: number; y: number };
    stop?: () => void;
    stopNow?: () => void;
}

export interface LegacyPointerEventLike {
    readonly __isLeaferLegacyPointerEvent: true;
    readonly type: "mousedown" | "mousemove" | "mouseup";
    readonly canvasX: number;
    readonly canvasY: number;
    readonly pageX: number;
    readonly pageY: number;
    readonly clientX: number;
    readonly clientY: number;
    readonly screenX: number;
    readonly screenY: number;
    readonly offsetX: number;
    readonly offsetY: number;
    readonly deltaX: number;
    readonly deltaY: number;
    readonly deltax: number;
    readonly deltay: number;
    readonly which: number;
    readonly button: number;
    readonly buttons: number;
    readonly click_time: number;
    readonly dragging: boolean;
    readonly shiftKey: boolean;
    readonly ctrlKey: boolean;
    readonly altKey: boolean;
    readonly metaKey: boolean;
    readonly isPrimary: boolean;
    readonly target: unknown;
    readonly currentTarget: unknown;
    readonly originalEvent: unknown;
    readonly localPosByNodeId: ReadonlyMap<string, readonly [number, number]>;
    getLocalPos: (
        nodeId: GraphMutationNodeId
    ) => readonly [number, number] | null;
    preventDefault: () => void;
    stopPropagation: () => void;
    stopImmediatePropagation: () => void;
}

export interface CreateLegacyPointerEventOptions {
    readonly event: LegacyPointerEventSource;
    readonly type: "down" | "move" | "up";
    readonly hostElement: HTMLElement;
    readonly targets?: readonly LegacyPointerTarget[];
    readonly clickTime?: number;
    readonly dragging?: boolean;
    readonly deltaX?: number;
    readonly deltaY?: number;
}

export type NativeContextMenuEvent = MouseEvent &
    Pick<
        LegacyPointerEventLike,
        | "canvasX"
        | "canvasY"
        | "offsetX"
        | "offsetY"
        | "which"
        | "click_time"
        | "dragging"
        | "localPosByNodeId"
        | "getLocalPos"
        | "originalEvent"
    >;

export interface CreateNativeContextMenuEventOptions {
    readonly event: LegacyPointerEventLike | LegacyPointerEventSource;
    readonly hostElement: HTMLElement;
    readonly nativeEvent?: MouseEvent | PointerEvent | null;
    readonly targets?: readonly LegacyPointerTarget[];
    readonly clickTime?: number;
    readonly dragging?: boolean;
}

function toMutationKey(nodeId: GraphMutationNodeId): string {
    return String(nodeId);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function resolveMouseType(
    type: CreateLegacyPointerEventOptions["type"]
): "mousedown" | "mousemove" | "mouseup" {
    if (type === "down") {
        return "mousedown";
    }
    if (type === "move") {
        return "mousemove";
    }
    return "mouseup";
}

function resolveButtons(event: LegacyPointerEventSource): number {
    return toFiniteNumber((event as { buttons?: number }).buttons);
}

function resolveButton(event: LegacyPointerEventSource): number {
    const pointerEvent = event as LegacyPointerEventSource & {
        left?: boolean;
        middle?: boolean;
        right?: boolean;
    };

    if (pointerEvent.left) {
        return 0;
    }
    if (pointerEvent.middle) {
        return 1;
    }
    if (pointerEvent.right) {
        return 2;
    }

    const buttons = resolveButtons(event);
    if (buttons & 1) {
        return 0;
    }
    if (buttons & 4) {
        return 1;
    }
    if (buttons & 2) {
        return 2;
    }

    return 0;
}

function resolveWhich(button: number): number {
    return button + 1;
}

function buildLocalPosMap(
    event: LegacyPointerEventSource,
    targets: readonly LegacyPointerTarget[]
): Map<string, readonly [number, number]> {
    const localPosByNodeId = new Map<string, readonly [number, number]>();
    const pagePoint = event.getPagePoint();
    const pageX = toFiniteNumber(pagePoint.x);
    const pageY = toFiniteNumber(pagePoint.y);

    for (let i = 0; i < targets.length; ++i) {
        const target = targets[i];
        if (target.nodePosition) {
            localPosByNodeId.set(toMutationKey(target.nodeId), [
                pageX - toFiniteNumber(target.nodePosition[0]),
                pageY - toFiniteNumber(target.nodePosition[1]),
            ]);
            continue;
        }

        const localPoint = event.getInnerPoint(target.nodeRoot);
        localPosByNodeId.set(toMutationKey(target.nodeId), [
            toFiniteNumber(localPoint.x),
            toFiniteNumber(localPoint.y),
        ]);
    }

    return localPosByNodeId;
}

export function createLegacyPointerEvent(
    options: CreateLegacyPointerEventOptions
): LegacyPointerEventLike {
    const { event, hostElement } = options;
    const pagePoint = event.getPagePoint();
    const canvasX = toFiniteNumber(pagePoint.x);
    const canvasY = toFiniteNumber(pagePoint.y);
    const hostRect = hostElement.getBoundingClientRect();
    const clientX = toFiniteNumber(event.clientX, hostRect.left + canvasX);
    const clientY = toFiniteNumber(event.clientY, hostRect.top + canvasY);
    const button = resolveButton(event);
    const buttons = resolveButtons(event);
    const localPosByNodeId = buildLocalPosMap(event, options.targets || []);
    const stop = (): void => {
        event.stop?.();
    };
    const stopNow = (): void => {
        if (typeof event.stopNow === "function") {
            event.stopNow();
            return;
        }
        stop();
    };

    return {
        __isLeaferLegacyPointerEvent: true,
        type: resolveMouseType(options.type),
        canvasX,
        canvasY,
        pageX: toFiniteNumber(event.pageX, clientX),
        pageY: toFiniteNumber(event.pageY, clientY),
        clientX,
        clientY,
        screenX: toFiniteNumber(event.screenX, clientX),
        screenY: toFiniteNumber(event.screenY, clientY),
        offsetX: canvasX,
        offsetY: canvasY,
        deltaX: toFiniteNumber(options.deltaX),
        deltaY: toFiniteNumber(options.deltaY),
        deltax: toFiniteNumber(options.deltaX),
        deltay: toFiniteNumber(options.deltaY),
        which: resolveWhich(button),
        button,
        buttons,
        click_time: Math.max(0, toFiniteNumber(options.clickTime)),
        dragging: Boolean(options.dragging),
        shiftKey: Boolean(event.shiftKey),
        ctrlKey: Boolean(event.ctrlKey),
        altKey: Boolean(event.altKey),
        metaKey: Boolean(event.metaKey),
        isPrimary: true,
        target: event.target,
        currentTarget: event.current,
        originalEvent: event,
        localPosByNodeId,
        getLocalPos: (nodeId) => {
            return localPosByNodeId.get(toMutationKey(nodeId)) || null;
        },
        preventDefault: () => {},
        stopPropagation: stop,
        stopImmediatePropagation: stopNow,
    };
}

function defineContextMenuBridgeProps(
    event: MouseEvent,
    legacyEvent: LegacyPointerEventLike,
    nativeEvent?: MouseEvent | PointerEvent | null
): NativeContextMenuEvent {
    Object.defineProperties(event, {
        canvasX: {
            configurable: true,
            enumerable: true,
            value: legacyEvent.canvasX,
        },
        canvasY: {
            configurable: true,
            enumerable: true,
            value: legacyEvent.canvasY,
        },
        offsetX: {
            configurable: true,
            enumerable: true,
            value: legacyEvent.offsetX,
        },
        offsetY: {
            configurable: true,
            enumerable: true,
            value: legacyEvent.offsetY,
        },
        which: {
            configurable: true,
            enumerable: true,
            value: legacyEvent.which,
        },
        click_time: {
            configurable: true,
            enumerable: true,
            value: legacyEvent.click_time,
        },
        dragging: {
            configurable: true,
            enumerable: true,
            value: legacyEvent.dragging,
        },
        localPosByNodeId: {
            configurable: true,
            enumerable: true,
            value: legacyEvent.localPosByNodeId,
        },
        getLocalPos: {
            configurable: true,
            enumerable: false,
            value: legacyEvent.getLocalPos,
        },
        originalEvent: {
            configurable: true,
            enumerable: false,
            value: nativeEvent || legacyEvent.originalEvent,
        },
    });

    return event as NativeContextMenuEvent;
}

export function createNativeContextMenuEvent(
    options: CreateNativeContextMenuEventOptions
): NativeContextMenuEvent {
    const legacyEvent = isLegacyPointerEvent(options.event)
        ? options.event
        : createLegacyPointerEvent({
              event: options.event,
              type: "down",
              hostElement: options.hostElement,
              targets: options.targets,
              clickTime: options.clickTime,
              dragging: options.dragging,
              deltaX: 0,
              deltaY: 0,
          });
    const windowRef =
        options.hostElement.ownerDocument?.defaultView || window;
    const MouseEventCtor = windowRef.MouseEvent || MouseEvent;
    const menuEvent = new MouseEventCtor("contextmenu", {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: windowRef,
        button: legacyEvent.button,
        buttons: legacyEvent.buttons,
        clientX: legacyEvent.clientX,
        clientY: legacyEvent.clientY,
        screenX: legacyEvent.screenX,
        screenY: legacyEvent.screenY,
        ctrlKey: legacyEvent.ctrlKey,
        shiftKey: legacyEvent.shiftKey,
        altKey: legacyEvent.altKey,
        metaKey: legacyEvent.metaKey,
    });

    return defineContextMenuBridgeProps(
        menuEvent,
        legacyEvent,
        options.nativeEvent
    );
}

export function isLegacyPointerEvent(
    value: unknown
): value is LegacyPointerEventLike {
    return Boolean(
        value &&
            typeof value === "object" &&
            (value as { __isLeaferLegacyPointerEvent?: boolean })
                .__isLeaferLegacyPointerEvent
    );
}

export function getLegacyLocalPos(
    event: LegacyPointerEventLike,
    nodeId: GraphMutationNodeId,
    fallback: readonly [number, number]
): readonly [number, number] {
    return event.getLocalPos(nodeId) || fallback;
}
