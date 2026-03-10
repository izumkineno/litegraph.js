import { Path, Rect } from "leafer-ui";

import type { LinkCurveGeometry } from "./NodePortAdapter";
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
    readonly workspaceBoundsOutline: Rect;

    constructor(private readonly appHost: LeaferAppHost) {
        this.connectionPreview = new Path({
            name: "litegraph-connection-preview",
            path: "",
            stroke: "#7F7",
            strokeWidth: 3,
            strokeCap: "round",
            strokeJoin: "round",
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

        this.workspaceBoundsOutline = new Rect({
            name: "litegraph-workspace-bounds-outline",
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            fill: "rgba(0,0,0,0)",
            stroke: "#8EA2B8",
            strokeWidth: 4,
            strokeCap: "round",
            strokeJoin: "round",
            dashPattern: [18, 10],
            opacity: 0.92,
            visible: false,
            hittable: false,
        });

        this.appHost.workspaceLayer.add(this.workspaceBoundsOutline);
        this.appHost.overlayWorld.add([
            this.connectionPreview,
            this.selectionBox,
        ]);
    }

    destroy(): void {
        this.connectionPreview.destroy();
        this.selectionBox.destroy();
        this.workspaceBoundsOutline.destroy();
    }

    setWorkspaceBounds(bounds: OverlayWorldBounds | null): void {
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            this.workspaceBoundsOutline.visible = false;
            return;
        }

        this.workspaceBoundsOutline.x = bounds.x;
        this.workspaceBoundsOutline.y = bounds.y;
        this.workspaceBoundsOutline.width = bounds.width;
        this.workspaceBoundsOutline.height = bounds.height;
        this.workspaceBoundsOutline.visible = true;
    }

    setConnectionPreview(curve: LinkCurveGeometry, color = "#7F7"): void {
        this.syncWorldTransform();
        this.connectionPreview.path = curve.path;
        this.connectionPreview.stroke = color;
        this.connectionPreview.strokeWidth = 3;
        this.connectionPreview.visible = true;
    }

    hideConnectionPreview(): void {
        this.connectionPreview.visible = false;
        this.connectionPreview.path = "";
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
