import { LGraphCanvasMenuPanel as LGraphCanvasImpl } from "./canvas/LGraphCanvas.menu-panel";
import {
    applyLGraphCanvasStaticCompat as applyLGraphCanvasStaticCompatLayer,
    applyLGraphCanvasStaticCompatAliases as applyLGraphCanvasStaticCompatAliasesLayer,
    applyLGraphCanvasStaticMissingApiGuards,
    hasRequiredLGraphCanvasStaticApis,
    LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID,
    LGRAPHCANVAS_STATIC_RESIZE_DIFF_ID,
    LGRAPHCANVAS_STATIC_SUBGRAPH_MENU_DIFF_ID,
} from "./canvas/LGraphCanvas.static.compat";
import { DragAndScale as DragAndScaleImpl } from "./canvas/DragAndScale";
import {
    attachLiteGraphCommonJsExports,
    type LiteGraphCommonJsExportsLike,
    type LiteGraphCommonJsGlobalLike,
} from "./compat/cjs-exports";
import {
    attachLiteGraphGlobalBridge,
    type GlobalBridgeOptions,
    type LiteGraphGlobalScopeLike,
    type LiteGraphRuntimeConstructors,
} from "./compat/global-bridge";
import { createTimeSource } from "./compat/time-source";
import {
    applyGridSquareShapeAlias,
    GRID_SQUARE_SHAPE_DEFAULT,
    GRID_SQUARE_SHAPE_DIFF_ID,
    isGridSquareShapeAliasSynced,
    resolveGridSquareShapeValue,
} from "./core/litegraph.constants.compat";
import { LiteGraphConstants, type LiteGraphConstantsShape } from "./core/litegraph.constants";
import {
    LiteGraphRegistry,
    type LiteGraphRegistryHost,
} from "./core/litegraph.registry";
import { LiteGraphRuntime } from "./core/litegraph.runtime";
import { LGraphPersistence as LGraphImpl } from "./models/LGraph.persistence";
import { LGraphGroup as LGraphGroupImpl } from "./models/LGraphGroup";
import { LGraphNode as LGraphNodeStateImpl } from "./models/LGraphNode.state";
import { LGraphNodeExecution as LGraphNodeExecutionImpl } from "./models/LGraphNode.execution";
import { LGraphNodePortsWidgets as LGraphNodePortsWidgetsImpl } from "./models/LGraphNode.ports-widgets";
import { LGraphNodeConnectGeometry as LGraphNodeConnectGeometryImpl } from "./models/LGraphNode.connect-geometry";
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
import { LGraphNodeCanvasCollab as LGraphNodeImpl } from "./models/LGraphNode.canvas-collab";
import {
    denormalizeSerializedLLinkTuple as denormalizeSerializedLLinkCompatTuple,
    isSerializedLLinkDtsOrder as isSerializedLLinkDtsOrderCompat,
    LLINK_SERIALIZATION_DIFF_ID,
    normalizeSerializedLLinkTuple as normalizeSerializedLLinkCompatTuple,
    parseSerializedLLinkInput,
    serializeLLinkShape,
} from "./models/LLink.serialization.compat";
import { LLink } from "./models/LLink";
import { applyLiteGraphApiCompatAliases } from "./types/litegraph-compat";
import { ContextMenu as ContextMenuImpl } from "./ui/ContextMenu";
import {
    applyContextMenuCloseAllCompat as applyContextMenuCloseAllCompatUi,
    CONTEXT_MENU_CLOSE_ALL_DIFF_ID,
    isContextMenuCloseAllCompatSynced,
} from "./ui/context-menu-compat";
import { CurveEditor } from "./ui/CurveEditor";
import { colorToString, hex2num, num2hex } from "./utils/color";
import { getParameterNames } from "./utils/function-signature";
import { LGraphCanvas as LGraphCanvasStaticImpl } from "./canvas/LGraphCanvas.static";
import { LGraphCanvasLifecycle as LGraphCanvasLifecycleImpl } from "./canvas/LGraphCanvas.lifecycle";
import { LGraphCanvasInput as LGraphCanvasInputImpl } from "./canvas/LGraphCanvas.input";
import { LGraphCanvasRender as LGraphCanvasRenderImpl } from "./canvas/LGraphCanvas.render";
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
};

