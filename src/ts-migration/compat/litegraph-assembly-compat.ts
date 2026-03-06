import { applyLiteGraphApiCompatAliases } from "../types/litegraph-compat";

type LiteGraphAssemblyCanvasStaticLike = object & {
    prototype: Record<string, unknown>;
};

export interface LiteGraphAssemblyCompatLike {
    LiteGraph: Record<string, unknown>;
    LGraphCanvas: LiteGraphAssemblyCanvasStaticLike;
}

export function applyLiteGraphAssemblyCompat(
    bundle: LiteGraphAssemblyCompatLike
): void {
    applyLiteGraphApiCompatAliases({
        liteGraph: bundle.LiteGraph as never,
        canvasStatic: bundle.LGraphCanvas as never,
        canvasPrototype: bundle.LGraphCanvas.prototype as never,
    });
}
