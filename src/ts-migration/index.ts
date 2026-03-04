import { LGraphCanvasMenuPanel as LGraphCanvasImpl } from "./canvas/LGraphCanvas.menu-panel";
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
import { LGraphNodeCanvasCollab as LGraphNodeImpl } from "./models/LGraphNode.canvas-collab";
import { LLink } from "./models/LLink";
import { applyLiteGraphApiCompatAliases } from "./types/litegraph-compat";
import { ContextMenu as ContextMenuImpl } from "./ui/ContextMenu";
import { CurveEditor } from "./ui/CurveEditor";
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
        domEvent: string;
        wrapped: EventListenerOrEventListenerObject;
        capture: boolean;
    };
    const registry = new WeakMap<EventTarget, Map<EventListenerOrEventListenerObject, Entry[]>>();

    function resolveEvent(eventName: string, method: string): string | null {
        const requested = String(eventName || "").toLowerCase();
        if (
            requested.indexOf("mouse") === 0 ||
            requested.indexOf("pointer") === 0 ||
            requested.indexOf("touch") === 0
        ) {
            return requested;
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

        if (method === "pointer") {
            return mapPointer[requested] || requested;
        }
        if (method === "touch") {
            const resolved = mapTouch[requested];
            return resolved === undefined ? requested : resolved;
        }
        return mapMouse[requested] || requested;
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
        const domEvent = resolveEvent(semanticName, method);
        if (!domEvent) {
            return;
        }

        let wrapped = callback;
        if (domEvent.indexOf("touch") === 0) {
            wrapped = function(this: unknown, ev: Event): void {
                const normalized = normalizeTouchEvent(
                    ev as TouchEvent,
                    semanticName,
                    method
                );
                if (!normalized) {
                    return;
                }
                invokeCallback(callback, this, normalized);
            } as EventListener;
        }

        let targetRegistry = registry.get(dom);
        if (!targetRegistry) {
            targetRegistry = new Map();
            registry.set(dom, targetRegistry);
        }
        const entries = targetRegistry.get(callback) || [];
        entries.push({
            domEvent,
            wrapped,
            capture: !!capture,
        });
        targetRegistry.set(callback, entries);

        (dom as EventTarget & {
            addEventListener: EventTarget["addEventListener"];
        }).addEventListener(domEvent, wrapped as EventListener, !!capture);
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
        const domEvent = resolveEvent(semanticName, method);
        if (!domEvent) {
            return;
        }

        let wrapped: EventListenerOrEventListenerObject = callback;
        const targetRegistry = registry.get(dom);
        if (targetRegistry) {
            const entries = targetRegistry.get(callback) || [];
            const idx = entries.findIndex(
                (entry) => entry.domEvent === domEvent && entry.capture === !!capture
            );
            if (idx >= 0) {
                wrapped = entries[idx].wrapped;
                entries.splice(idx, 1);
            }
            if (!entries.length) {
                targetRegistry.delete(callback);
            } else {
                targetRegistry.set(callback, entries);
            }
        }

        (dom as EventTarget & {
            removeEventListener: EventTarget["removeEventListener"];
        }).removeEventListener(domEvent, wrapped as EventListener, !!capture);
    }

    return { add, remove };
}

function extendClass<TTarget extends object, TOrigin extends object>(
    target: TTarget,
    origin: TOrigin
): TTarget & TOrigin {
    for (const i in origin) {
        if ((target as Record<string, unknown>)[i] != null) {
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
        if (targetPrototype[i] != null) {
            continue;
        }
        targetPrototype[i] = originPrototype[i];
        const getter = (originPrototype as any).__lookupGetter__?.(i);
        if (getter) {
            (targetPrototype as any).__defineGetter__(i, getter);
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
    (LGraphNode as unknown as { liteGraph: Record<string, unknown> }).liteGraph =
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