export const LGraph = LGraphImpl;
export const LGraphNode = LGraphNodeImpl;
export const LGraphGroup = LGraphGroupImpl;
export const DragAndScale = DragAndScaleImpl;
export const LGraphCanvas = LGraphCanvasImpl;
export const ContextMenu = ContextMenuImpl;

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
    registry: LiteGraphRegistry;
    runtime: LiteGraphRuntime;
}

export interface LiteGraphAssemblyOptions {
    globalScope?: LiteGraphGlobalScopeLike;
    attachToGlobal?: boolean;
    attachCommonJsExports?: boolean;
    exportsTarget?: LiteGraphCommonJsExportsLike;
    bridgeOptions?: GlobalBridgeOptions;
}

function createPointerListenerCompat(methodRef: () => string): {
    add: (
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => void;
    remove: (
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => void;
} {
    type Entry = {
        original: EventListenerOrEventListenerObject;
        wrapped: EventListenerOrEventListenerObject;
    };
    type RegistryBucket = Record<string, Entry[]>;
    const registry = new WeakMap<EventTarget, RegistryBucket>();

    function resolveEvent(
        eventName: string,
        methodIn: string
    ): { domEvent: string; useTouchWrapper: boolean } | null {
        const requested = String(eventName || "").toLowerCase();
        let method = methodIn || "mouse";
        if (
            method === "pointer" &&
            (typeof window === "undefined" || !(window as unknown as { PointerEvent?: unknown }).PointerEvent)
        ) {
            method = "touch";
        }

        if (
            requested.indexOf("mouse") === 0 ||
            requested.indexOf("pointer") === 0 ||
            requested.indexOf("touch") === 0
        ) {
            return {
                domEvent: requested,
                useTouchWrapper: requested.indexOf("touch") === 0,
            };
        }

        const mapMouse: Record<string, string> = {
            down: "mousedown",
            move: "mousemove",
            up: "mouseup",
            over: "mouseover",
            out: "mouseout",
            enter: "mouseenter",
            leave: "mouseleave",
            cancel: "mouseup",
        };

        const mapPointer: Record<string, string> = {
            down: "pointerdown",
            move: "pointermove",
            up: "pointerup",
            over: "pointerover",
            out: "pointerout",
            enter: "pointerenter",
            leave: "pointerleave",
            cancel: "pointercancel",
            gotpointercapture: "gotpointercapture",
            lostpointercapture: "lostpointercapture",
        };

        const mapTouch: Record<string, string | null> = {
            down: "touchstart",
            move: "touchmove",
            up: "touchend",
            cancel: "touchcancel",
            over: null,
            out: null,
            enter: null,
            leave: null,
            gotpointercapture: null,
            lostpointercapture: null,
        };

        const map =
            method === "pointer"
                ? mapPointer
                : method === "touch"
                ? mapTouch
                : mapMouse;

        let domEvent = map[requested];
        if (!domEvent) {
            if (
                method === "touch" &&
                (requested === "enter" ||
                    requested === "leave" ||
                    requested === "over" ||
                    requested === "out")
            ) {
                return null;
            }
            domEvent = requested;
        }

        return {
            domEvent,
            useTouchWrapper: domEvent.indexOf("touch") === 0,
        };
    }

    function resolveEventOptions(
        domEvent: string,
        capture: boolean
    ): boolean | AddEventListenerOptions {
        if (domEvent && domEvent.indexOf("touch") === 0) {
            return { capture: !!capture, passive: false };
        }
        return !!capture;
    }

    function invokeCallback(
        callback: EventListenerOrEventListenerObject,
        context: unknown,
        event: unknown
    ): unknown {
        if (typeof callback === "function") {
            return callback.call(context, event as Event);
        }
        return callback.handleEvent(event as Event);
    }

    function normalizeTouchEvent(
        e: TouchEvent,
        semanticName: string,
        method: string
    ): Event | null {
        const touch =
            (e.changedTouches && e.changedTouches.length && e.changedTouches[0]) ||
            (e.touches && e.touches.length && e.touches[0]);
        if (!touch) {
            return null;
        }
        const normalized = {
            type: method + semanticName,
            clientX: touch.clientX,
            clientY: touch.clientY,
            pageX: touch.pageX,
            pageY: touch.pageY,
            screenX: touch.screenX,
            screenY: touch.screenY,
            which: 1,
            button: 0,
            buttons: e.type === "touchend" || e.type === "touchcancel" ? 0 : 1,
            isPrimary: true,
            pointerId: touch.identifier || 1,
            shiftKey: !!e.shiftKey,
            ctrlKey: !!e.ctrlKey,
            altKey: !!e.altKey,
            metaKey: !!e.metaKey,
            target: e.target,
            originalEvent: e,
            preventDefault: () => {
                if (e.cancelable && e.preventDefault) {
                    e.preventDefault();
                }
            },
            stopPropagation: () => {
                if (e.stopPropagation) {
                    e.stopPropagation();
                }
            },
            stopImmediatePropagation: () => {
                if (e.stopImmediatePropagation) {
                    e.stopImmediatePropagation();
                }
            },
        };
        return normalized as unknown as Event;
    }

    function add(
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture = false
    ): void {
        if (!dom || !("addEventListener" in dom)) {
            return;
        }
        const method = methodRef();
        const semanticName = String(eventName || "").toLowerCase();
        const resolved = resolveEvent(semanticName, method);
        if (!resolved || !resolved.domEvent) {
            return;
        }
        const domEvent = resolved.domEvent;

        let wrapped = callback;
        if (resolved.useTouchWrapper) {
            wrapped = function(this: unknown, ev: Event): void {
                const normalized = normalizeTouchEvent(
                    ev as TouchEvent,
                    semanticName,
                    method
                );
                if (!normalized) {
                    return;
                }
                if (
                    semanticName === "down" ||
                    semanticName === "move" ||
                    semanticName === "up" ||
                    semanticName === "cancel" ||
                    semanticName === "enter" ||
                    semanticName === "leave" ||
                    semanticName === "over" ||
                    semanticName === "out" ||
                    semanticName === "gotpointercapture" ||
                    semanticName === "lostpointercapture"
                ) {
                    (
                        normalized as unknown as {
                            type: string;
                        }
                    ).type = (methodRef() || "mouse") + semanticName;
                }
                invokeCallback(callback, this, normalized);
            } as EventListener;
        }

        let bucket = registry.get(dom);
        if (!bucket) {
            bucket = {};
            registry.set(dom, bucket);
        }
        const key = domEvent + "|" + (capture ? "1" : "0");
        if (!bucket[key]) {
            bucket[key] = [];
        }

        const existing = bucket[key].find((entry) => entry.original === callback);
        if (existing) {
            return;
        }

        bucket[key].push({ original: callback, wrapped });

        (dom as EventTarget & {
            addEventListener: EventTarget["addEventListener"];
        }).addEventListener(
            domEvent,
            wrapped as EventListener,
            resolveEventOptions(domEvent, !!capture)
        );
    }

    function remove(
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture = false
    ): void {
        if (!dom || !("removeEventListener" in dom)) {
            return;
        }
        const method = methodRef();
        const semanticName = String(eventName || "").toLowerCase();
        const resolved = resolveEvent(semanticName, method);
        if (!resolved || !resolved.domEvent) {
            return;
        }
        const domEvent = resolved.domEvent;

        let wrapped: EventListenerOrEventListenerObject = callback;
        const bucket = registry.get(dom);
        const key = domEvent + "|" + (capture ? "1" : "0");
        if (bucket && bucket[key]) {
            const idx = bucket[key].findIndex(
                (entry) => entry.original === callback
            );
            if (idx >= 0) {
                wrapped = bucket[key][idx].wrapped;
                bucket[key].splice(idx, 1);
            }
        }

        (dom as EventTarget & {
            removeEventListener: EventTarget["removeEventListener"];
        }).removeEventListener(
            domEvent,
            wrapped as EventListener,
            resolveEventOptions(domEvent, !!capture)
        );
    }

    return { add, remove };
}

function extendClass<TTarget extends object, TOrigin extends object>(
    target: TTarget,
    origin: TOrigin
): TTarget & TOrigin {
    for (const i in origin) {
        if (Object.prototype.hasOwnProperty.call(target, i)) {
            continue;
        }
        (target as Record<string, unknown>)[i] = (origin as Record<string, unknown>)[i];
    }

    if (
        !("prototype" in (target as object)) ||
        !("prototype" in (origin as object))
    ) {
        return target as TTarget & TOrigin;
    }

    const targetPrototype = (target as { prototype: Record<string, unknown> }).prototype;
    const originPrototype = (origin as { prototype: Record<string, unknown> }).prototype;
    for (const i in originPrototype) {
        if (!Object.prototype.hasOwnProperty.call(originPrototype, i)) {
            continue;
        }
        if (Object.prototype.hasOwnProperty.call(targetPrototype, i)) {
            continue;
        }
        const getter = (originPrototype as any).__lookupGetter__?.(i);
        if (getter) {
            (targetPrototype as any).__defineGetter__(i, getter);
        } else {
            targetPrototype[i] = originPrototype[i];
        }
        const setter = (originPrototype as any).__lookupSetter__?.(i);
        if (setter) {
            (targetPrototype as any).__defineSetter__(i, setter);
        }
    }
    return target as TTarget & TOrigin;
}

function createLiteGraphNamespace(): {
    liteGraph: LiteGraphNamespace;
    registry: LiteGraphRegistry;
    runtime: LiteGraphRuntime;
} {
    const liteGraph = { ...LiteGraphConstants } as LiteGraphNamespace;
    applyGridSquareShapeAlias(liteGraph);
    const pointerCompat = createPointerListenerCompat(
        () => String(liteGraph.pointerevents_method || "mouse")
    );

    liteGraph.getTime = createTimeSource();
    liteGraph.getParameterNames = getParameterNames;
    liteGraph.compareObjects = compareObjects;
    liteGraph.distance = distance;
    liteGraph.colorToString = colorToString;
    liteGraph.isInsideRectangle = isInsideRectangle;
    liteGraph.growBounding = growBounding;
    liteGraph.isInsideBounding = isInsideBounding;
    liteGraph.hex2num = hex2num;
    liteGraph.num2hex = num2hex;
    liteGraph.extendClass = extendClass;
    liteGraph.pointerListenerAdd = pointerCompat.add;
    liteGraph.pointerListenerRemove = pointerCompat.remove;
    liteGraph.closeAllContextMenus = ContextMenu.closeAllContextMenus.bind(ContextMenu);

    liteGraph.LGraph = LGraph;
    liteGraph.LLink = LLink;
    liteGraph.LGraphNode = LGraphNode;
    liteGraph.LGraphGroup = LGraphGroup;
    liteGraph.DragAndScale = DragAndScale;
    liteGraph.LGraphCanvas = LGraphCanvas;
    liteGraph.ContextMenu = ContextMenu;
    liteGraph.CurveEditor = CurveEditor;

    const registry = new LiteGraphRegistry(
        liteGraph as unknown as LiteGraphRegistryHost,
        (LGraphNode as unknown as { prototype: Record<string, unknown> }).prototype
    );
    liteGraph.registerNodeType = registry.registerNodeType.bind(registry);
    liteGraph.unregisterNodeType = registry.unregisterNodeType.bind(registry);
    liteGraph.clearRegisteredTypes = registry.clearRegisteredTypes.bind(registry);
    liteGraph.addNodeMethod = registry.addNodeMethod.bind(registry);
    liteGraph.createNode = registry.createNode.bind(registry);
    liteGraph.getNodeType = registry.getNodeType.bind(registry);
    liteGraph.getNodeTypesInCategory = registry.getNodeTypesInCategory.bind(registry);
    liteGraph.getNodeTypesCategories = registry.getNodeTypesCategories.bind(registry);

    const runtime = new LiteGraphRuntime({
        ...(liteGraph as unknown as Record<string, unknown>),
        registerNodeType: liteGraph.registerNodeType.bind(liteGraph),
        getParameterNames,
    } as any);

    liteGraph.registerNodeAndSlotType = runtime.registerNodeAndSlotType.bind(runtime);
    liteGraph.buildNodeClassFromObject = runtime.buildNodeClassFromObject.bind(runtime);
    liteGraph.wrapFunctionAsNode = runtime.wrapFunctionAsNode.bind(runtime);
    liteGraph.reloadNodes = runtime.reloadNodes.bind(runtime);
    liteGraph.cloneObject = runtime.cloneObject.bind(runtime);
    liteGraph.uuidv4 = runtime.uuidv4.bind(runtime);
    liteGraph.isValidConnection = runtime.isValidConnection.bind(runtime);
    liteGraph.registerSearchboxExtra = runtime.registerSearchboxExtra.bind(runtime);
    liteGraph.fetchFile = runtime.fetchFile.bind(runtime);

    (LGraph as unknown as { liteGraph: Record<string, unknown> }).liteGraph = liteGraph;
    (LGraphNodeStateImpl as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (LGraphNodeExecutionImpl as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (LGraphNodePortsWidgetsImpl as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (LGraphNodeConnectGeometryImpl as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (LGraphNode as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (LGraphCanvasStaticImpl as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (LGraphCanvasLifecycleImpl as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (LGraphCanvasInputImpl as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (LGraphCanvasRenderImpl as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (LGraphCanvas as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (DragAndScale as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (ContextMenu as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
        liteGraph;
    (LGraphGroup as unknown as { liteGraphCanvas: Record<string, unknown> }).liteGraphCanvas =
        {
            node_colors: (LGraphCanvas as unknown as { node_colors: unknown }).node_colors,
        };

    applyLiteGraphApiCompatAliases({
        liteGraph: liteGraph as any,
        canvasStatic: LGraphCanvas as any,
        canvasPrototype: (LGraphCanvas as any).prototype,
    });

    return { liteGraph, registry, runtime };
}

function toGlobalScope(input?: LiteGraphGlobalScopeLike): LiteGraphGlobalScopeLike {
    if (input) {
        return input;
    }
    return globalThis as unknown as LiteGraphGlobalScopeLike;
}

/**
 * Task 31: 聚合导出与装配入口。
 * - 汇总分片类并暴露标准导出名。
 * - 组装 LiteGraph 命名空间（常量 + 注册/运行时 API + 工具函数）。
 * - 挂接 Task 29/30 的兼容桥接能力（可选）。
 */
export function assembleLiteGraph(
    options: LiteGraphAssemblyOptions = {}
): LiteGraphAssembly {
    const { liteGraph, registry, runtime } = createLiteGraphNamespace();
    const globalScope = toGlobalScope(options.globalScope);

    const bundle: LiteGraphAssembly = {
        LiteGraph: liteGraph,
        LGraph,
        LLink,
        LGraphNode,
        LGraphGroup,
        DragAndScale,
        LGraphCanvas,
        ContextMenu,
        CurveEditor,
        registry,
        runtime,
    };

    if (options.attachToGlobal) {
        const runtimeConstructors: LiteGraphRuntimeConstructors = {
            LiteGraph: liteGraph,
            LGraph,
            LLink,
            LGraphNode,
            LGraphGroup,
            DragAndScale,
            LGraphCanvas,
            ContextMenu,
            CurveEditor,
        };
        attachLiteGraphGlobalBridge(
            globalScope,
            runtimeConstructors,
            options.bridgeOptions
        );
    }

    if (options.attachCommonJsExports) {
        const exportsTarget =
            options.exportsTarget ||
            (globalScope as LiteGraphCommonJsGlobalLike).exports ||
            {};
        attachLiteGraphCommonJsExports(
            exportsTarget,
            globalScope as LiteGraphCommonJsGlobalLike
        );
    }

    return bundle;
}

const defaultAssembly = assembleLiteGraph();

export const LiteGraph = defaultAssembly.LiteGraph;
export const registry = defaultAssembly.registry;
export const runtime = defaultAssembly.runtime;
export const liteGraphMigrationBundle = defaultAssembly;
