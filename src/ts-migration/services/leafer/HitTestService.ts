import type {
    GraphMutationGraphLike,
    GraphMutationNodeLike,
} from "./GraphMutationBus";
import type { LegacyNodeHost } from "./LegacyNodeHost";
import type { SceneSyncController } from "./SceneSyncController";

interface GraphHitTestGraphLike extends GraphMutationGraphLike {
    getNodeOnPos?: (
        x: number,
        y: number,
        visibleNodes?: GraphMutationNodeLike[],
        margin?: number
    ) => GraphMutationNodeLike | null;
}

export interface LegacyNodeHitResult {
    readonly node: GraphMutationNodeLike;
    readonly host: LegacyNodeHost;
}

export class HitTestService {
    constructor(
        private readonly graph: GraphHitTestGraphLike,
        private readonly sceneSyncController: SceneSyncController
    ) {}

    hitLegacyNodeAt(
        canvasX: number,
        canvasY: number
    ): LegacyNodeHitResult | null {
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

    getLegacyHostForNode(
        node: GraphMutationNodeLike | null | undefined
    ): LegacyNodeHost | null {
        if (!node) {
            return null;
        }
        return this.sceneSyncController.nodeHosts.get(node.id) || null;
    }
}
