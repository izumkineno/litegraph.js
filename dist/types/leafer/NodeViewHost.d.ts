import type { Group } from "leafer-ui";
import type { GraphMutationNodeLike } from "./GraphMutationBus";
export type NodeViewRuntime = "legacy" | "modern";
export type NodeViewPortKind = "input" | "output";
export interface NodeViewPortHit {
    readonly kind: NodeViewPortKind;
    readonly slotIndex: number;
    readonly anchor: readonly [number, number];
    readonly dir?: number;
}
export interface NodeViewHost {
    readonly runtime: NodeViewRuntime;
    readonly node: GraphMutationNodeLike;
    readonly root: Group;
    repaint(): void;
    syncPosition(): void;
    destroy(): void;
    getPortAnchor?(kind: NodeViewPortKind, slotIndex: number): readonly [number, number] | null;
    getPortDirection?(kind: NodeViewPortKind, slotIndex: number): number | null;
    hitPortAt?(worldX: number, worldY: number): NodeViewPortHit | null;
}
