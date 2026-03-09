import type { GraphMutationGraphLike, GraphMutationLinkLike, GraphMutationNodeId, GraphMutationNodeLike } from "./GraphMutationBus";
import type { NodeViewHost } from "./NodeViewHost";
export declare const PORT_DIRECTION_UP = 1;
export declare const PORT_DIRECTION_RIGHT = 2;
export declare const PORT_DIRECTION_DOWN = 3;
export declare const PORT_DIRECTION_LEFT = 4;
export type NodePortKind = "input" | "output";
export interface NodePortSlotLike {
    type?: unknown;
    dir?: number;
    shape?: unknown;
    link?: number | string | null;
    links?: Array<number | string> | null;
    [key: string]: unknown;
}
export interface NodePortNodeLike extends GraphMutationNodeLike {
    pos: [number, number];
    size: [number, number];
    horizontal?: boolean;
    inputs?: NodePortSlotLike[];
    outputs?: NodePortSlotLike[];
    getSlotInPosition?: (x: number, y: number) => {
        input?: NodePortSlotLike;
        output?: NodePortSlotLike;
        slot: number;
        link_pos: [number, number];
    } | null;
    getConnectionPos?: (isInput: boolean, slot: number, out?: [number, number]) => [number, number];
    getBounding?: (out?: Float32Array | [number, number, number, number], computeOuter?: boolean) => [number, number, number, number];
    connect?: (slot: number, target: NodePortNodeLike | number | string, targetSlot?: number) => GraphMutationLinkLike | null;
    alignToGrid?: () => void;
    [key: string]: unknown;
}
interface NodePortGraphLike extends GraphMutationGraphLike {
    _nodes?: NodePortNodeLike[];
    getNodeById?: (id: GraphMutationNodeId) => NodePortNodeLike | null;
    getNodeOnPos?: (x: number, y: number, visibleNodes?: NodePortNodeLike[], margin?: number) => NodePortNodeLike | null;
}
export interface NodePortHit {
    readonly node: NodePortNodeLike;
    readonly nodeId: GraphMutationNodeId;
    readonly kind: NodePortKind;
    readonly slotIndex: number;
    readonly slot: NodePortSlotLike;
    readonly anchor: readonly [number, number];
    readonly dir: number;
}
export interface LinkEndpointLayout {
    readonly start: readonly [number, number];
    readonly end: readonly [number, number];
    readonly startDir: number;
    readonly endDir: number;
}
export interface LinkCurveGeometry extends LinkEndpointLayout {
    readonly c1: readonly [number, number];
    readonly c2: readonly [number, number];
    readonly path: string;
}
export interface NodePortAdapterOptions {
    resolveNodeHost?: (nodeId: GraphMutationNodeId) => NodeViewHost | null;
}
export declare function getOppositePortDirection(direction: number): number;
export declare class NodePortAdapter {
    private readonly graph;
    private readonly options;
    constructor(graph: NodePortGraphLike, options?: NodePortAdapterOptions);
    getNodeById(nodeId: GraphMutationNodeId): NodePortNodeLike | null;
    getNodeAt(x: number, y: number): NodePortNodeLike | null;
    hitPortAt(x: number, y: number): NodePortHit | null;
    getPortAnchor(nodeId: GraphMutationNodeId, kind: NodePortKind, slotIndex: number): [number, number];
    getPortDirection(node: NodePortNodeLike, kind: NodePortKind, slotIndex: number, slot?: NodePortSlotLike | null): number;
    getLinkLayout(link: GraphMutationLinkLike): LinkEndpointLayout | null;
    getLinkCurve(link: GraphMutationLinkLike): LinkCurveGeometry | null;
    buildLinkCurve(start: readonly [number, number], end: readonly [number, number], startDir: number, endDir: number): LinkCurveGeometry;
    buildLinkPath(start: readonly [number, number], end: readonly [number, number], startDir: number, endDir: number): string;
    getPointOnLinkCurve(curve: LinkCurveGeometry, t: number): readonly [number, number];
}
export {};
