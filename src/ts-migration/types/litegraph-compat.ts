import type { SerializedLGraphGroup, SerializedLLink } from "./serialization";
import {
    applyLGraphCanvasStaticCompat as applyLGraphCanvasStaticCompatImpl,
    applyLGraphCanvasStaticCompatAliases as applyLGraphCanvasStaticCompatAliasesImpl,
} from "../canvas/LGraphCanvas.static.compat";
import { applyContextMenuCloseAllCompat as applyContextMenuCloseAllCompatImpl } from "../ui/context-menu-compat";
import { invokeGraphOnNodeAddedCompatHook as invokeGraphOnNodeAddedCompatHookImpl } from "../models/LGraph.hooks";

export type CompatCallback = (...args: unknown[]) => unknown;

export type SerializedLLinkRuntime = [
    number,
    number,
    number,
    number,
    number,
    string
];

export type SerializedLLinkCompatInput = SerializedLLink | SerializedLLinkRuntime;

export interface SerializedLGraphGroupRuntime {
    title: string;
    bounding: [number, number, number, number];
    color: string;
    font_size: number;
}

export type SerializedLGraphGroupCompatInput =
    | SerializedLGraphGroupRuntime
    | SerializedLGraphGroup
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

/**
 * Task 30 required diff matrix:
 * d.ts 与 runtime 的命名/存在性/序列化差异总表。
 */
export const LITEGRAPH_API_DIFF_MATRIX: readonly LiteGraphCompatDiffItem[] = [
    {
        id: "constants.grid-square-alias",
        area: "constants",
        dts: "LiteGraph.SQUARE_SHAPE = 6",
        runtime: "LiteGraph.GRID_SHAPE = 6",
        strategy: "双向常量别名，保持同值 6",
    },
    {
        id: "canvas-static.resize",
        area: "canvas-static",
        dts: "LGraphCanvas.onResizeNode",
        runtime: "LGraphCanvas.onMenuResizeNode",
        strategy: "静态方法双向别名",
    },
    {
        id: "canvas-static.subgraph-menu",
        area: "canvas-static",
        dts: "缺失 onMenuNodeToSubgraph",
        runtime: "存在 LGraphCanvas.onMenuNodeToSubgraph",
        strategy: "提供 onNodeToSubgraph 兼容别名",
    },
    {
        id: "canvas-instance.deselected",
        area: "canvas-instance",
        dts: "LGraphCanvas.prototype.processNodeDeselected",
        runtime: "缺失同名实现",
        strategy: "可选 shim，回退到 deselectNode",
    },
    {
        id: "canvas-instance.slot-graphic",
        area: "canvas-instance",
        dts: "LGraphCanvas.prototype.drawSlotGraphic",
        runtime: "缺失同名实现",
        strategy: "可选 no-op shim",
    },
    {
        id: "canvas-instance.touch-handler",
        area: "canvas-instance",
        dts: "LGraphCanvas.prototype.touchHandler",
        runtime: "源码注释掉实现",
        strategy: "可选 no-op shim",
    },
    {
        id: "serialization.link-tuple-order",
        area: "serialization",
        dts: "[id,type,origin_id,origin_slot,target_id,target_slot]",
        runtime: "[id,origin_id,origin_slot,target_id,target_slot,type]",
        strategy: "输入双格式归一化，输出可选 d.ts/runtime 顺序",
    },
    {
        id: "serialization.group-font-field",
        area: "serialization",
        dts: "SerializedLGraphGroup.font",
        runtime: "SerializedLGraphGroup.font_size",
        strategy: "输入双字段兼容，统一归一化为 font_size",
    },
    {
        id: "ui.close-all-context-menus",
        area: "ui",
        dts: "ContextMenu.closeAllContextMenus",
        runtime: "LiteGraph.closeAllContextMenus",
        strategy: "双向挂载同一函数引用",
    },
    {
        id: "graph-hooks.on-node-added",
        area: "graph-hooks",
        dts: "LGraph.onNodeAdded",
        runtime: "仅调用点存在，未强定义",
        strategy: "统一通过 helper 安全触发",
    },
    {
        id: "canvas-static.missing-apis",
        area: "canvas-static",
        dts: "getBoundaryNodes/alignNodes/onNodeAlign/onGroupAlign/getPropertyPrintableValue",
        runtime: "均存在",
        strategy: "迁移层已实现，兼容模块仅做存在性守卫",
    },
] as const;

export function isSerializedLLinkDtsOrder(
    tuple: readonly unknown[]
): tuple is SerializedLLink {
    return typeof tuple[1] === "string";
}

