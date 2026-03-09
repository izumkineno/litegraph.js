import type { GraphMutationGraphLike, GraphMutationNodeLike } from "./GraphMutationBus";
import { OverlayPrimitives } from "./OverlayPrimitives";
import type { SceneSyncController } from "./SceneSyncController";
interface SelectionCanvasHost {
    selectNodes: (nodes?: GraphMutationNodeLike[], addToCurrentSelection?: boolean) => void;
}
interface SelectableNodeLike extends GraphMutationNodeLike {
    getBounding?: (out?: Float32Array | [number, number, number, number], computeOuter?: boolean) => [number, number, number, number];
}
interface SelectionGraphLike extends GraphMutationGraphLike {
    _nodes?: SelectableNodeLike[];
}
export declare class SelectionController {
    private readonly graph;
    private readonly canvas;
    private readonly sceneSyncController;
    private readonly overlayPrimitives;
    private activeSelection;
    constructor(graph: SelectionGraphLike, canvas: SelectionCanvasHost, sceneSyncController: SceneSyncController, overlayPrimitives: OverlayPrimitives);
    destroy(): void;
    begin(worldX: number, worldY: number, additive: boolean): void;
    update(worldX: number, worldY: number): void;
    finish(worldX: number, worldY: number): GraphMutationNodeLike[];
    cancel(): void;
    isActive(): boolean;
}
export {};
