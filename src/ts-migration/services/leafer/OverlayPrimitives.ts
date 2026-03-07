import { Path, Rect } from "leafer-ui";

import type { LeaferAppHost } from "./LeaferAppHost";

export interface OverlayWorldBounds {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

export class OverlayPrimitives {
    readonly connectionPreview: Path;
    readonly selectionBox: Rect;

    constructor(private readonly appHost: LeaferAppHost) {
        this.connectionPreview = new Path({
            name: "litegraph-connection-preview",
            path: "M 0 0 L 0 0",
            stroke: "#7F7",
            strokeWidth: 3,
            fill: "none",
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

        this.appHost.overlayWorld.add([
            this.connectionPreview,
            this.selectionBox,
        ]);
    }

    destroy(): void {
        this.connectionPreview.destroy();
        this.selectionBox.destroy();
    }

    setConnectionPreview(path: string, color = "#7F7"): void {
        this.syncWorldTransform();
        this.connectionPreview.path = path;
        this.connectionPreview.stroke = color;
        this.connectionPreview.visible = true;
    }

    hideConnectionPreview(): void {
        this.connectionPreview.visible = false;
        this.connectionPreview.path = "M 0 0 L 0 0";
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
}
