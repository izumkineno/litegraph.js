import { Path, Rect } from "leafer-ui";
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
    readonly connectionPreview: Path;
    readonly selectionBox: Rect;
    readonly workspaceBoundsOutline: Rect;
    constructor(appHost: LeaferAppHost);
    destroy(): void;
    setWorkspaceBounds(bounds: OverlayWorldBounds | null): void;
    setConnectionPreview(curve: LinkCurveGeometry, color?: string): void;
    hideConnectionPreview(): void;
    setSelectionBounds(bounds: OverlayWorldBounds): void;
    hideSelectionBox(): void;
    syncWorldTransform(): void;
}
