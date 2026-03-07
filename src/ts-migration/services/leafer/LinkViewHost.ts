import { Canvas, Group } from "leafer-ui";

import type { LinkCurveGeometry } from "./NodePortAdapter";

export interface LinkFlowPresentation {
    active?: boolean;
    color?: string;
    opacity?: number;
    dotRadius?: number;
    dots?: ReadonlyArray<readonly [number, number]>;
}

export interface LinkViewPresentation {
    curve: LinkCurveGeometry | null;
    stroke?: string;
    strokeWidth?: number;
    visible?: boolean;
    flow?: LinkFlowPresentation;
}

interface CurveBounds {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toLocalPoint(
    point: readonly [number, number],
    bounds: CurveBounds
): readonly [number, number] {
    return [point[0] - bounds.x, point[1] - bounds.y];
}

export class LinkViewHost {
    readonly view: Group;
    readonly surface: Canvas;

    private readonly offscreenCanvas: HTMLCanvasElement;
    private readonly offscreenContext: CanvasRenderingContext2D;

    constructor(name: string) {
        this.view = new Group({
            name,
            hittable: false,
            visible: true,
            data: {
                litegraphPlaceholderKind: "link-view",
            },
        });

        this.surface = new Canvas({
            name: `${name}:surface`,
            width: 1,
            height: 1,
            pixelRatio: 1,
            hittable: false,
            visible: true,
        });
        this.view.add(this.surface);

        this.offscreenCanvas = document.createElement("canvas");
        this.offscreenCanvas.width = 1;
        this.offscreenCanvas.height = 1;
        const context = this.offscreenCanvas.getContext("2d");
        if (!context) {
            throw new Error("LinkViewHost: failed to create 2D offscreen context.");
        }
        this.offscreenContext = context;
    }

    update(presentation: LinkViewPresentation): void {
        const { curve } = presentation;
        const visible = presentation.visible !== false && Boolean(curve);
        this.view.visible = visible;
        if (!visible || !curve) {
            return;
        }

        const bounds = this.measureBounds(curve, presentation);
        this.ensureCanvasSize(bounds.width, bounds.height);
        this.paintToOffscreen(bounds, presentation);

        this.view.x = bounds.x;
        this.view.y = bounds.y;
        this.surface.width = bounds.width;
        this.surface.height = bounds.height;

        const surfaceContext =
            this.surface.context as unknown as CanvasRenderingContext2D;
        surfaceContext.setTransform(1, 0, 0, 1, 0, 0);
        surfaceContext.clearRect(0, 0, bounds.width, bounds.height);
        surfaceContext.drawImage(
            this.offscreenCanvas,
            0,
            0,
            bounds.width,
            bounds.height
        );
        this.surface.paint();
    }

    destroy(): void {
        this.view.destroy();
    }

    private measureBounds(
        curve: LinkCurveGeometry,
        presentation: LinkViewPresentation
    ): CurveBounds {
        const strokeWidth = Math.max(
            1,
            toFiniteNumber(presentation.strokeWidth, 3)
        );
        const dotRadius = Math.max(
            strokeWidth,
            toFiniteNumber(presentation.flow?.dotRadius, 5)
        );
        const padding = Math.ceil(Math.max(strokeWidth, dotRadius) + 8);

        let minX = Math.min(
            curve.start[0],
            curve.c1[0],
            curve.c2[0],
            curve.end[0]
        );
        let minY = Math.min(
            curve.start[1],
            curve.c1[1],
            curve.c2[1],
            curve.end[1]
        );
        let maxX = Math.max(
            curve.start[0],
            curve.c1[0],
            curve.c2[0],
            curve.end[0]
        );
        let maxY = Math.max(
            curve.start[1],
            curve.c1[1],
            curve.c2[1],
            curve.end[1]
        );

        const dots = presentation.flow?.dots || [];
        for (let i = 0; i < dots.length; ++i) {
            const point = dots[i];
            minX = Math.min(minX, point[0] - dotRadius);
            minY = Math.min(minY, point[1] - dotRadius);
            maxX = Math.max(maxX, point[0] + dotRadius);
            maxY = Math.max(maxY, point[1] + dotRadius);
        }

        return {
            x: Math.floor(minX) - padding,
            y: Math.floor(minY) - padding,
            width: Math.max(1, Math.ceil(maxX - minX) + padding * 2),
            height: Math.max(1, Math.ceil(maxY - minY) + padding * 2),
        };
    }

    private ensureCanvasSize(width: number, height: number): void {
        if (
            this.offscreenCanvas.width !== width ||
            this.offscreenCanvas.height !== height
        ) {
            this.offscreenCanvas.width = width;
            this.offscreenCanvas.height = height;
        }

        if (this.surface.width !== width) {
            this.surface.width = width;
        }
        if (this.surface.height !== height) {
            this.surface.height = height;
        }
    }

    private paintToOffscreen(
        bounds: CurveBounds,
        presentation: LinkViewPresentation
    ): void {
        const { curve } = presentation;
        if (!curve) {
            return;
        }

        const ctx = this.offscreenContext;
        const strokeWidth = Math.max(
            1,
            toFiniteNumber(presentation.strokeWidth, 3)
        );
        const baseColor = presentation.stroke || "#9A9";
        const flow = presentation.flow;
        const dotRadius = Math.max(
            1,
            toFiniteNumber(flow?.dotRadius, 5)
        );
        const opacity = Math.max(
            0,
            Math.min(1, toFiniteNumber(flow?.opacity, 1))
        );

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, bounds.width, bounds.height);
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = baseColor;
        this.traceCurve(ctx, curve, bounds);
        ctx.stroke();

        if (flow?.active) {
            ctx.globalAlpha = opacity;
            ctx.strokeStyle = flow.color || "#FFF";
            this.traceCurve(ctx, curve, bounds);
            ctx.stroke();
            ctx.fillStyle = flow.color || "#FFF";

            const dots = flow.dots || [];
            for (let i = 0; i < dots.length; ++i) {
                const point = toLocalPoint(dots[i], bounds);
                ctx.beginPath();
                ctx.arc(point[0], point[1], dotRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    private traceCurve(
        context: CanvasRenderingContext2D,
        curve: LinkCurveGeometry,
        bounds: CurveBounds
    ): void {
        const start = toLocalPoint(curve.start, bounds);
        const c1 = toLocalPoint(curve.c1, bounds);
        const c2 = toLocalPoint(curve.c2, bounds);
        const end = toLocalPoint(curve.end, bounds);

        context.beginPath();
        context.moveTo(start[0], start[1]);
        context.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
    }
}
