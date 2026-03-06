import {
    LITEGRAPH_COMPAT_DIFF_IDS,
    type CompatCallback,
    type LGraphCanvasStaticCompatHost,
} from "../compat/compat-schema";

export const LGRAPHCANVAS_STATIC_RESIZE_DIFF_ID =
    LITEGRAPH_COMPAT_DIFF_IDS.canvasStaticResize;
export const LGRAPHCANVAS_STATIC_SUBGRAPH_MENU_DIFF_ID =
    LITEGRAPH_COMPAT_DIFF_IDS.canvasStaticSubgraphMenu;
export const LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID =
    LITEGRAPH_COMPAT_DIFF_IDS.canvasStaticMissingApis;

export type LGraphCanvasStaticCompatCallback = CompatCallback;

export interface LGraphCanvasStaticMissingApiFallbackResult {
    diffId: typeof LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID;
    filled: Array<
        | "getBoundaryNodes"
        | "alignNodes"
        | "onNodeAlign"
        | "onGroupAlign"
        | "getPropertyPrintableValue"
    >;
}

/**
 * Static compatibility layer:
 * alias alignment between d.ts/runtime names.
 */
export function applyLGraphCanvasStaticCompatAliases(
    host: LGraphCanvasStaticCompatHost
): void {
    if (!host.onResizeNode && host.onMenuResizeNode) {
        host.onResizeNode = host.onMenuResizeNode;
    }
    if (!host.onMenuResizeNode && host.onResizeNode) {
        host.onMenuResizeNode = host.onResizeNode;
    }

    if (!host.onNodeToSubgraph && host.onMenuNodeToSubgraph) {
        host.onNodeToSubgraph = host.onMenuNodeToSubgraph;
    }
    if (!host.onMenuNodeToSubgraph && host.onNodeToSubgraph) {
        host.onMenuNodeToSubgraph = host.onNodeToSubgraph;
    }
}

export function applyLGraphCanvasStaticMissingApiGuards(
    host: LGraphCanvasStaticCompatHost
): LGraphCanvasStaticMissingApiFallbackResult {
    const filled: LGraphCanvasStaticMissingApiFallbackResult["filled"] = [];

    if (!host.getBoundaryNodes) {
        host.getBoundaryNodes = () => ({
            top: null,
            right: null,
            bottom: null,
            left: null,
        });
        filled.push("getBoundaryNodes");
    }

    if (!host.alignNodes) {
        host.alignNodes = (): void => {};
        filled.push("alignNodes");
    }

    if (!host.onNodeAlign) {
        host.onNodeAlign = (): void => {};
        filled.push("onNodeAlign");
    }

    if (!host.onGroupAlign) {
        host.onGroupAlign = (): void => {};
        filled.push("onGroupAlign");
    }

    if (!host.getPropertyPrintableValue) {
        host.getPropertyPrintableValue = (value: unknown): string =>
            String(value);
        filled.push("getPropertyPrintableValue");
    }

    return {
        diffId: LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID,
        filled,
    };
}

export function applyLGraphCanvasStaticCompat(
    host: LGraphCanvasStaticCompatHost
): LGraphCanvasStaticMissingApiFallbackResult {
    applyLGraphCanvasStaticCompatAliases(host);
    return applyLGraphCanvasStaticMissingApiGuards(host);
}

export function hasRequiredLGraphCanvasStaticApis(
    host: LGraphCanvasStaticCompatHost
): boolean {
    return (
        typeof host.onResizeNode === "function" &&
        typeof host.onMenuResizeNode === "function" &&
        typeof host.onNodeToSubgraph === "function" &&
        typeof host.onMenuNodeToSubgraph === "function" &&
        typeof host.getBoundaryNodes === "function" &&
        typeof host.alignNodes === "function" &&
        typeof host.onNodeAlign === "function" &&
        typeof host.onGroupAlign === "function" &&
        typeof host.getPropertyPrintableValue === "function"
    );
}
