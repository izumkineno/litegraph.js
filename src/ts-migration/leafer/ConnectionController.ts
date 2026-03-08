import type {
    GraphMutationGraphLike,
    GraphMutationLinkLike,
} from "./GraphMutationBus";
import {
    getOppositePortDirection,
    NodePortAdapter,
    type NodePortHit,
} from "./NodePortAdapter";
import { OverlayPrimitives } from "./OverlayPrimitives";
import type { SceneSyncController } from "./SceneSyncController";

interface ConnectionGraphLike extends GraphMutationGraphLike {
    change?: () => void;
}

type ConnectableNodeLike = NodePortHit["node"] & {
    connect?: (
        slot: number,
        target: ConnectableNodeLike | number | string,
        targetSlot?: number
    ) => GraphMutationLinkLike | null;
};

interface ActiveConnection {
    readonly source: NodePortHit;
}

export class ConnectionController {
    private activeConnection: ActiveConnection | null = null;

    constructor(
        private readonly graph: ConnectionGraphLike,
        private readonly sceneSyncController: SceneSyncController,
        private readonly overlayPrimitives: OverlayPrimitives,
        private readonly nodePortAdapter: NodePortAdapter
    ) {}

    destroy(): void {
        this.cancel();
    }

    begin(worldX: number, worldY: number): NodePortHit | null {
        const source = this.nodePortAdapter.hitPortAt(worldX, worldY);
        if (!source) {
            return null;
        }

        this.activeConnection = { source };
        this.update(worldX, worldY);
        return source;
    }

    update(worldX: number, worldY: number): void {
        if (!this.activeConnection) {
            return;
        }

        const { source } = this.activeConnection;
        const target = this.getCompatibleTarget(worldX, worldY);
        const endPoint = target ? target.anchor : ([worldX, worldY] as const);
        const endDir = target
            ? target.dir
            : getOppositePortDirection(source.dir);
        const curve = this.nodePortAdapter.buildLinkCurve(
            source.anchor,
            endPoint,
            source.dir,
            endDir
        );

        this.overlayPrimitives.setConnectionPreview(curve);
    }

    finish(worldX: number, worldY: number): boolean {
        if (!this.activeConnection) {
            return false;
        }

        const { source } = this.activeConnection;
        const target = this.getCompatibleTarget(worldX, worldY);
        let connected = false;

        if (target) {
            connected = this.commitConnection(source, target);
        }

        this.cancel();
        return connected;
    }

    cancel(): void {
        this.activeConnection = null;
        this.overlayPrimitives.hideConnectionPreview();
    }

    isActive(): boolean {
        return Boolean(this.activeConnection);
    }

    private getCompatibleTarget(worldX: number, worldY: number): NodePortHit | null {
        const target = this.nodePortAdapter.hitPortAt(worldX, worldY);
        if (!target || !this.activeConnection) {
            return null;
        }

        const { source } = this.activeConnection;
        if (source.kind === target.kind) {
            return null;
        }

        if (
            source.nodeId === target.nodeId &&
            source.slotIndex === target.slotIndex
        ) {
            return null;
        }

        return target;
    }

    private commitConnection(source: NodePortHit, target: NodePortHit): boolean {
        let link: GraphMutationLinkLike | null = null;

        if (source.kind === "output") {
            const sourceNode = source.node as ConnectableNodeLike;
            if (typeof sourceNode.connect === "function") {
                link = sourceNode.connect(
                    source.slotIndex,
                    target.node as ConnectableNodeLike,
                    target.slotIndex
                );
            }
        } else {
            const sourceNode = source.node as ConnectableNodeLike;
            const targetNode = target.node as ConnectableNodeLike;
            if (typeof targetNode.connect === "function") {
                link = targetNode.connect(
                    target.slotIndex,
                    sourceNode,
                    source.slotIndex
                );
            }
        }

        if (!link) {
            return false;
        }

        this.sceneSyncController.repaintNodeHosts([
            source.nodeId,
            target.nodeId,
        ]);
        this.graph.change?.();
        return true;
    }
}
