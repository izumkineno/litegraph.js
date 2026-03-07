import type {
    GraphMutationGraphLike,
    GraphMutationNodeLike,
} from "./GraphMutationBus";
import type { NodeViewHost } from "./NodeViewHost";
import type { SceneSyncController } from "./SceneSyncController";

interface GraphHitTestGraphLike extends GraphMutationGraphLike {
    getNodeOnPos?: (
        x: number,
        y: number,
        visibleNodes?: GraphMutationNodeLike[],
        margin?: number
    ) => GraphMutationNodeLike | null;
}

export interface NodeHitResult {
    readonly node: GraphMutationNodeLike;
    readonly host: NodeViewHost;
}

export class HitTestService {
    constructor(
        private readonly graph: GraphHitTestGraphLike,
        private readonly sceneSyncController: SceneSyncController
    ) {}

    hitNodeAt(
        canvasX: number,
        canvasY: number
    ): NodeHitResult | null {
        if (typeof this.graph.getNodeOnPos !== "function") {
            return null;
        }

        const node = this.graph.getNodeOnPos(canvasX, canvasY, undefined, 5);
        if (!node) {
            return null;
        }

        const host = this.sceneSyncController.nodeHosts.get(node.id);
        if (!host) {
            return null;
        }

        return { node, host };
    }

    getHostForNode(
        node: GraphMutationNodeLike | null | undefined
    ): NodeViewHost | null {
        if (!node) {
            return null;
        }
        return this.sceneSyncController.nodeHosts.get(node.id) || null;
    }
}
