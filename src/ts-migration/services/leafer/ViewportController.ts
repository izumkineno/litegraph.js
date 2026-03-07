import "@leafer-in/viewport";
import { addViewport } from "@leafer-in/viewport";

import type { Vector2 } from "../../types/core-types";
import type { LeaferAppHost } from "./LeaferAppHost";

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

export class ViewportController implements DragAndScaleViewportPort {
    constructor(
        private readonly appHost: LeaferAppHost,
        private readonly dragAndScale: ViewportDragAndScaleHost
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

        this.dragAndScale.attachViewportPort(this);
    }

    destroy(): void {
        this.dragAndScale.detachViewportPort(this);
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

        const worldOrigin = this.resolveWorldOrigin(zoomingCenter);
        this.appHost.treeZoomLayer.scaleOfWorld(
            worldOrigin,
            nextScale / currentScale
        );
    }

    setOffset(x: number, y: number): void {
        const scale = this.getScale();
        this.appHost.treeZoomLayer.x = toFiniteNumber(x) * scale;
        this.appHost.treeZoomLayer.y = toFiniteNumber(y) * scale;
    }

    moveByScreenDelta(deltaX: number, deltaY: number): void {
        if (!deltaX && !deltaY) {
            return;
        }
        this.appHost.treeZoomLayer.move(deltaX, deltaY);
    }

    reset(): void {
        this.appHost.treeZoomLayer.x = 0;
        this.appHost.treeZoomLayer.y = 0;
        this.appHost.treeZoomLayer.scale = 1;
    }

    private clampScale(value: number): number {
        const numericValue = toFiniteNumber(value, 1);
        return Math.min(
            this.dragAndScale.max_scale,
            Math.max(this.dragAndScale.min_scale, numericValue)
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
}
