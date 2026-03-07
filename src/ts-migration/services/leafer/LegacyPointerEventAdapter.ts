import type { Group } from "leafer-ui";

import type { GraphMutationNodeId } from "./GraphMutationBus";

export interface LegacyPointerTarget {
    readonly nodeId: GraphMutationNodeId;
    readonly nodeRoot: Group;
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

function toMutationKey(nodeId: GraphMutationNodeId): string {
    return String(nodeId);
}

function toFiniteNumber(value: unknown): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
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

function buildLocalPosMap(event: LegacyPointerEventSource, targets: readonly LegacyPointerTarget[]): Map<string, readonly [number, number]> {
    const localPosByNodeId = new Map<string, readonly [number, number]>();

    for (let i = 0; i < targets.length; ++i) {
        const target = targets[i];
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
    const clientX = hostRect.left + canvasX;
    const clientY = hostRect.top + canvasY;
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
        pageX: canvasX,
        pageY: canvasY,
        clientX,
        clientY,
        screenX: clientX,
        screenY: clientY,
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
