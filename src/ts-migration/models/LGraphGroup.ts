// TODO: Import LGraph from its future module
// TODO: Import LGraphCanvas from its future module

import type { Vector2, Vector4 } from "../types/core-types";
import { overlapBounding } from "../utils/math-geometry";
import { LGraphNodeCanvasCollab } from "./LGraphNode.canvas-collab";

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
    pos!: Vector2;
    size!: Vector2;

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

        Object.defineProperty(this, "pos", {
            set(v: Vector2) {
                if (!v || v.length < 2) {
                    return;
                }
                (this as LGraphGroup)._pos[0] = v[0];
                (this as LGraphGroup)._pos[1] = v[1];
            },
            get() {
                return (this as LGraphGroup)._pos;
            },
            enumerable: true,
        });

        Object.defineProperty(this, "size", {
            set(v: Vector2) {
                if (!v || v.length < 2) {
                    return;
                }
                (this as LGraphGroup)._size[0] = Math.max(140, v[0]);
                (this as LGraphGroup)._size[1] = Math.max(80, v[1]);
            },
            get() {
                return (this as LGraphGroup)._size;
            },
            enumerable: true,
        });
    }

    configure(o: {
        title: string;
        bounding: Vector4;
        color: string;
        font_size?: number;
    }): void {
        this.title = o.title;
        this._bounding.set(o.bounding);
        this.color = o.color;
        this.font_size = o.font_size as number;
    }

    serialize(): {
        title: string;
        bounding: [number, number, number, number];
        color: string;
        font_size: number;
    } {
        const b = this._bounding;
        return {
            title: this.title,
            bounding: [
                Math.round(b[0]),
                Math.round(b[1]),
                Math.round(b[2]),
                Math.round(b[3]),
            ],
            color: this.color,
            font_size: this.font_size,
        };
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
        const nodes = (this.graph as LGraphGroupGraphLike)._nodes;
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
