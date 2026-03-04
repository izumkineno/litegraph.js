/**
 * Supplemental compatibility declarations for `src/litegraph.d.ts` vs runtime.
 * Task 30 deliverable: type-level contract bridge and alias map declarations.
 */

export type CompatCallback = (...args: unknown[]) => unknown;

export type SerializedLLinkDtsOrder = [
    number,
    string,
    number,
    number,
    number,
    number
];

export type SerializedLLinkRuntimeOrder = [
    number,
    number,
    number,
    number,
    number,
    string
];

export type SerializedLLinkCompatInput =
    | SerializedLLinkDtsOrder
    | SerializedLLinkRuntimeOrder;

export interface SerializedLGraphGroupDtsShape {
    title: string;
    bounding: [number, number, number, number];
    color: string;
    font: string;
}

export interface SerializedLGraphGroupRuntimeShape {
    title: string;
    bounding: [number, number, number, number];
    color: string;
    font_size: number;
}

export type SerializedLGraphGroupCompatInput =
    | SerializedLGraphGroupDtsShape
    | SerializedLGraphGroupRuntimeShape
    | {
          title: string;
          bounding: [number, number, number, number];
          color: string;
          font?: string | number;
          font_size?: string | number;
      };

export interface LiteGraphConstantAliasHost {
    GRID_SHAPE?: number;
    SQUARE_SHAPE?: number;
    [key: string]: unknown;
}

export interface LGraphCanvasStaticCompatHost {
    onMenuResizeNode?: CompatCallback;
    onResizeNode?: CompatCallback;
    onMenuNodeToSubgraph?: CompatCallback;
    onNodeToSubgraph?: CompatCallback;
    getBoundaryNodes?: CompatCallback;
    alignNodes?: CompatCallback;
    onNodeAlign?: CompatCallback;
    onGroupAlign?: CompatCallback;
    getPropertyPrintableValue?: CompatCallback;
    [key: string]: unknown;
}

export interface LGraphCanvasPrototypeCompatHost {
    deselectNode?: (node: unknown) => void;
    processNodeDeselected?: (node: unknown) => void;
    drawSlotGraphic?: CompatCallback;
    touchHandler?: (event: unknown) => void;
    [key: string]: unknown;
}

export interface ContextMenuCloseCompatHost {
    closeAllContextMenus?: (refWindow?: Window) => void;
}

export interface LiteGraphContextMenuCompatHost {
    closeAllContextMenus?: (refWindow?: Window) => void;
    ContextMenu?: ContextMenuCloseCompatHost;
}

export interface LGraphHooksCompatHost {
    onNodeAdded?: ((node: unknown) => void) | null;
}

export type LiteGraphCompatArea =
    | "constants"
    | "canvas-static"
    | "canvas-instance"
    | "serialization"
    | "ui"
    | "graph-hooks";

export interface LiteGraphCompatDiffItem {
    id: string;
    area: LiteGraphCompatArea;
    dts: string;
    runtime: string;
    strategy: string;
}

export declare const LITEGRAPH_API_DIFF_MATRIX: readonly LiteGraphCompatDiffItem[];

export declare function isSerializedLLinkDtsOrder(
    tuple: readonly unknown[]
): tuple is SerializedLLinkDtsOrder;

export declare function normalizeSerializedLLinkTuple(
    tuple: SerializedLLinkCompatInput
): SerializedLLinkRuntimeOrder;

export declare function denormalizeSerializedLLinkTuple(
    tuple: SerializedLLinkRuntimeOrder,
    order?: "runtime" | "dts"
): SerializedLLinkRuntimeOrder | SerializedLLinkDtsOrder;

export declare function normalizeSerializedLGraphGroup(
    group: SerializedLGraphGroupCompatInput,
    defaultFontSize?: number
): SerializedLGraphGroupRuntimeShape;

export declare function denormalizeSerializedLGraphGroup(
    group: SerializedLGraphGroupRuntimeShape
): SerializedLGraphGroupDtsShape;

export declare function applyLiteGraphConstantAliases(
    host: LiteGraphConstantAliasHost,
    fallbackValue?: number
): number;

export declare function applyLGraphCanvasStaticCompatAliases(
    host: LGraphCanvasStaticCompatHost
): void;

export declare function applyLGraphCanvasPrototypeCompatShims(
    host: LGraphCanvasPrototypeCompatHost
): void;

export declare function applyContextMenuCloseAllCompat(
    liteGraph: LiteGraphContextMenuCompatHost
): void;

export declare function invokeGraphOnNodeAddedCompatHook(
    graph: LGraphHooksCompatHost,
    node: unknown
): void;

export interface LiteGraphApiCompatTargets {
    liteGraph?: LiteGraphConstantAliasHost & LiteGraphContextMenuCompatHost;
    canvasStatic?: LGraphCanvasStaticCompatHost;
    canvasPrototype?: LGraphCanvasPrototypeCompatHost;
}

export declare function applyLiteGraphApiCompatAliases(
    targets: LiteGraphApiCompatTargets
): void;
