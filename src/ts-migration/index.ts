import "@leafer-in/resize";
import { Flow } from "@leafer-in/flow";
import {
    applyLGraphCanvasStaticCompat as applyLGraphCanvasStaticCompatLayer,
    applyLGraphCanvasStaticCompatAliases as applyLGraphCanvasStaticCompatAliasesLayer,
    applyLGraphCanvasStaticMissingApiGuards,
    hasRequiredLGraphCanvasStaticApis,
    LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID,
    LGRAPHCANVAS_STATIC_RESIZE_DIFF_ID,
    LGRAPHCANVAS_STATIC_SUBGRAPH_MENU_DIFF_ID,
} from "./canvas/LGraphCanvas.static.compat";
import {
    attachLiteGraphCommonJsExports,
} from "./compat/cjs-exports";
import {
    applyLiteGraphAssemblyCompat,
} from "./compat/litegraph-assembly-compat";
import {
    attachLiteGraphAssemblyBridges,
    type LiteGraphAssemblyBridgeOptions,
} from "./compat/litegraph-assembly-bridges";
import {
    attachLiteGraphGlobalBridge,
} from "./compat/global-bridge";
import {
    GRID_SQUARE_SHAPE_DEFAULT,
    GRID_SQUARE_SHAPE_DIFF_ID,
    applyGridSquareShapeAlias,
    isGridSquareShapeAliasSynced,
    resolveGridSquareShapeValue,
} from "./core/litegraph.constants.compat";
import {
    ContextMenu,
    createLiteGraphNamespace,
    CurveEditor,
    DragAndScale,
    extendClass,
    LGraph,
    LGraphCanvas,
    LGraphGroup,
    LGraphNode,
    LLink,
} from "./core/litegraph.namespace";
import { LiteGraphConstants, type LiteGraphConstantsShape } from "./core/litegraph.constants";
import { LiteGraphRegistry } from "./core/litegraph.registry";
import { LiteGraphRuntime } from "./core/litegraph.runtime";
import {
    hasGraphOnNodeAddedCompatHook,
    invokeGraphOnNodeAddedCompatHook as invokeGraphOnNodeAddedCompatHookModel,
    LGRAPH_ON_NODE_ADDED_DIFF_ID,
} from "./models/LGraph.hooks";
import {
    denormalizeSerializedLGraphGroup as denormalizeSerializedLGraphGroupCompatShape,
    LGRAPHGROUP_SERIALIZATION_DIFF_ID,
    normalizeSerializedLGraphGroup as normalizeSerializedLGraphGroupCompatShape,
    parseSerializedLGraphGroupInput,
    serializeLGraphGroupShape,
} from "./models/LGraphGroup.serialization.compat";
import {
    denormalizeSerializedLLinkTuple as denormalizeSerializedLLinkCompatTuple,
    isSerializedLLinkDtsOrder as isSerializedLLinkDtsOrderCompat,
    LLINK_SERIALIZATION_DIFF_ID,
    normalizeSerializedLLinkTuple as normalizeSerializedLLinkCompatTuple,
    parseSerializedLLinkInput,
    serializeLLinkShape,
} from "./models/LLink.serialization.compat";
import {
    applyContextMenuCloseAllCompat as applyContextMenuCloseAllCompatUi,
    CONTEXT_MENU_CLOSE_ALL_DIFF_ID,
    isContextMenuCloseAllCompatSynced,
} from "./ui/context-menu-compat";
import {
    attachModernNodeRegistryApi,
    ModernNodeContracts,
    ModernNodeBase,
    ModernNodeChangeMask,
    getModernWidgetRenderer,
    registerModernNode,
    registerModernNodes,
    registerModernWidget,
    registerModernWidgets,
    type ModernNodeConstructorLike,
    type ModernWidgetRenderer,
} from "./leafer";
import { colorToString, hex2num, num2hex } from "./utils/color";
import { getParameterNames } from "./utils/function-signature";
import {
    compareObjects,
    distance,
    growBounding,
    isInsideBounding,
    isInsideRectangle,
} from "./utils/math-geometry";

