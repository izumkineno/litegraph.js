import { Canvas, Group } from "leafer-ui";

import {
    LegacyNodePainter,
    type LegacyNodePaintBounds,
    type LegacyNodePainterNodeLike,
    type LegacyNodeRenderHost,
} from "./LegacyNodePainter";

export class LegacyNodeHost {
    readonly node: LegacyNodePainterNodeLike;
    readonly renderHost: LegacyNodeRenderHost;
    readonly root: Group;
    readonly surface: Canvas;

    private readonly offscreenCanvas: HTMLCanvasElement;
    private readonly offscreenContext: CanvasRenderingContext2D;
    private lastBounds: LegacyNodePaintBounds | null = null;

    constructor(
        node: LegacyNodePainterNodeLike,
        renderHost: LegacyNodeRenderHost
    ) {
        this.node = node;
        this.renderHost = renderHost;
        this.root = new Group({
            name: `litegraph-legacy-node:${String(node.id)}`,
            hittable: false,
        });
        this.surface = new Canvas({
            name: `litegraph-legacy-node-surface:${String(node.id)}`,
            width: 1,
            height: 1,
            pixelRatio: 1,
            hittable: false,
        });
        this.root.add(this.surface);

        this.offscreenCanvas = document.createElement("canvas");
        this.offscreenCanvas.width = 1;
        this.offscreenCanvas.height = 1;
        const context = this.offscreenCanvas.getContext("2d");
        if (!context) {
            throw new Error("LegacyNodeHost: failed to create 2D offscreen context.");
        }
        this.offscreenContext = context;

        this.repaint();
    }

    repaint(): void {
        const bounds = LegacyNodePainter.measure(
            this.node,
            this.renderHost,
            this.offscreenContext
        );

        this.ensureCanvasSize(bounds.width, bounds.height);
        LegacyNodePainter.paint(
            this.node,
            this.renderHost,
            this.offscreenContext,
            bounds
        );

        this.root.x = bounds.x;
        this.root.y = bounds.y;
        this.surface.x = 0;
        this.surface.y = 0;
        this.surface.width = bounds.width;
        this.surface.height = bounds.height;

        const surfaceContext = this.surface.context as unknown as CanvasRenderingContext2D;
        surfaceContext.setTransform(1, 0, 0, 1, 0, 0);
        surfaceContext.clearRect(0, 0, bounds.width, bounds.height);
        surfaceContext.drawImage(this.offscreenCanvas, 0, 0, bounds.width, bounds.height);
        this.surface.paint();

        this.lastBounds = bounds;
    }

    destroy(): void {
        this.root.destroy();
    }

    getBounds(): LegacyNodePaintBounds | null {
        return this.lastBounds;
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
}
