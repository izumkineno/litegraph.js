import "@leafer-in/view";
import "@leafer-in/viewport";
import type { Vector2, Vector4 } from "../types/core-types";
import type { LeaferAppHost } from "./LeaferAppHost";
import type { SceneSyncController } from "./SceneSyncController";
export interface DragAndScaleViewportPort {
    getScale(): number;
    getOffsetX(): number;
    getOffsetY(): number;
    setScale(value: number, zoomingCenter?: Vector2): void;
    setOffset(x: number, y: number): void;
    moveByScreenDelta(deltaX: number, deltaY: number): void;
    reset(): void;
}
interface ViewportDragAndScaleHost {
    readonly min_scale: number;
    readonly max_scale: number;
    attachViewportPort: (port: DragAndScaleViewportPort) => void;
    detachViewportPort: (port?: DragAndScaleViewportPort) => void;
}
export declare class ViewportController implements DragAndScaleViewportPort {
    private readonly appHost;
    private readonly dragAndScale;
    private readonly getWorldBounds?;
    private scaleListenerId;
    private moveListenerId;
    private sceneSyncController;
    private queuedScaleRepaintFrame;
    private lastScale;
    constructor(appHost: LeaferAppHost, dragAndScale: ViewportDragAndScaleHost, getWorldBounds?: (() => Vector4 | null) | undefined);
    destroy(): void;
    setSceneSyncController(sceneSyncController: Pick<SceneSyncController, "repaintLegacyNodeHosts" | "repaintAllLinkViews"> | null): void;
    getScale(): number;
    getOffsetX(): number;
    getOffsetY(): number;
    setScale(value: number, zoomingCenter?: Vector2): void;
    setOffset(x: number, y: number): void;
    moveByScreenDelta(deltaX: number, deltaY: number): void;
    reset(): void;
    private readonly handleTreeScale;
    private readonly handleTreeMove;
    private queueLegacyScaleRepaint;
    private clampScale;
    private resolveWorldOrigin;
    private clampOffset;
    private clampValue;
    private applyClampedOffset;
    private resolveWorldBoundsMinScale;
    private syncBackgroundViewport;
}
export {};