export {
    LiteGraphConstants,
    LiteGraphRegistry,
    LiteGraphRuntime,
    applyGridSquareShapeAlias,
    resolveGridSquareShapeValue,
    isGridSquareShapeAliasSynced,
    GRID_SQUARE_SHAPE_DEFAULT,
    GRID_SQUARE_SHAPE_DIFF_ID,
    LGRAPHCANVAS_STATIC_RESIZE_DIFF_ID,
    LGRAPHCANVAS_STATIC_SUBGRAPH_MENU_DIFF_ID,
    LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID,
    LLINK_SERIALIZATION_DIFF_ID,
    LGRAPHGROUP_SERIALIZATION_DIFF_ID,
    CONTEXT_MENU_CLOSE_ALL_DIFF_ID,
    LGRAPH_ON_NODE_ADDED_DIFF_ID,
    isSerializedLLinkDtsOrderCompat,
    normalizeSerializedLLinkCompatTuple,
    denormalizeSerializedLLinkCompatTuple,
    parseSerializedLLinkInput,
    serializeLLinkShape,
    normalizeSerializedLGraphGroupCompatShape,
    denormalizeSerializedLGraphGroupCompatShape,
    parseSerializedLGraphGroupInput,
    serializeLGraphGroupShape,
    applyContextMenuCloseAllCompatUi,
    isContextMenuCloseAllCompatSynced,
    applyLGraphCanvasStaticCompatAliasesLayer,
    applyLGraphCanvasStaticMissingApiGuards,
    applyLGraphCanvasStaticCompatLayer,
    hasRequiredLGraphCanvasStaticApis,
    hasGraphOnNodeAddedCompatHook,
    invokeGraphOnNodeAddedCompatHookModel,
    LLink,
    CurveEditor,
    colorToString,
    hex2num,
    num2hex,
    compareObjects,
    distance,
    growBounding,
    isInsideBounding,
    isInsideRectangle,
    getParameterNames,
    attachLiteGraphGlobalBridge,
    attachLiteGraphCommonJsExports,
    applyLiteGraphAssemblyCompat,
    attachLiteGraphAssemblyBridges,
    ModernNodeBase,
    ModernNodeContracts,
    ModernNodeChangeMask,
    getModernWidgetRenderer,
    registerModernNode,
    registerModernNodes,
    registerModernWidget,
    registerModernWidgets,
};

export type { ModernWidgetRenderer, ModernWidgetSchema } from "./leafer";

export { LGraph, LGraphNode, LGraphGroup, DragAndScale, LGraphCanvas, ContextMenu };

export type LiteGraphNamespace = LiteGraphConstantsShape &
    Record<string, unknown> & {
        registerNodeType: LiteGraphRegistry["registerNodeType"];
        unregisterNodeType: LiteGraphRegistry["unregisterNodeType"];
        clearRegisteredTypes: LiteGraphRegistry["clearRegisteredTypes"];
        addNodeMethod: LiteGraphRegistry["addNodeMethod"];
        createNode: LiteGraphRegistry["createNode"];
        getNodeType: LiteGraphRegistry["getNodeType"];
        getNodeTypesInCategory: LiteGraphRegistry["getNodeTypesInCategory"];
        getNodeTypesCategories: LiteGraphRegistry["getNodeTypesCategories"];
        registerNodeAndSlotType: LiteGraphRuntime["registerNodeAndSlotType"];
        buildNodeClassFromObject: LiteGraphRuntime["buildNodeClassFromObject"];
        wrapFunctionAsNode: LiteGraphRuntime["wrapFunctionAsNode"];
        reloadNodes: LiteGraphRuntime["reloadNodes"];
        cloneObject: LiteGraphRuntime["cloneObject"];
        uuidv4: LiteGraphRuntime["uuidv4"];
        isValidConnection: LiteGraphRuntime["isValidConnection"];
        registerSearchboxExtra: LiteGraphRuntime["registerSearchboxExtra"];
        fetchFile: LiteGraphRuntime["fetchFile"];
        getTime: () => number;
        getParameterNames: typeof getParameterNames;
        compareObjects: typeof compareObjects;
        distance: typeof distance;
        colorToString: typeof colorToString;
        isInsideRectangle: typeof isInsideRectangle;
        growBounding: typeof growBounding;
        isInsideBounding: typeof isInsideBounding;
        hex2num: typeof hex2num;
        num2hex: typeof num2hex;
        extendClass: typeof extendClass;
        closeAllContextMenus: (ref_window?: Window) => void;
        pointerListenerAdd: (
            dom: EventTarget,
            eventName: string,
            callback: EventListenerOrEventListenerObject,
            capture?: boolean
        ) => void;
        pointerListenerRemove: (
            dom: EventTarget,
            eventName: string,
            callback: EventListenerOrEventListenerObject,
            capture?: boolean
        ) => void;
        LGraph: typeof LGraph;
        LLink: typeof LLink;
        LGraphNode: typeof LGraphNode;
        LGraphGroup: typeof LGraphGroup;
        DragAndScale: typeof DragAndScale;
        LGraphCanvas: typeof LGraphCanvas;
        ContextMenu: typeof ContextMenu;
        CurveEditor: typeof CurveEditor;
        ModernNodeBase: typeof ModernNodeBase;
        ModernNodeContracts: typeof ModernNodeContracts;
        ModernNodeChangeMask: typeof ModernNodeChangeMask;
        registerModernNode: (
            nodeClass: ModernNodeConstructorLike
        ) => string;
        registerModernNodes: (
            nodeClasses: ReadonlyArray<ModernNodeConstructorLike>
        ) => string[];
        registerModernWidget: (
            type: string,
            renderer: ModernWidgetRenderer
        ) => string;
        registerModernWidgets: (
            renderers: Record<string, ModernWidgetRenderer>
        ) => string[];
        getModernWidgetRenderer: (
            type: string
        ) => ModernWidgetRenderer | undefined;
    };

