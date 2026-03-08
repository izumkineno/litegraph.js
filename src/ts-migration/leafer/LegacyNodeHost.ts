import { Canvas, Group } from "leafer-ui";

import {
    LegacyNodePainter,
    type LegacyNodePaintBounds,
    type LegacyNodePainterNodeLike,
    type LegacyNodeRenderHost,
} from "./LegacyNodePainter";
import type { NodeViewHost } from "./NodeViewHost";
import { resolveRasterRenderScale } from "./RasterRenderScale";

interface LegacyNodeHostOptions {
    readonly view?: HTMLElement | null;
    readonly getViewportScale?: () => number;
}

export class LegacyNodeHost implements NodeViewHost {
    readonly runtime = "legacy" as const;
    readonly node: LegacyNodePainterNodeLike;
    readonly renderHost: LegacyNodeRenderHost;
    readonly root: Group;
    readonly eventRoot: Group;
    readonly surface: Canvas;

    private readonly offscreenCanvas: HTMLCanvasElement;
    private readonly offscreenContext: CanvasRenderingContext2D;
    private lastBounds: LegacyNodePaintBounds | null = null;
    private positionOffsetX = 0;
    private positionOffsetY = 0;
    private readonly view: HTMLElement | null;
    private readonly getViewportScale: () => number;

    constructor(
        node: LegacyNodePainterNodeLike,
        renderHost: LegacyNodeRenderHost,
        options: LegacyNodeHostOptions = {}
    ) {
        this.node = node;
        this.renderHost = renderHost;
        this.view = options.view || null;
        this.getViewportScale = options.getViewportScale || (() => 1);
        this.root = new Group({
            name: `litegraph-legacy-node:${String(node.id)}`,
            hittable: true,
            data: {
                litegraphNodeId: String(node.id),
            },
        });
        this.eventRoot = new Group({
            name: `litegraph-legacy-node-event-root:${String(node.id)}`,
            hittable: false,
            visible: false,
        });
        this.surface = new Canvas({
            name: `litegraph-legacy-node-surface:${String(node.id)}`,
            width: 1,
            height: 1,
            pixelRatio: 1,
            smooth: false,
            hittable: true,
            data: {
                litegraphNodeId: String(node.id),
            },
        });
        (this.surface as Canvas & { hitBox?: boolean }).hitBox = true;
        this.root.add([this.surface, this.eventRoot]);

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
        const renderScale = this.resolveRenderScale();
        const pixelWidth = Math.max(1, Math.ceil(bounds.width * renderScale));
        const pixelHeight = Math.max(1, Math.ceil(bounds.height * renderScale));

        this.ensureCanvasSize(bounds.width, bounds.height, renderScale);
        LegacyNodePainter.paint(
            this.node,
            this.renderHost,
            this.offscreenContext,
            bounds,
            renderScale
        );

        this.positionOffsetX = bounds.x - Number(this.node.pos?.[0] || 0);
        this.positionOffsetY = bounds.y - Number(this.node.pos?.[1] || 0);
        this.syncPosition();
        this.surface.x = 0;
        this.surface.y = 0;
        this.surface.width = bounds.width;
        this.surface.height = bounds.height;
        this.eventRoot.x = bounds.contentOffsetX;
        this.eventRoot.y = bounds.contentOffsetY;
        this.surface.pixelRatio = renderScale;

        const surfaceContext = this.surface.context as unknown as CanvasRenderingContext2D;
        surfaceContext.setTransform(1, 0, 0, 1, 0, 0);
        surfaceContext.clearRect(0, 0, pixelWidth, pixelHeight);
        surfaceContext.drawImage(
            this.offscreenCanvas,
            0,
            0,
            this.offscreenCanvas.width,
            this.offscreenCanvas.height,
            0,
            0,
            pixelWidth,
            pixelHeight
        );
        this.surface.paint();

        this.lastBounds = bounds;
    }

    destroy(): void {
        this.root.destroy();
    }

    getBounds(): LegacyNodePaintBounds | null {
        return this.lastBounds;
    }

    syncPosition(): void {
        this.root.x = Number(this.node.pos?.[0] || 0) + this.positionOffsetX;
        this.root.y = Number(this.node.pos?.[1] || 0) + this.positionOffsetY;
    }

    private ensureCanvasSize(width: number, height: number, renderScale: number): void {
        const pixelWidth = Math.max(1, Math.ceil(width * renderScale));
        const pixelHeight = Math.max(1, Math.ceil(height * renderScale));
        if (
            this.offscreenCanvas.width !== pixelWidth ||
            this.offscreenCanvas.height !== pixelHeight
        ) {
            this.offscreenCanvas.width = pixelWidth;
            this.offscreenCanvas.height = pixelHeight;
        }

        if (this.surface.width !== width) {
            this.surface.width = width;
        }
        if (this.surface.height !== height) {
            this.surface.height = height;
        }
    }

    private resolveRenderScale(): number {
        return resolveRasterRenderScale({
            zoomScale: this.getViewportScale(),
            view: this.view,
        });
    }
}
