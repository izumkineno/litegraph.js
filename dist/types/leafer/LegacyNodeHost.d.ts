import { Canvas, Group } from "leafer-ui";
import { type LegacyNodePaintBounds, type LegacyNodePainterNodeLike, type LegacyNodeRenderHost } from "./LegacyNodePainter";
import type { NodeViewHost } from "./NodeViewHost";
interface LegacyNodeHostOptions {
    readonly view?: HTMLElement | null;
    readonly getViewportScale?: () => number;
}
export declare class LegacyNodeHost implements NodeViewHost {
    readonly runtime: "legacy";
    readonly node: LegacyNodePainterNodeLike;
    readonly renderHost: LegacyNodeRenderHost;
    readonly root: Group;
    readonly eventRoot: Group;
    readonly surface: Canvas;
    private readonly offscreenCanvas;
    private readonly offscreenContext;
    private lastBounds;
    private positionOffsetX;
    private positionOffsetY;
    private readonly view;
    private readonly getViewportScale;
    constructor(node: LegacyNodePainterNodeLike, renderHost: LegacyNodeRenderHost, options?: LegacyNodeHostOptions);
    repaint(): void;
    destroy(): void;
    getBounds(): LegacyNodePaintBounds | null;
    syncPosition(): void;
    private ensureCanvasSize;
    private resolveRenderScale;
}
export {};
