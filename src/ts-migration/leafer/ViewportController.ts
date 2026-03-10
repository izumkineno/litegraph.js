import "@leafer-in/view";
import "@leafer-in/viewport";
import { addViewport } from "@leafer-in/viewport";

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

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

const WORLD_BOUNDS_CAMERA_RING = 160;

export class ViewportController implements DragAndScaleViewportPort {
    private scaleListenerId: unknown = null;
    private moveListenerId: unknown = null;
    private sceneSyncController: Pick<
        SceneSyncController,
        "repaintLegacyNodeHosts" | "repaintAllLinkViews"
    > | null = null;
    private queuedScaleRepaintFrame: number | null = null;
    private lastScale = 1;

    constructor(
        private readonly appHost: LeaferAppHost,
        private readonly dragAndScale: ViewportDragAndScaleHost,
        private readonly getWorldBounds?: () => Vector4 | null
    ) {
        addViewport(this.appHost.tree, {
            wheel: {
                zoomMode: true,
                preventDefault: true,
            },
            touch: {
                preventDefault: true,
            },
            pointer: {
                preventDefaultMenu: true,
            },
            zoom: {
                min: this.dragAndScale.min_scale,
                max: this.dragAndScale.max_scale,
            },
            move: {
                drag: false,
                dragEmpty: false,
                dragAnimate: false,
                holdSpaceKey: true,
                holdMiddleKey: true,
            },
        });

        this.lastScale = this.getScale();
        this.scaleListenerId = this.appHost.tree.on_(
            "leafer.scale",
            this.handleTreeScale
        );
        this.moveListenerId = this.appHost.tree.on_(
            "leafer.move",
            this.handleTreeMove
        );
        this.dragAndScale.attachViewportPort(this);
        this.syncBackgroundViewport();
    }

    destroy(): void {
        this.sceneSyncController = null;
        if (this.scaleListenerId) {
            this.appHost.tree.off_(this.scaleListenerId as never);
            this.scaleListenerId = null;
        }
        if (this.moveListenerId) {
            this.appHost.tree.off_(this.moveListenerId as never);
            this.moveListenerId = null;
        }
        if (this.queuedScaleRepaintFrame !== null) {
            const windowRef =
                this.appHost.view.ownerDocument?.defaultView || window;
            windowRef.cancelAnimationFrame(this.queuedScaleRepaintFrame);
            this.queuedScaleRepaintFrame = null;
        }
        this.dragAndScale.detachViewportPort(this);
    }

    setSceneSyncController(
        sceneSyncController: Pick<
            SceneSyncController,
            "repaintLegacyNodeHosts" | "repaintAllLinkViews"
        > | null
    ): void {
        this.sceneSyncController = sceneSyncController;
    }

    getScale(): number {
        const scale = toFiniteNumber(
            (this.appHost.treeZoomLayer as { scaleX?: unknown }).scaleX,
            1
        );
        return scale || 1;
    }

    getOffsetX(): number {
        return toFiniteNumber(
            (this.appHost.treeZoomLayer as { x?: unknown }).x
        ) / this.getScale();
    }

    getOffsetY(): number {
        return toFiniteNumber(
            (this.appHost.treeZoomLayer as { y?: unknown }).y
        ) / this.getScale();
    }

    setScale(value: number, zoomingCenter?: Vector2): void {
        const nextScale = this.clampScale(value);
        const currentScale = this.getScale();
        if (Math.abs(nextScale - currentScale) < 0.0001) {
            return;
        }

        const zoomableTree = this.appHost.tree as typeof this.appHost.tree & {
            zoom?: (
                zoomType: number,
                padding?: unknown,
                scroll?: unknown,
                transition?: unknown
            ) => unknown;
        };
        if (!zoomingCenter && typeof zoomableTree.zoom === "function") {
            zoomableTree.zoom(nextScale, 0, null, false);
            this.applyClampedOffset(nextScale);
            this.lastScale = this.getScale();
            this.syncBackgroundViewport();
            this.queueLegacyScaleRepaint();
            return;
        }

        const worldOrigin = this.resolveWorldOrigin(zoomingCenter);
        this.appHost.treeZoomLayer.scaleOfWorld(
            worldOrigin,
            nextScale / currentScale
        );
        this.applyClampedOffset(nextScale);
        this.lastScale = nextScale;
        this.syncBackgroundViewport();
        this.queueLegacyScaleRepaint();
    }

    setOffset(x: number, y: number): void {
        const scale = this.getScale();
        const [nextX, nextY] = this.clampOffset(
            toFiniteNumber(x),
            toFiniteNumber(y),
            scale
        );
        this.appHost.treeZoomLayer.x = nextX * scale;
        this.appHost.treeZoomLayer.y = nextY * scale;
        this.syncBackgroundViewport();
    }

    moveByScreenDelta(deltaX: number, deltaY: number): void {
        if (!deltaX && !deltaY) {
            return;
        }
        const scale = this.getScale();
        const currentX = this.getOffsetX();
        const currentY = this.getOffsetY();
        const [nextX, nextY] = this.clampOffset(
            currentX + toFiniteNumber(deltaX) / scale,
            currentY + toFiniteNumber(deltaY) / scale,
            scale
        );
        if (
            Math.abs(nextX - currentX) < 0.0001 &&
            Math.abs(nextY - currentY) < 0.0001
        ) {
            return;
        }
        this.appHost.treeZoomLayer.x = nextX * scale;
        this.appHost.treeZoomLayer.y = nextY * scale;
        this.syncBackgroundViewport();
    }

