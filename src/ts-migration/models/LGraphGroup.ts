// TODO: Import LGraph from its future module
// TODO: Import LGraphCanvas from its future module

import type { Vector2, Vector4 } from "../types/core-types";
import { overlapBounding } from "../utils/math-geometry";
import { LGraphNodeCanvasCollab } from "./LGraphNode.canvas-collab";
import {
    parseSerializedLGraphGroupInput,
    serializeLGraphGroupShape,
    type SerializedLGraphGroupCompatInput,
    type SerializedLGraphGroupRuntime,
} from "./LGraphGroup.serialization.compat";

interface LGraphGroupNodeLike {
    pos: Vector2;
    getBounding: (out?: Vector4) => Vector4;
}

interface LGraphGroupGraphLike {
    _nodes: LGraphGroupNodeLike[];
    sendActionToCanvas?: (
        action: string,
        params: [boolean | undefined, boolean | undefined]
    ) => void;
    isLive?: () => boolean;
}

interface LGraphGroupCanvasColorsLike {
    node_colors?: {
        pale_blue?: {
            groupcolor?: string;
        };
    };
}

const defaultCanvasColors: LGraphGroupCanvasColorsLike = {
    node_colors: {
        pale_blue: {
            groupcolor: "#AAA",
        },
    },
};

/**
 * Group of nodes on top of the graph.
 * Source: `function LGraphGroup` + `LGraphGroup.prototype.*`.
 */
export class LGraphGroup {
    static liteGraphCanvas: LGraphGroupCanvasColorsLike = defaultCanvasColors;

    title: string;
    font_size: number;
    color: string;
    graph: LGraphGroupGraphLike | null;

    _bounding: Float32Array;
    private _pos: Float32Array;
    private _size: Float32Array;
    _nodes: LGraphGroupNodeLike[];

    // kept for delegated `isPointInside` logic compatibility.
    flags: Record<string, unknown>;

    constructor(title?: string) {
        this.title = "Group";
        this.font_size = 24;
        this.color = "#AAA";
        this.graph = null;
        this._bounding = new Float32Array([10, 10, 140, 80]);
        this._pos = this._bounding.subarray(0, 2);
        this._size = this._bounding.subarray(2, 4);
        this._nodes = [];
        this.flags = {};

        this._ctor(title);
    }

    get pos(): Vector2 {
        return this._pos as unknown as Vector2;
    }

    set pos(v: Vector2) {
        if (!v || v.length < 2) {
            return;
        }
        this._pos[0] = v[0];
        this._pos[1] = v[1];
    }

    get size(): Vector2 {
        return this._size as unknown as Vector2;
    }

    set size(v: Vector2) {
        if (!v || v.length < 2) {
            return;
        }
        this._size[0] = Math.max(140, v[0]);
        this._size[1] = Math.max(80, v[1]);
    }

    _ctor(title?: string): void {
        this.title = title || "Group";
        this.font_size = 24;
        const colors =
            (this.constructor as typeof LGraphGroup).liteGraphCanvas ||
            defaultCanvasColors;
        this.color = colors.node_colors?.pale_blue?.groupcolor || "#AAA";
        this._bounding = new Float32Array([10, 10, 140, 80]);
        this._pos = this._bounding.subarray(0, 2);
        this._size = this._bounding.subarray(2, 4);
        this._nodes = [];
        this.graph = null;
    }

    configure(o: SerializedLGraphGroupCompatInput): void {
        const parsed = parseSerializedLGraphGroupInput(o, 24);
        this.title = parsed.title;
        this._bounding.set(parsed.bounding);
        this.color = parsed.color;
        this.font_size = parsed.font_size;
    }

    serialize(): SerializedLGraphGroupRuntime {
        const b = this._bounding;
        return serializeLGraphGroupShape(
            {
                title: this.title,
                bounding: [
                    Math.round(b[0]),
                    Math.round(b[1]),
                    Math.round(b[2]),
                    Math.round(b[3]),
                ] as Vector4,
                color: this.color,
                font_size: this.font_size,
            },
            "runtime"
        ) as SerializedLGraphGroupRuntime;
    }

    move(deltaX: number, deltaY: number, ignoreNodes?: boolean): void {
        this._pos[0] += deltaX;
        this._pos[1] += deltaY;
        if (ignoreNodes) {
            return;
        }
        for (let i = 0; i < this._nodes.length; ++i) {
            const node = this._nodes[i];
            node.pos[0] += deltaX;
            node.pos[1] += deltaY;
        }
    }

    recomputeInsideNodes(): void {
        this._nodes.length = 0;
        const graph = this.graph;
        if (!graph) {
            return;
        }
        const nodes = graph._nodes;
        const node_bounding = new Float32Array(4) as unknown as Vector4;

        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            node.getBounding(node_bounding);
            if (!overlapBounding(this._bounding as unknown as Vector4, node_bounding)) {
                continue;
            } // out of the visible area
            this._nodes.push(node);
        }
    }

    // Delegated from `LGraphNode.prototype.isPointInside`.
    isPointInside: LGraphNodeCanvasCollab["isPointInside"] =
        LGraphNodeCanvasCollab.prototype.isPointInside;

    // Delegated from `LGraphNode.prototype.setDirtyCanvas`.
    setDirtyCanvas: LGraphNodeCanvasCollab["setDirtyCanvas"] =
        LGraphNodeCanvasCollab.prototype.setDirtyCanvas;

    // Internal compatibility hooks consumed by delegated methods above.
    private host(): {
        NODE_TITLE_HEIGHT: number;
        NODE_COLLAPSED_WIDTH: number;
    } {
        return {
            NODE_TITLE_HEIGHT: 30,
            NODE_COLLAPSED_WIDTH: 80,
        };
    }

    private graphRef(): LGraphGroupGraphLike | null {
        return this.graph;
    }
}
