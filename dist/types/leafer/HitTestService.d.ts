import type { GraphMutationGraphLike, GraphMutationNodeLike } from "./GraphMutationBus";
import type { NodeViewHost } from "./NodeViewHost";
import type { SceneSyncController } from "./SceneSyncController";
interface GraphHitTestGraphLike extends GraphMutationGraphLike {
    getNodeOnPos?: (x: number, y: number, visibleNodes?: GraphMutationNodeLike[], margin?: number) => GraphMutationNodeLike | null;
}
export interface NodeHitResult {
    readonly node: GraphMutationNodeLike;
    readonly host: NodeViewHost;
}
export declare class HitTestService {
    private readonly graph;
    private readonly sceneSyncController;
    constructor(graph: GraphHitTestGraphLike, sceneSyncController: SceneSyncController);
    hitNodeAt(canvasX: number, canvasY: number): NodeHitResult | null;
    getHostForNode(node: GraphMutationNodeLike | null | undefined): NodeViewHost | null;
}
export {};