    reset(): void {
        const [nextX, nextY] = this.clampOffset(0, 0, 1);
        this.appHost.treeZoomLayer.x = nextX;
        this.appHost.treeZoomLayer.y = nextY;
        this.appHost.treeZoomLayer.scale = 1;
        this.lastScale = 1;
        this.syncBackgroundViewport();
        this.queueLegacyScaleRepaint();
    }

    private readonly handleTreeScale = (): void => {
        const nextScale = this.getScale();
        this.applyClampedOffset(nextScale);
        this.syncBackgroundViewport();
        if (Math.abs(nextScale - this.lastScale) < 0.0001) {
            return;
        }
        this.lastScale = nextScale;
        this.queueLegacyScaleRepaint();
    };

    private readonly handleTreeMove = (): void => {
        this.applyClampedOffset();
        this.syncBackgroundViewport();
    };

    private queueLegacyScaleRepaint(): void {
        if (!this.sceneSyncController || this.queuedScaleRepaintFrame !== null) {
            return;
        }

        const windowRef = this.appHost.view.ownerDocument?.defaultView || window;
        this.queuedScaleRepaintFrame = windowRef.requestAnimationFrame(() => {
            this.queuedScaleRepaintFrame = null;
            this.sceneSyncController?.repaintLegacyNodeHosts();
            this.sceneSyncController?.repaintAllLinkViews();
        });
    }

    private clampScale(value: number): number {
        const numericValue = toFiniteNumber(value, 1);
        const dynamicMinScale = this.resolveWorldBoundsMinScale();
        return Math.min(
            this.dragAndScale.max_scale,
            Math.max(
                Math.max(this.dragAndScale.min_scale, dynamicMinScale),
                numericValue
            )
        );
    }

    private resolveWorldOrigin(zoomingCenter?: Vector2): { x: number; y: number } {
        const rect = this.appHost.view.getBoundingClientRect();
        const centerX =
            zoomingCenter && Number.isFinite(zoomingCenter[0])
                ? zoomingCenter[0]
                : rect.width * 0.5;
        const centerY =
            zoomingCenter && Number.isFinite(zoomingCenter[1])
                ? zoomingCenter[1]
                : rect.height * 0.5;

        return this.appHost.app.getWorldPointByClient(
            {
                clientX: rect.left + centerX,
                clientY: rect.top + centerY,
            },
            true
        );
    }

    private clampOffset(x: number, y: number, scale: number): Vector2 {
        const bounds = this.getWorldBounds?.();
        if (!bounds) {
            return [x, y];
        }

        const rect = this.appHost.view.getBoundingClientRect();
        const safeScale = Math.max(0.0001, toFiniteNumber(scale, 1));
        const viewWidth = Math.max(1, rect.width / safeScale);
        const viewHeight = Math.max(1, rect.height / safeScale);
        const minOffsetX =
            viewWidth - (bounds[0] + bounds[2] + WORLD_BOUNDS_CAMERA_RING);
        const maxOffsetX = WORLD_BOUNDS_CAMERA_RING - bounds[0];
        const minOffsetY =
            viewHeight - (bounds[1] + bounds[3] + WORLD_BOUNDS_CAMERA_RING);
        const maxOffsetY = WORLD_BOUNDS_CAMERA_RING - bounds[1];

        return [
            this.clampValue(x, minOffsetX, maxOffsetX),
            this.clampValue(y, minOffsetY, maxOffsetY),
        ];
    }

    private clampValue(value: number, min: number, max: number): number {
        if (min > max) {
            return (min + max) * 0.5;
        }
        return Math.min(max, Math.max(min, value));
    }

    private applyClampedOffset(scale = this.getScale()): void {
        const currentX = this.getOffsetX();
        const currentY = this.getOffsetY();
        const [nextX, nextY] = this.clampOffset(currentX, currentY, scale);
        if (
            Math.abs(nextX - currentX) < 0.0001 &&
            Math.abs(nextY - currentY) < 0.0001
        ) {
            return;
        }

        this.appHost.treeZoomLayer.x = nextX * scale;
        this.appHost.treeZoomLayer.y = nextY * scale;
    }

    private resolveWorldBoundsMinScale(): number {
        const bounds = this.getWorldBounds?.();
        if (!bounds) {
            return this.dragAndScale.min_scale;
        }

        const rect = this.appHost.view.getBoundingClientRect();
        const maxVisibleWorldWidth = Math.max(
            1,
            bounds[2] + WORLD_BOUNDS_CAMERA_RING * 2
        );
        const maxVisibleWorldHeight = Math.max(
            1,
            bounds[3] + WORLD_BOUNDS_CAMERA_RING * 2
        );
        const fitWidthScale = rect.width / maxVisibleWorldWidth;
        const fitHeightScale = rect.height / maxVisibleWorldHeight;

        return Math.max(
            this.dragAndScale.min_scale,
            toFiniteNumber(fitWidthScale, this.dragAndScale.min_scale),
            toFiniteNumber(fitHeightScale, this.dragAndScale.min_scale)
        );
    }

    private syncBackgroundViewport(): void {
        this.appHost.syncBackgroundViewport(
            toFiniteNumber((this.appHost.treeZoomLayer as { x?: unknown }).x),
            toFiniteNumber((this.appHost.treeZoomLayer as { y?: unknown }).y),
            this.getScale()
        );
    }
}
