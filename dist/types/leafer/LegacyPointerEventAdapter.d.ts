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
    getPagePoint: () => {
        x: number;
        y: number;
    };
    getWorldPoint: () => {
        x: number;
        y: number;
    };
    getInnerPoint: (relative?: Group) => {
        x: number;
        y: number;
    };
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
    getLocalPos: (nodeId: GraphMutationNodeId) => readonly [number, number] | null;
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
export type NativeContextMenuEvent = MouseEvent & Pick<LegacyPointerEventLike, "canvasX" | "canvasY" | "offsetX" | "offsetY" | "which" | "click_time" | "dragging" | "localPosByNodeId" | "getLocalPos" | "originalEvent">;
export interface CreateNativeContextMenuEventOptions {
    readonly event: LegacyPointerEventLike | LegacyPointerEventSource;
    readonly hostElement: HTMLElement;
    readonly nativeEvent?: MouseEvent | PointerEvent | null;
    readonly targets?: readonly LegacyPointerTarget[];
    readonly clickTime?: number;
    readonly dragging?: boolean;
}
export declare function createLegacyPointerEvent(options: CreateLegacyPointerEventOptions): LegacyPointerEventLike;
export declare function createNativeContextMenuEvent(options: CreateNativeContextMenuEventOptions): NativeContextMenuEvent;
export declare function isLegacyPointerEvent(value: unknown): value is LegacyPointerEventLike;
export declare function getLegacyLocalPos(event: LegacyPointerEventLike, nodeId: GraphMutationNodeId, fallback: readonly [number, number]): readonly [number, number];
