import type { Vector2, Vector4 } from "../types/core-types";
import type { GraphCanvasPalettePort } from "../contracts/canvas";
import type { LGraphPersistence as LGraph } from "./LGraph.persistence";
import { LGraphNodeCanvasCollab } from "./LGraphNode.canvas-collab";
import { type SerializedLGraphGroupCompatInput } from "./LGraphGroup.serialization.compat";
interface LGraphGroupNodeLike {
    pos: Vector2;
    getBounding: (out?: Vector4) => Vector4;
}
interface LGraphGroupGraphLike extends Pick<LGraph, "sendActionToCanvas" | "isLive"> {
    _nodes: LGraphGroupNodeLike[];
}
type LGraphGroupCanvasColorsLike = GraphCanvasPalettePort;
/**
 * Group of nodes on top of the graph.
 * Source: `function LGraphGroup` + `LGraphGroup.prototype.*`.
 */
export declare class LGraphGroup {
    static liteGraphCanvas: LGraphGroupCanvasColorsLike;
    title: string;
    font_size: number;
    color: string;
    graph: LGraphGroupGraphLike | null;
    _bounding: Float32Array;
    private _pos;
    private _size;
    _nodes: LGraphGroupNodeLike[];
    pos: Vector2;
    size: Vector2;
    flags: Record<string, unknown>;
    constructor(title?: string);
    _ctor(title?: string): void;
    configure(o: SerializedLGraphGroupCompatInput): void;
    serialize(): {
        title: string;
        bounding: [number, number, number, number];
        color: string;
        font_size: number;
    };
    move(deltaX: number, deltaY: number, ignoreNodes?: boolean): void;
    recomputeInsideNodes(): void;
    isPointInside: LGraphNodeCanvasCollab["isPointInside"];
    setDirtyCanvas: LGraphNodeCanvasCollab["setDirtyCanvas"];
    host(): {
        NODE_TITLE_HEIGHT: number;
        NODE_COLLAPSED_WIDTH: number;
    };
    graphRef(): LGraphGroupGraphLike | null;
}
export {};
