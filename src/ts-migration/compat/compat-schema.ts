import type { Vector4 } from "../types/core-types";
import type { SerializedLGraphGroup, SerializedLLink } from "../types/serialization";

export type CompatCallback = (...args: unknown[]) => unknown;

export const LITEGRAPH_COMPAT_DIFF_IDS = {
    constantsGridSquareAlias: "constants.grid-square-alias",
    canvasStaticResize: "canvas-static.resize",
    canvasStaticSubgraphMenu: "canvas-static.subgraph-menu",
    canvasInstanceDeselected: "canvas-instance.deselected",
    canvasInstanceSlotGraphic: "canvas-instance.slot-graphic",
    canvasInstanceTouchHandler: "canvas-instance.touch-handler",
    serializationLinkTupleOrder: "serialization.link-tuple-order",
    serializationGroupFontField: "serialization.group-font-field",
    uiCloseAllContextMenus: "ui.close-all-context-menus",
    graphHooksOnNodeAdded: "graph-hooks.on-node-added",
    canvasStaticMissingApis: "canvas-static.missing-apis",
} as const;

type LiteGraphCompatSchemaEntry = {
    readonly id: string;
    readonly area:
        | "constants"
        | "canvas-static"
        | "canvas-instance"
        | "serialization"
        | "ui"
        | "graph-hooks";
    readonly runtimeMode: "assembly" | "helper";
    readonly dts: string;
    readonly runtime: string;
    readonly strategy: string;
};

export const LITEGRAPH_API_DIFF_MATRIX = [
    {
        id: LITEGRAPH_COMPAT_DIFF_IDS.constantsGridSquareAlias,
        area: "constants",
        runtimeMode: "assembly",
        dts: "LiteGraph.SQUARE_SHAPE = 6",
        runtime: "LiteGraph.GRID_SHAPE = 6",
        strategy: "双向常量别名，保持同值 6",
    },
    {
        id: LITEGRAPH_COMPAT_DIFF_IDS.canvasStaticResize,
        area: "canvas-static",
        runtimeMode: "assembly",
        dts: "LGraphCanvas.onResizeNode",
        runtime: "LGraphCanvas.onMenuResizeNode",
        strategy: "静态方法双向别名",
    },
    {
        id: LITEGRAPH_COMPAT_DIFF_IDS.canvasStaticSubgraphMenu,
        area: "canvas-static",
        runtimeMode: "assembly",
        dts: "缺失 onMenuNodeToSubgraph",
        runtime: "存在 LGraphCanvas.onMenuNodeToSubgraph",
        strategy: "提供 onNodeToSubgraph 兼容别名",
    },
    {
        id: LITEGRAPH_COMPAT_DIFF_IDS.canvasInstanceDeselected,
        area: "canvas-instance",
        runtimeMode: "assembly",
        dts: "LGraphCanvas.prototype.processNodeDeselected",
        runtime: "缺失同名实现",
        strategy: "可选 shim，回退到 deselectNode",
    },
    {
        id: LITEGRAPH_COMPAT_DIFF_IDS.canvasInstanceSlotGraphic,
        area: "canvas-instance",
        runtimeMode: "assembly",
        dts: "LGraphCanvas.prototype.drawSlotGraphic",
        runtime: "缺失同名实现",
        strategy: "可选 no-op shim",
    },
    {
        id: LITEGRAPH_COMPAT_DIFF_IDS.canvasInstanceTouchHandler,
        area: "canvas-instance",
        runtimeMode: "assembly",
        dts: "LGraphCanvas.prototype.touchHandler",
        runtime: "源码注释掉实现",
        strategy: "可选 no-op shim",
    },
    {
        id: LITEGRAPH_COMPAT_DIFF_IDS.serializationLinkTupleOrder,
        area: "serialization",
        runtimeMode: "helper",
        dts: "[id,type,origin_id,origin_slot,target_id,target_slot]",
        runtime: "[id,origin_id,origin_slot,target_id,target_slot,type]",
        strategy: "输入双格式归一化，输出可选 d.ts/runtime 顺序",
    },
    {
        id: LITEGRAPH_COMPAT_DIFF_IDS.serializationGroupFontField,
        area: "serialization",
        runtimeMode: "helper",
        dts: "SerializedLGraphGroup.font",
        runtime: "SerializedLGraphGroup.font_size",
        strategy: "输入双字段兼容，统一归一化为 font_size",
    },
    {
        id: LITEGRAPH_COMPAT_DIFF_IDS.uiCloseAllContextMenus,
        area: "ui",
        runtimeMode: "assembly",
        dts: "ContextMenu.closeAllContextMenus",
        runtime: "LiteGraph.closeAllContextMenus",
        strategy: "双向挂载同一函数引用",
    },
    {
        id: LITEGRAPH_COMPAT_DIFF_IDS.graphHooksOnNodeAdded,
        area: "graph-hooks",
        runtimeMode: "helper",
        dts: "LGraph.onNodeAdded",
        runtime: "仅调用点存在，未强定义",
        strategy: "统一通过 helper 安全触发",
    },
    {
        id: LITEGRAPH_COMPAT_DIFF_IDS.canvasStaticMissingApis,
        area: "canvas-static",
        runtimeMode: "assembly",
        dts: "getBoundaryNodes/alignNodes/onNodeAlign/onGroupAlign/getPropertyPrintableValue",
        runtime: "均存在",
        strategy: "迁移层已实现，兼容模块仅做存在性守卫",
    },
] as const satisfies readonly LiteGraphCompatSchemaEntry[];

