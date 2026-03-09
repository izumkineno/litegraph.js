import type { Vector4 } from "../types/core-types";
import type { SerializedLGraphGroup, SerializedLLink } from "../types/serialization";
export type CompatCallback = (...args: unknown[]) => unknown;
export declare const LITEGRAPH_COMPAT_DIFF_IDS: {
    readonly constantsGridSquareAlias: "constants.grid-square-alias";
    readonly canvasStaticResize: "canvas-static.resize";
    readonly canvasStaticSubgraphMenu: "canvas-static.subgraph-menu";
    readonly canvasInstanceDeselected: "canvas-instance.deselected";
    readonly canvasInstanceSlotGraphic: "canvas-instance.slot-graphic";
    readonly canvasInstanceTouchHandler: "canvas-instance.touch-handler";
    readonly serializationLinkTupleOrder: "serialization.link-tuple-order";
    readonly serializationGroupFontField: "serialization.group-font-field";
    readonly uiCloseAllContextMenus: "ui.close-all-context-menus";
    readonly graphHooksOnNodeAdded: "graph-hooks.on-node-added";
    readonly canvasStaticMissingApis: "canvas-static.missing-apis";
};
export declare const LITEGRAPH_API_DIFF_MATRIX: readonly [{
    readonly id: "constants.grid-square-alias";
    readonly area: "constants";
    readonly runtimeMode: "assembly";
    readonly dts: "LiteGraph.SQUARE_SHAPE = 6";
    readonly runtime: "LiteGraph.GRID_SHAPE = 6";
    readonly strategy: "双向常量别名，保持同值 6";
}, {
    readonly id: "canvas-static.resize";
    readonly area: "canvas-static";
    readonly runtimeMode: "assembly";
    readonly dts: "LGraphCanvas.onResizeNode";
    readonly runtime: "LGraphCanvas.onMenuResizeNode";
    readonly strategy: "静态方法双向别名";
}, {
    readonly id: "canvas-static.subgraph-menu";
    readonly area: "canvas-static";
    readonly runtimeMode: "assembly";
    readonly dts: "缺失 onMenuNodeToSubgraph";
    readonly runtime: "存在 LGraphCanvas.onMenuNodeToSubgraph";
    readonly strategy: "提供 onNodeToSubgraph 兼容别名";
}, {
    readonly id: "canvas-instance.deselected";
    readonly area: "canvas-instance";
    readonly runtimeMode: "assembly";
    readonly dts: "LGraphCanvas.prototype.processNodeDeselected";
    readonly runtime: "缺失同名实现";
    readonly strategy: "可选 shim，回退到 deselectNode";
}, {
    readonly id: "canvas-instance.slot-graphic";
    readonly area: "canvas-instance";
    readonly runtimeMode: "assembly";
    readonly dts: "LGraphCanvas.prototype.drawSlotGraphic";
    readonly runtime: "缺失同名实现";
    readonly strategy: "可选 no-op shim";
}, {
    readonly id: "canvas-instance.touch-handler";
    readonly area: "canvas-instance";
    readonly runtimeMode: "assembly";
    readonly dts: "LGraphCanvas.prototype.touchHandler";
    readonly runtime: "源码注释掉实现";
    readonly strategy: "可选 no-op shim";
}, {
    readonly id: "serialization.link-tuple-order";
    readonly area: "serialization";
    readonly runtimeMode: "helper";
    readonly dts: "[id,type,origin_id,origin_slot,target_id,target_slot]";
    readonly runtime: "[id,origin_id,origin_slot,target_id,target_slot,type]";
    readonly strategy: "输入双格式归一化，输出可选 d.ts/runtime 顺序";
}, {
    readonly id: "serialization.group-font-field";
    readonly area: "serialization";
    readonly runtimeMode: "helper";
    readonly dts: "SerializedLGraphGroup.font";
    readonly runtime: "SerializedLGraphGroup.font_size";
    readonly strategy: "输入双字段兼容，统一归一化为 font_size";
}, {
    readonly id: "ui.close-all-context-menus";
    readonly area: "ui";
    readonly runtimeMode: "assembly";
    readonly dts: "ContextMenu.closeAllContextMenus";
    readonly runtime: "LiteGraph.closeAllContextMenus";
    readonly strategy: "双向挂载同一函数引用";
}, {
    readonly id: "graph-hooks.on-node-added";
    readonly area: "graph-hooks";
    readonly runtimeMode: "helper";
    readonly dts: "LGraph.onNodeAdded";
    readonly runtime: "仅调用点存在，未强定义";
    readonly strategy: "统一通过 helper 安全触发";
}, {
    readonly id: "canvas-static.missing-apis";
    readonly area: "canvas-static";
    readonly runtimeMode: "assembly";
    readonly dts: "getBoundaryNodes/alignNodes/onNodeAlign/onGroupAlign/getPropertyPrintableValue";
    readonly runtime: "均存在";
    readonly strategy: "迁移层已实现，兼容模块仅做存在性守卫";
}];
export type LiteGraphCompatDiffId = (typeof LITEGRAPH_API_DIFF_MATRIX)[number]["id"];
export type LiteGraphCompatArea = (typeof LITEGRAPH_API_DIFF_MATRIX)[number]["area"];
export type LiteGraphCompatRuntimeMode = (typeof LITEGRAPH_API_DIFF_MATRIX)[number]["runtimeMode"];
export type LiteGraphCompatDiffItem<TId extends LiteGraphCompatDiffId = LiteGraphCompatDiffId> = Extract<(typeof LITEGRAPH_API_DIFF_MATRIX)[number], {
    readonly id: TId;
}>;
export type LiteGraphCompatAssemblyDiffId = Extract<(typeof LITEGRAPH_API_DIFF_MATRIX)[number], {
    readonly runtimeMode: "assembly";
}>["id"];
export type LiteGraphCompatSchemaById = {
    [TId in LiteGraphCompatDiffId]: LiteGraphCompatDiffItem<TId>;
};
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
export type SerializedLLinkDtsInput = readonly [
    number,
    string,
    number,
    number,
    number,
    number
];
export type SerializedLLinkRuntimeInput = readonly [
    number,
    number,
    number,
    number,
    number,
    string
];
export type SerializedLLinkCompatInput = SerializedLLink | SerializedLLinkDtsInput | SerializedLLinkRuntimeInput;
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
export type SerializedLGraphGroupCompatInput = SerializedLGraphGroup | SerializedLGraphGroupDtsShape | SerializedLGraphGroupRuntime | {
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
