import type { GraphMutationGraphLike } from "./GraphMutationBus";
import { NodePortAdapter, type NodePortHit } from "./NodePortAdapter";
import { OverlayPrimitives } from "./OverlayPrimitives";
import type { SceneSyncController } from "./SceneSyncController";
interface ConnectionGraphLike extends GraphMutationGraphLike {
    change?: () => void;
}
export declare class ConnectionController {
    private readonly graph;
    private readonly sceneSyncController;
    private readonly overlayPrimitives;
    private readonly nodePortAdapter;
    private activeConnection;
    constructor(graph: ConnectionGraphLike, sceneSyncController: SceneSyncController, overlayPrimitives: OverlayPrimitives, nodePortAdapter: NodePortAdapter);
    destroy(): void;
    begin(worldX: number, worldY: number): NodePortHit | null;
    update(worldX: number, worldY: number): void;
    finish(worldX: number, worldY: number): boolean;
    cancel(): void;
    isActive(): boolean;
    private getCompatibleTarget;
    private commitConnection;
}
export {};
