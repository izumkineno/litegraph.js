import { LGraphCanvasMenuPanel as LGraphCanvasImpl } from "../canvas/LGraphCanvas.menu-panel";
import { DragAndScale as DragAndScaleImpl } from "../canvas/DragAndScale";
import { LGraphCanvas as LGraphCanvasStaticImpl } from "../canvas/LGraphCanvas.static";
import { LGraphCanvasLifecycle as LGraphCanvasLifecycleImpl } from "../canvas/LGraphCanvas.lifecycle";
import { LGraphCanvasInput as LGraphCanvasInputImpl } from "../canvas/LGraphCanvas.input";
import { LGraphCanvasRender as LGraphCanvasRenderImpl } from "../canvas/LGraphCanvas.render";
import {
    createDynamicPointerListenerCompat,
    type PointerListener,
} from "../compat/pointer-events";
import { createTimeSource } from "../compat/time-source";
import {
    applyGridSquareShapeAlias,
} from "../core/litegraph.constants.compat";
import { LiteGraphConstants, type LiteGraphConstantsShape } from "../core/litegraph.constants";
import {
    LiteGraphRegistry,
    type LiteGraphRegistryHost,
} from "../core/litegraph.registry";
import { LiteGraphRuntime } from "../core/litegraph.runtime";
import { LGraphPersistence as LGraphImpl } from "../models/LGraph.persistence";
import { LGraphGroup as LGraphGroupImpl } from "../models/LGraphGroup";
import { LGraphNode as LGraphNodeStateImpl } from "../models/LGraphNode.state";
import { LGraphNodeExecution as LGraphNodeExecutionImpl } from "../models/LGraphNode.execution";
import { LGraphNodePortsWidgets as LGraphNodePortsWidgetsImpl } from "../models/LGraphNode.ports-widgets";
import { LGraphNodeConnectGeometry as LGraphNodeConnectGeometryImpl } from "../models/LGraphNode.connect-geometry";
import { LGraphNodeCanvasCollab as LGraphNodeImpl } from "../models/LGraphNode.canvas-collab";
import { LLink } from "../models/LLink";
import { ContextMenu as ContextMenuImpl } from "../ui/ContextMenu";
import { CurveEditor } from "../ui/CurveEditor";
import { colorToString, hex2num, num2hex } from "../utils/color";
import { getParameterNames } from "../utils/function-signature";
import {
    compareObjects,
    distance,
    growBounding,
    isInsideBounding,
    isInsideRectangle,
} from "../utils/math-geometry";

export const LGraph = LGraphImpl;
export const LGraphNode = LGraphNodeImpl;
export const LGraphGroup = LGraphGroupImpl;
export const DragAndScale = DragAndScaleImpl;
export const LGraphCanvas = LGraphCanvasImpl;
export const ContextMenu = ContextMenuImpl;
export { LLink, CurveEditor };

type LiteGraphNamespaceLike = LiteGraphConstantsShape &
    Record<string, unknown> & {
        pointerListenerAdd: (
            dom: EventTarget | null | undefined,
            eventName: string,
            callback: PointerListener,
            capture?: boolean
        ) => void;
        pointerListenerRemove: (
            dom: EventTarget | null | undefined,
            eventName: string,
            callback: PointerListener,
            capture?: boolean
        ) => void;
    };

export interface LiteGraphNamespaceRuntime {
    liteGraph: LiteGraphNamespaceLike;
    registry: LiteGraphRegistry;
    runtime: LiteGraphRuntime;
}

type LiteGraphHostCarrier = {
    liteGraph: Record<string, unknown>;
};

type LiteGraphCanvasPaletteCarrier = {
    liteGraphCanvas: Record<string, unknown>;
};

export function extendClass<TTarget extends object, TOrigin extends object>(
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
        !("prototype" in target) ||
        !("prototype" in origin)
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
        const getter = (originPrototype as Record<string, unknown> & {
            __lookupGetter__?: (key: string) => (() => unknown) | undefined;
        }).__lookupGetter__?.(i);
        if (getter) {
            (targetPrototype as Record<string, unknown> & {
                __defineGetter__?: (key: string, getter: () => unknown) => void;
            }).__defineGetter__?.(i, getter);
        } else {
            targetPrototype[i] = originPrototype[i];
        }
        const setter = (originPrototype as Record<string, unknown> & {
            __lookupSetter__?: (key: string) => ((value: unknown) => void) | undefined;
        }).__lookupSetter__?.(i);
        if (setter) {
            (targetPrototype as Record<string, unknown> & {
                __defineSetter__?: (key: string, setter: (value: unknown) => void) => void;
            }).__defineSetter__?.(i, setter);
        }
    }
    return target as TTarget & TOrigin;
}

function bindRuntimeIntoClasses(liteGraph: LiteGraphNamespaceLike): void {
    (LGraph as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (LGraphNodeStateImpl as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (LGraphNodeExecutionImpl as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (LGraphNodePortsWidgetsImpl as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (LGraphNodeConnectGeometryImpl as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (LGraphNode as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (LGraphCanvasStaticImpl as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (LGraphCanvasLifecycleImpl as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (LGraphCanvasInputImpl as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (LGraphCanvasRenderImpl as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (LGraphCanvas as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (DragAndScale as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (ContextMenu as unknown as LiteGraphHostCarrier).liteGraph = liteGraph;
    (LGraphGroup as unknown as LiteGraphCanvasPaletteCarrier).liteGraphCanvas = {
        node_colors: (LGraphCanvas as unknown as { node_colors: unknown }).node_colors,
    };
}

export function createLiteGraphNamespace(): LiteGraphNamespaceRuntime {
    const liteGraph = { ...LiteGraphConstants } as LiteGraphNamespaceLike;
    applyGridSquareShapeAlias(liteGraph);

    const pointerCompat = createDynamicPointerListenerCompat(
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
        registerNodeType: registry.registerNodeType.bind(registry),
        getParameterNames,
    } as never);

    liteGraph.registerNodeAndSlotType = runtime.registerNodeAndSlotType.bind(runtime);
    liteGraph.buildNodeClassFromObject = runtime.buildNodeClassFromObject.bind(runtime);
    liteGraph.wrapFunctionAsNode = runtime.wrapFunctionAsNode.bind(runtime);
    liteGraph.reloadNodes = runtime.reloadNodes.bind(runtime);
    liteGraph.cloneObject = runtime.cloneObject.bind(runtime);
    liteGraph.uuidv4 = runtime.uuidv4.bind(runtime);
    liteGraph.isValidConnection = runtime.isValidConnection.bind(runtime);
    liteGraph.registerSearchboxExtra = runtime.registerSearchboxExtra.bind(runtime);
    liteGraph.fetchFile = runtime.fetchFile.bind(runtime);

    bindRuntimeIntoClasses(liteGraph);

    return { liteGraph, registry, runtime };
}
