import {
    applyLGraphCanvasStaticCompat as applyLGraphCanvasStaticCompatImpl,
    applyLGraphCanvasStaticCompatAliases as applyLGraphCanvasStaticCompatAliasesImpl,
} from "../canvas/LGraphCanvas.static.compat";
import {
    applyGridSquareShapeAlias,
    GRID_SQUARE_SHAPE_DEFAULT,
} from "../core/litegraph.constants.compat";
import {
    denormalizeSerializedLGraphGroup as denormalizeSerializedLGraphGroupImpl,
    normalizeSerializedLGraphGroup as normalizeSerializedLGraphGroupImpl,
} from "../models/LGraphGroup.serialization.compat";
import { invokeGraphOnNodeAddedCompatHook as invokeGraphOnNodeAddedCompatHookImpl } from "../models/LGraph.hooks";
import {
    denormalizeSerializedLLinkTuple as denormalizeSerializedLLinkTupleImpl,
    isSerializedLLinkDtsOrder as isSerializedLLinkDtsOrderImpl,
    normalizeSerializedLLinkTuple as normalizeSerializedLLinkTupleImpl,
} from "../models/LLink.serialization.compat";
import { applyContextMenuCloseAllCompat as applyContextMenuCloseAllCompatImpl } from "../ui/context-menu-compat";
import {
    type LGraphCanvasPrototypeCompatHost,
    type LGraphCanvasStaticCompatHost,
    type LGraphHooksCompatHost,
    type LiteGraphApiCompatTargets,
    type LiteGraphCompatAssemblyDiffId,
    type LiteGraphCompatDiffItem,
    LITEGRAPH_API_DIFF_MATRIX,
    LITEGRAPH_COMPAT_DIFF_IDS,
    type LiteGraphConstantAliasHost,
    type LiteGraphContextMenuCompatHost,
    type SerializedLGraphGroupCompatInput,
    type SerializedLGraphGroupDtsShape,
    type SerializedLGraphGroupRuntime,
    type SerializedLLinkCompatInput,
    type SerializedLLinkDtsInput,
    type SerializedLLinkDtsOrder,
    type SerializedLLinkRuntime,
    type SerializedLLinkRuntimeInput,
} from "./compat-schema";

type LiteGraphCompatAssemblyApplierMap = {
    [TId in LiteGraphCompatAssemblyDiffId]: (
        targets: LiteGraphApiCompatTargets
    ) => void;
};

const LITEGRAPH_ASSEMBLY_APPLIERS = {
    [LITEGRAPH_COMPAT_DIFF_IDS.constantsGridSquareAlias]: (
        targets: LiteGraphApiCompatTargets
    ): void => {
        if (targets.liteGraph) {
            applyLiteGraphConstantAliases(targets.liteGraph);
        }
    },
    [LITEGRAPH_COMPAT_DIFF_IDS.canvasStaticResize]: (
        targets: LiteGraphApiCompatTargets
    ): void => {
        if (targets.canvasStatic) {
            applyLGraphCanvasStaticCompat(targets.canvasStatic);
        }
    },
    [LITEGRAPH_COMPAT_DIFF_IDS.canvasStaticSubgraphMenu]: (
        targets: LiteGraphApiCompatTargets
    ): void => {
        if (targets.canvasStatic) {
            applyLGraphCanvasStaticCompat(targets.canvasStatic);
        }
    },
    [LITEGRAPH_COMPAT_DIFF_IDS.canvasInstanceDeselected]: (
        targets: LiteGraphApiCompatTargets
    ): void => {
        if (targets.canvasPrototype) {
            applyLGraphCanvasPrototypeCompatShims(targets.canvasPrototype);
        }
    },
    [LITEGRAPH_COMPAT_DIFF_IDS.canvasInstanceSlotGraphic]: (
        targets: LiteGraphApiCompatTargets
    ): void => {
        if (targets.canvasPrototype) {
            applyLGraphCanvasPrototypeCompatShims(targets.canvasPrototype);
        }
    },
    [LITEGRAPH_COMPAT_DIFF_IDS.canvasInstanceTouchHandler]: (
        targets: LiteGraphApiCompatTargets
    ): void => {
        if (targets.canvasPrototype) {
            applyLGraphCanvasPrototypeCompatShims(targets.canvasPrototype);
        }
    },
    [LITEGRAPH_COMPAT_DIFF_IDS.uiCloseAllContextMenus]: (
        targets: LiteGraphApiCompatTargets
    ): void => {
        if (targets.liteGraph) {
            applyContextMenuCloseAllCompat(targets.liteGraph);
        }
    },
    [LITEGRAPH_COMPAT_DIFF_IDS.canvasStaticMissingApis]: (
        targets: LiteGraphApiCompatTargets
    ): void => {
        if (targets.canvasStatic) {
            applyLGraphCanvasStaticCompat(targets.canvasStatic);
        }
    },
} satisfies LiteGraphCompatAssemblyApplierMap;

function isAssemblyCompatDiff(
    diff: LiteGraphCompatDiffItem
): diff is LiteGraphCompatDiffItem<LiteGraphCompatAssemblyDiffId> {
    return diff.runtimeMode === "assembly";
}

export function isSerializedLLinkDtsOrder(
    tuple: readonly unknown[]
): tuple is SerializedLLinkDtsOrder | SerializedLLinkDtsInput {
    return isSerializedLLinkDtsOrderImpl(tuple);
}

export function normalizeSerializedLLinkTuple(
    tuple: SerializedLLinkCompatInput
): SerializedLLinkRuntime {
    return normalizeSerializedLLinkTupleImpl(tuple);
}

export function denormalizeSerializedLLinkTuple(
    tuple: SerializedLLinkRuntime | SerializedLLinkRuntimeInput,
    order: "runtime" | "dts" = "runtime"
): SerializedLLinkRuntime | SerializedLLinkDtsOrder {
    return denormalizeSerializedLLinkTupleImpl(tuple, order);
}

export function normalizeSerializedLGraphGroup(
    group: SerializedLGraphGroupCompatInput,
    defaultFontSize = 24
): SerializedLGraphGroupRuntime {
    return normalizeSerializedLGraphGroupImpl(group, defaultFontSize);
}

export function denormalizeSerializedLGraphGroup(
    group: SerializedLGraphGroupRuntime
): SerializedLGraphGroupDtsShape {
    return denormalizeSerializedLGraphGroupImpl(group);
}

export function applyLiteGraphConstantAliases(
    host: LiteGraphConstantAliasHost,
    fallbackValue = GRID_SQUARE_SHAPE_DEFAULT
): number {
    return applyGridSquareShapeAlias(host, fallbackValue).value;
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

export function applyLiteGraphApiCompatAliases(
    targets: LiteGraphApiCompatTargets
): void {
    for (const diff of LITEGRAPH_API_DIFF_MATRIX) {
        if (!isAssemblyCompatDiff(diff)) {
            continue;
        }
        LITEGRAPH_ASSEMBLY_APPLIERS[diff.id](targets);
    }
}