export type LiteGraphCompatDiffId =
    (typeof LITEGRAPH_API_DIFF_MATRIX)[number]["id"];
export type LiteGraphCompatArea =
    (typeof LITEGRAPH_API_DIFF_MATRIX)[number]["area"];
export type LiteGraphCompatRuntimeMode =
    (typeof LITEGRAPH_API_DIFF_MATRIX)[number]["runtimeMode"];
export type LiteGraphCompatDiffItem<
    TId extends LiteGraphCompatDiffId = LiteGraphCompatDiffId,
> = Extract<(typeof LITEGRAPH_API_DIFF_MATRIX)[number], { readonly id: TId }>;
export type LiteGraphCompatAssemblyDiffId = Extract<
    (typeof LITEGRAPH_API_DIFF_MATRIX)[number],
    { readonly runtimeMode: "assembly" }
>["id"];

export type LiteGraphCompatSchemaById = {
    [TId in LiteGraphCompatDiffId]: LiteGraphCompatDiffItem<TId>;
};

export type SerializedLLinkDtsOrder = [
    number,
    string,
    number,
    number,
    number,
    number,
];

export type SerializedLLinkRuntimeOrder = [
    number,
    number,
    number,
    number,
    number,
    string,
];

export type SerializedLLinkDtsInput = readonly [
    number,
    string,
    number,
    number,
    number,
    number,
];

export type SerializedLLinkRuntimeInput = readonly [
    number,
    number,
    number,
    number,
    number,
    string,
];

export type SerializedLLinkCompatInput =
    | SerializedLLink
    | SerializedLLinkDtsInput
    | SerializedLLinkRuntimeInput;

export type SerializedLLinkRuntime = SerializedLLinkRuntimeOrder;
export type SerializedLLinkOrder = "runtime" | "dts";

export interface SerializedLGraphGroupDtsShape {
    title: string;
    bounding: Vector4;
    color: string;
    font: string;
}

export interface SerializedLGraphGroupRuntime {
    title: string;
    bounding: Vector4;
    color: string;
    font_size: number;
}

export type SerializedLGraphGroupCompatInput =
    | SerializedLGraphGroup
    | SerializedLGraphGroupDtsShape
    | SerializedLGraphGroupRuntime
    | {
          title: string;
          bounding: Vector4;
          color: string;
          font?: string | number;
          font_size?: string | number;
      };

export type SerializedLGraphGroupOrder = "runtime" | "dts";

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
    [key: string]: unknown;
}

export interface LGraphHooksCompatHost<TNode = unknown> {
    onNodeAdded?: ((node: TNode) => void) | null;
    [key: string]: unknown;
}

export interface LiteGraphApiCompatTargets {
    liteGraph?: LiteGraphConstantAliasHost & LiteGraphContextMenuCompatHost;
    canvasStatic?: LGraphCanvasStaticCompatHost;
    canvasPrototype?: LGraphCanvasPrototypeCompatHost;
}