export interface LiteGraphAssembly {
    LiteGraph: LiteGraphNamespace;
    LGraph: typeof LGraph;
    LLink: typeof LLink;
    LGraphNode: typeof LGraphNode;
    LGraphGroup: typeof LGraphGroup;
    DragAndScale: typeof DragAndScale;
    LGraphCanvas: typeof LGraphCanvas;
    ContextMenu: typeof ContextMenu;
    CurveEditor: typeof CurveEditor;
    ModernNodeBase: typeof ModernNodeBase;
    ModernNodeContracts: typeof ModernNodeContracts;
    ModernNodeChangeMask: typeof ModernNodeChangeMask;
    registerModernNode: (
        nodeClass: ModernNodeConstructorLike
    ) => string;
    registerModernNodes: (
        nodeClasses: ReadonlyArray<ModernNodeConstructorLike>
    ) => string[];
    registerModernWidget: (
        type: string,
        renderer: ModernWidgetRenderer
    ) => string;
    registerModernWidgets: (
        renderers: Record<string, ModernWidgetRenderer>
    ) => string[];
    getModernWidgetRenderer: (
        type: string
    ) => ModernWidgetRenderer | undefined;
    registry: LiteGraphRegistry;
    runtime: LiteGraphRuntime;
}

export interface LiteGraphAssemblyOptions extends LiteGraphAssemblyBridgeOptions {}

function installModernNodeApi(liteGraph: LiteGraphNamespace): void {
    attachModernNodeRegistryApi(liteGraph);
    liteGraph.ModernNodeBase = ModernNodeBase;
    liteGraph.ModernNodeContracts = ModernNodeContracts;
    liteGraph.ModernNodeChangeMask = ModernNodeChangeMask;
    liteGraph.registerModernNode = (nodeClass: ModernNodeConstructorLike): string =>
        registerModernNode(nodeClass, liteGraph);
    liteGraph.registerModernNodes = (
        nodeClasses: ReadonlyArray<ModernNodeConstructorLike>
    ): string[] => registerModernNodes(nodeClasses, liteGraph);
    liteGraph.registerModernWidget = (
        type: string,
        renderer: ModernWidgetRenderer
    ): string => registerModernWidget(type, renderer);
    liteGraph.registerModernWidgets = (
        renderers: Record<string, ModernWidgetRenderer>
    ): string[] => registerModernWidgets(renderers);
    liteGraph.getModernWidgetRenderer = (
        type: string
    ): ModernWidgetRenderer | undefined => getModernWidgetRenderer(type);
}

function createAssemblyBundle(
    liteGraph: LiteGraphNamespace,
    registry: LiteGraphRegistry,
    runtime: LiteGraphRuntime
): LiteGraphAssembly {
    return {
        LiteGraph: liteGraph,
        LGraph,
        LLink,
        LGraphNode,
        LGraphGroup,
        DragAndScale,
        LGraphCanvas,
        ContextMenu,
        CurveEditor,
        ModernNodeBase,
        ModernNodeContracts,
        ModernNodeChangeMask,
        registerModernNode: liteGraph.registerModernNode,
        registerModernNodes: liteGraph.registerModernNodes,
        registerModernWidget: liteGraph.registerModernWidget,
        registerModernWidgets: liteGraph.registerModernWidgets,
        getModernWidgetRenderer: liteGraph.getModernWidgetRenderer,
        registry,
        runtime,
    };
}

/**
 * Task 31: 聚合导出与装配入口。
 * - 汇总分片类并暴露标准导出名。
 * - 组装 LiteGraph 命名空间（常量 + 注册/运行时 API + 工具函数）。
 * - 挂接兼容层与可选桥接能力。
 */
export function assembleLiteGraph(
    options: LiteGraphAssemblyOptions = {}
): LiteGraphAssembly {
    const { liteGraph, registry, runtime } = createLiteGraphNamespace();
    installModernNodeApi(liteGraph as LiteGraphNamespace);
    const bundle = createAssemblyBundle(
        liteGraph as LiteGraphNamespace,
        registry,
        runtime
    );

    applyLiteGraphAssemblyCompat(bundle);
    attachLiteGraphAssemblyBridges(bundle, options);

    return bundle;
}

const defaultAssembly = assembleLiteGraph();

export const LiteGraph = defaultAssembly.LiteGraph;
export const registry = defaultAssembly.registry;
export const runtime = defaultAssembly.runtime;
export const liteGraphMigrationBundle = defaultAssembly;

const leaferInGlobal = globalThis as typeof globalThis & {
    LeaferIN?: {
        flow?: Record<string, unknown>;
    };
};

leaferInGlobal.LeaferIN = leaferInGlobal.LeaferIN || {};
leaferInGlobal.LeaferIN.flow = {
    ...(leaferInGlobal.LeaferIN.flow || {}),
    Flow,
};
