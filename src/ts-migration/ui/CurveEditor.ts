// TODO: Import LGraphCanvas from its future module

import type { Vector2 } from "../types/core-types";
import { clamp } from "../utils/clamp";
import { distance } from "../utils/math-geometry";

export type CurvePoint = Vector2;

interface CurveEditorGraphCanvasLike {
    ds: {
        scale: number;
    };
}

/**
 * Used by some widgets to render a curve editor.
 *
 * Source: `function CurveEditor(points)` + `CurveEditor.prototype.*`.
 */
export class CurveEditor {
    points: CurvePoint[] | null | undefined;
    selected: number;
    nearest: number;
    _nearest: number;
    size: Vector2 | null; // stores last size used
    must_update: boolean;
    margin: number;

    constructor(points: CurvePoint[] | null | undefined) {
        this.points = points;
        this.selected = -1;
        this.nearest = -1;
        this._nearest = -1;
        this.size = null;
        this.must_update = true;
        this.margin = 5;
    }

    static sampleCurve(
        f: number,
        points?: CurvePoint[] | null
    ): number | undefined {
        if (!points) {
            return;
        }
        for (let i = 0; i < points.length - 1; ++i) {
            const p = points[i];
            const pn = points[i + 1];
            if (pn[0] < f) {
                continue;
            }
            const r = pn[0] - p[0];
            if (Math.abs(r) < 0.00001) {
                return p[1];
            }
            const local_f = (f - p[0]) / r;
            return p[1] * (1.0 - local_f) + pn[1] * local_f;
        }
        return 0;
    }

    draw(
        ctx: CanvasRenderingContext2D,
        size: Vector2,
        graphcanvas?: CurveEditorGraphCanvasLike,
        background_color?: string | null,
        line_color?: string | null,
        inactive?: boolean
    ): void {
        void graphcanvas;
        const points = this.points;
        if (!points) {
            return;
        }
        this.size = size;
        const w = size[0] - this.margin * 2;
        const h = size[1] - this.margin * 2;
        const resolvedLineColor = line_color || "#666";

        ctx.save();
        ctx.translate(this.margin, this.margin);

        if (background_color) {
            ctx.fillStyle = "#111";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#222";
            ctx.fillRect(w * 0.5, 0, 1, h);
            ctx.strokeStyle = "#333";
            ctx.strokeRect(0, 0, w, h);
        }
        ctx.strokeStyle = resolvedLineColor;
        if (inactive) {
            ctx.globalAlpha = 0.5;
        }
        ctx.beginPath();
        for (let i = 0; i < points.length; ++i) {
            const p = points[i];
            ctx.lineTo(p[0] * w, (1.0 - p[1]) * h);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (!inactive) {
            for (let i = 0; i < points.length; ++i) {
                const p = points[i];
                ctx.fillStyle =
                    this.selected == i
                        ? "#FFF"
                        : this.nearest == i
                          ? "#DDD"
                          : "#AAA";
                ctx.beginPath();
                ctx.arc(p[0] * w, (1.0 - p[1]) * h, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // localpos is mouse in curve editor space
    onMouseDown(
        localpos: Vector2,
        graphcanvas: CurveEditorGraphCanvasLike
    ): true | void {
        const points = this.points;
        if (!points) {
            return;
        }
        if (localpos[1] < 0) {
            return;
        }
        if (!this.size) {
            return;
        }

        // this.captureInput(true);
        const w = this.size[0] - this.margin * 2;
        const h = this.size[1] - this.margin * 2;
        const x = localpos[0] - this.margin;
        const y = localpos[1] - this.margin;
        const pos: Vector2 = [x, y];
        const max_dist = 30 / graphcanvas.ds.scale;
        // search closer one
        this.selected = this.getCloserPoint(pos, max_dist);
        // create one
        if (this.selected == -1) {
            const point: CurvePoint = [x / w, 1 - y / h];
            points.push(point);
            points.sort((a, b) => a[0] - b[0]);
            this.selected = points.indexOf(point);
            this.must_update = true;
        }
        if (this.selected != -1) {
            return true;
        }
    }

    onMouseMove(
        localpos: Vector2,
        graphcanvas: CurveEditorGraphCanvasLike
    ): void {
        const points = this.points;
        if (!points) {
            return;
        }
        if (!this.size) {
            return;
        }

        const s = this.selected;
        if (s < 0) {
            return;
        }
        const x = (localpos[0] - this.margin) / (this.size[0] - this.margin * 2);
        const y = (localpos[1] - this.margin) / (this.size[1] - this.margin * 2);
        const curvepos: Vector2 = [
            localpos[0] - this.margin,
            localpos[1] - this.margin,
        ];
        const max_dist = 30 / graphcanvas.ds.scale;
        this._nearest = this.getCloserPoint(curvepos, max_dist);
        const point = points[s];
        if (point) {
            const is_edge_point = s == 0 || s == points.length - 1;
            if (
                !is_edge_point &&
                (localpos[0] < -10 ||
                    localpos[0] > this.size[0] + 10 ||
                    localpos[1] < -10 ||
                    localpos[1] > this.size[1] + 10)
            ) {
                points.splice(s, 1);
                this.selected = -1;
                return;
            }
            if (!is_edge_point) {
                // not edges
                point[0] = clamp(x, 0, 1);
            } else {
                point[0] = s == 0 ? 0 : 1;
            }
            point[1] = 1.0 - clamp(y, 0, 1);
            points.sort((a, b) => a[0] - b[0]);
            this.selected = points.indexOf(point);
            this.must_update = true;
        }
    }

    onMouseUp(localpos: Vector2, graphcanvas: CurveEditorGraphCanvasLike): boolean {
        void localpos;
        void graphcanvas;
        this.selected = -1;
        return false;
    }

    getCloserPoint(pos: Vector2, max_dist?: number): number {
        const points = this.points;
        if (!points || !this.size) {
            return -1;
        }
        max_dist = max_dist || 30;
        const w = this.size[0] - this.margin * 2;
        const h = this.size[1] - this.margin * 2;
        const num = points.length;
        const p2: Vector2 = [0, 0];
        let min_dist = 1000000;
        let closest = -1;
        let last_valid = -1;
        for (let i = 0; i < num; ++i) {
            const p = points[i];
            p2[0] = p[0] * w;
            p2[1] = (1.0 - p[1]) * h;
            if (p2[0] < pos[0]) {
                last_valid = i;
            }
            const dist = distance(pos, p2);
            if (dist > min_dist || dist > max_dist) {
                continue;
            }
            closest = i;
            min_dist = dist;
        }
        void last_valid;
        return closest;
    }
}
