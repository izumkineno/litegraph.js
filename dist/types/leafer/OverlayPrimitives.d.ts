import { Canvas, Rect } from "leafer-ui";
import type { LinkCurveGeometry } from "./NodePortAdapter";
import type { LeaferAppHost } from "./LeaferAppHost";
export interface OverlayWorldBounds {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export declare class OverlayPrimitives {
    private readonly appHost;
    readonly connectionPreview: Canvas;
    readonly selectionBox: Rect;
    private readonly offscreenCanvas;
    private readonly offscreenContext;
    constructor(appHost: LeaferAppHost);
    destroy(): void;
    setConnectionPreview(curve: LinkCurveGeometry, color?: string): void;
    hideConnectionPreview(): void;
    setSelectionBounds(bounds: OverlayWorldBounds): void;
    hideSelectionBox(): void;
    syncWorldTransform(): void;
    private measureCurveBounds;
    private ensurePreviewCanvasSize;
    private paintConnectionPreview;
}
