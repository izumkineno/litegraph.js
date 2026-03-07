import { Canvas, Rect } from "leafer-ui";

import type { LinkCurveGeometry } from "./NodePortAdapter";
import type { LeaferAppHost } from "./LeaferAppHost";

export interface OverlayWorldBounds {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
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

export class OverlayPrimitives {
    readonly connectionPreview: Canvas;
    readonly selectionBox: Rect;

    private readonly offscreenCanvas: HTMLCanvasElement;
    private readonly offscreenContext: CanvasRenderingContext2D;

    constructor(private readonly appHost: LeaferAppHost) {
        this.connectionPreview = new Canvas({
            name: "litegraph-connection-preview",
            width: 1,
            height: 1,
            pixelRatio: 1,
            visible: false,
            hittable: false,
        });

        this.selectionBox = new Rect({
            name: "litegraph-selection-box",
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            fill: "rgba(255,255,255,0.08)",
            stroke: "#FFFFFF",
            strokeWidth: 1,
            visible: false,
            hittable: false,
        });

        this.offscreenCanvas = document.createElement("canvas");
        this.offscreenCanvas.width = 1;
        this.offscreenCanvas.height = 1;
        const context = this.offscreenCanvas.getContext("2d");
        if (!context) {
            throw new Error(
                "OverlayPrimitives: failed to create 2D offscreen context."
            );
        }
        this.offscreenContext = context;

        this.appHost.overlayWorld.add([
            this.connectionPreview,
            this.selectionBox,
        ]);
    }

    destroy(): void {
        this.connectionPreview.destroy();
        this.selectionBox.destroy();
    }

    setConnectionPreview(curve: LinkCurveGeometry, color = "#7F7"): void {
        this.syncWorldTransform();

        const bounds = this.measureCurveBounds(curve, 3);
        this.ensurePreviewCanvasSize(bounds.width, bounds.height);
        this.paintConnectionPreview(curve, bounds, color);

        this.connectionPreview.x = bounds.x;
        this.connectionPreview.y = bounds.y;
        this.connectionPreview.width = bounds.width;
        this.connectionPreview.height = bounds.height;
        this.connectionPreview.visible = true;

        const surfaceContext =
            this.connectionPreview.context as unknown as CanvasRenderingContext2D;
        surfaceContext.setTransform(1, 0, 0, 1, 0, 0);
        surfaceContext.clearRect(0, 0, bounds.width, bounds.height);
        surfaceContext.drawImage(
            this.offscreenCanvas,
            0,
            0,
            bounds.width,
            bounds.height
        );
        this.connectionPreview.paint();
    }

    hideConnectionPreview(): void {
        this.connectionPreview.visible = false;
        this.connectionPreview.width = 1;
        this.connectionPreview.height = 1;
    }

    setSelectionBounds(bounds: OverlayWorldBounds): void {
        this.syncWorldTransform();
        this.selectionBox.x = bounds.x;
        this.selectionBox.y = bounds.y;
        this.selectionBox.width = bounds.width;
        this.selectionBox.height = bounds.height;
        this.selectionBox.visible = true;
    }

    hideSelectionBox(): void {
        this.selectionBox.visible = false;
        this.selectionBox.width = 1;
        this.selectionBox.height = 1;
    }

    syncWorldTransform(): void {
        const zoomLayer = this.appHost.treeZoomLayer as {
            x?: unknown;
            y?: unknown;
            scaleX?: unknown;
            scaleY?: unknown;
        };

        this.appHost.overlayWorld.x = toFiniteNumber(zoomLayer.x);
        this.appHost.overlayWorld.y = toFiniteNumber(zoomLayer.y);
        this.appHost.overlayWorld.scaleX = toFiniteNumber(zoomLayer.scaleX, 1);
        this.appHost.overlayWorld.scaleY = toFiniteNumber(zoomLayer.scaleY, 1);
    }

    private measureCurveBounds(
        curve: LinkCurveGeometry,
        strokeWidth: number
    ): CurveBounds {
        const padding = Math.ceil(strokeWidth + 8);
        const minX = Math.min(
            curve.start[0],
            curve.c1[0],
            curve.c2[0],
            curve.end[0]
        );
        const minY = Math.min(
            curve.start[1],
            curve.c1[1],
            curve.c2[1],
            curve.end[1]
        );
        const maxX = Math.max(
            curve.start[0],
            curve.c1[0],
            curve.c2[0],
            curve.end[0]
        );
        const maxY = Math.max(
            curve.start[1],
            curve.c1[1],
            curve.c2[1],
            curve.end[1]
        );

        return {
            x: Math.floor(minX) - padding,
            y: Math.floor(minY) - padding,
            width: Math.max(1, Math.ceil(maxX - minX) + padding * 2),
            height: Math.max(1, Math.ceil(maxY - minY) + padding * 2),
        };
    }

    private ensurePreviewCanvasSize(width: number, height: number): void {
        if (
            this.offscreenCanvas.width !== width ||
            this.offscreenCanvas.height !== height
        ) {
            this.offscreenCanvas.width = width;
            this.offscreenCanvas.height = height;
        }

        if (this.connectionPreview.width !== width) {
            this.connectionPreview.width = width;
        }
        if (this.connectionPreview.height !== height) {
            this.connectionPreview.height = height;
        }
    }

    private paintConnectionPreview(
        curve: LinkCurveGeometry,
        bounds: CurveBounds,
        color: string
    ): void {
        const ctx = this.offscreenContext;
        const start = toLocalPoint(curve.start, bounds);
        const c1 = toLocalPoint(curve.c1, bounds);
        const c2 = toLocalPoint(curve.c2, bounds);
        const end = toLocalPoint(curve.end, bounds);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, bounds.width, bounds.height);
        ctx.beginPath();
        ctx.moveTo(start[0], start[1]);
        ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.restore();
    }
}