export function normalizeSerializedLLinkTuple(
    tuple: SerializedLLinkCompatInput
): SerializedLLinkRuntime {
    const source = tuple as readonly unknown[];
    if (isSerializedLLinkDtsOrder(source)) {
        return [
            Number(source[0] ?? 0),
            Number(source[2] ?? 0),
            Number(source[3] ?? 0),
            Number(source[4] ?? 0),
            Number(source[5] ?? 0),
            String(source[1] ?? ""),
        ];
    }

    return [
        Number(source[0] ?? 0),
        Number(source[1] ?? 0),
        Number(source[2] ?? 0),
        Number(source[3] ?? 0),
        Number(source[4] ?? 0),
        String(source[5] ?? ""),
    ];
}

export function denormalizeSerializedLLinkTuple(
    tuple: SerializedLLinkRuntime,
    order: "runtime" | "dts" = "runtime"
): SerializedLLinkRuntime | SerializedLLink {
    if (order === "runtime") {
        return tuple;
    }
    return [
        tuple[0],
        tuple[5],
        tuple[1],
        tuple[2],
        tuple[3],
        tuple[4],
    ];
}

export function normalizeSerializedLGraphGroup(
    group: SerializedLGraphGroupCompatInput,
    defaultFontSize = 24
): SerializedLGraphGroupRuntime {
    const anyGroup = group as {
        title: string;
        bounding: [number, number, number, number];
        color: string;
        font?: string | number;
        font_size?: string | number;
    };

    let fontSize = parseNumber(anyGroup.font_size);
    if (fontSize == null) {
        fontSize = parseNumber(anyGroup.font);
    }
    if (fontSize == null) {
        fontSize = defaultFontSize;
    }

    return {
        title: anyGroup.title,
        bounding: anyGroup.bounding,
        color: anyGroup.color,
        font_size: fontSize,
    };
}

export function denormalizeSerializedLGraphGroup(
    group: SerializedLGraphGroupRuntime
): SerializedLGraphGroup {
    return {
        title: group.title,
        bounding: group.bounding,
        color: group.color,
        font: String(group.font_size),
    };
}

export function applyLiteGraphConstantAliases(
    host: LiteGraphConstantAliasHost,
    fallbackValue = 6
): number {
    const resolved =
        typeof host.GRID_SHAPE === "number"
            ? host.GRID_SHAPE
            : typeof host.SQUARE_SHAPE === "number"
              ? host.SQUARE_SHAPE
              : fallbackValue;

    host.GRID_SHAPE = resolved;
    host.SQUARE_SHAPE = resolved;
    return resolved;
}

export function applyLGraphCanvasStaticCompatAliases(
    host: LGraphCanvasStaticCompatHost
): void {
    applyLGraphCanvasStaticCompatAliasesImpl(host);
}

export function applyLGraphCanvasStaticCompat(
    host: LGraphCanvasStaticCompatHost
): void {
    applyLGraphCanvasStaticCompatImpl(host);
}

export function applyLGraphCanvasPrototypeCompatShims(
    host: LGraphCanvasPrototypeCompatHost
): void {
    if (!host.processNodeDeselected && host.deselectNode) {
        host.processNodeDeselected = (node: unknown): void => {
            host.deselectNode?.(node);
        };
    }
    if (!host.drawSlotGraphic) {
        host.drawSlotGraphic = (): void => {};
    }
    if (!host.touchHandler) {
        host.touchHandler = (): void => {};
    }
}

export function applyContextMenuCloseAllCompat(
    liteGraph: LiteGraphContextMenuCompatHost
): void {
    applyContextMenuCloseAllCompatImpl(liteGraph);
}

export function invokeGraphOnNodeAddedCompatHook(
    graph: LGraphHooksCompatHost,
    node: unknown
): void {
    invokeGraphOnNodeAddedCompatHookImpl(graph, node);
}

export interface LiteGraphApiCompatTargets {
    liteGraph?: LiteGraphConstantAliasHost & LiteGraphContextMenuCompatHost;
    canvasStatic?: LGraphCanvasStaticCompatHost;
    canvasPrototype?: LGraphCanvasPrototypeCompatHost;
}

export function applyLiteGraphApiCompatAliases(
    targets: LiteGraphApiCompatTargets
): void {
    if (targets.liteGraph) {
        applyLiteGraphConstantAliases(targets.liteGraph);
        applyContextMenuCloseAllCompat(targets.liteGraph);
    }
    if (targets.canvasStatic) {
        applyLGraphCanvasStaticCompat(targets.canvasStatic);
    }
    if (targets.canvasPrototype) {
        applyLGraphCanvasPrototypeCompatShims(targets.canvasPrototype);
    }
}

function parseNumber(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) {
        return v;
    }
    if (typeof v === "string" && v.trim() !== "") {
        const parsed = Number(v);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}
