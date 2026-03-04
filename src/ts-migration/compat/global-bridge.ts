import { clamp } from "../utils/clamp";

type UnknownCtor = new (...args: unknown[]) => unknown;

interface LiteGraphNamespaceLike extends Record<string, unknown> {
    LGraph?: UnknownCtor;
    LLink?: UnknownCtor;
    LGraphNode?: UnknownCtor;
    LGraphGroup?: UnknownCtor;
    DragAndScale?: UnknownCtor;
    LGraphCanvas?: UnknownCtor;
    ContextMenu?: UnknownCtor;
    CurveEditor?: UnknownCtor;
}

export interface LiteGraphRuntimeConstructors {
    LiteGraph: LiteGraphNamespaceLike;
    LGraph?: UnknownCtor;
    LLink?: UnknownCtor;
    LGraphNode?: UnknownCtor;
    LGraphGroup?: UnknownCtor;
    DragAndScale?: UnknownCtor;
    LGraphCanvas?: UnknownCtor;
    ContextMenu?: UnknownCtor;
    CurveEditor?: UnknownCtor;
}

export interface LiteGraphGlobalScopeLike extends Record<string, unknown> {
    LiteGraph?: LiteGraphNamespaceLike;
    LGraph?: UnknownCtor;
    LLink?: UnknownCtor;
    LGraphNode?: UnknownCtor;
    LGraphGroup?: UnknownCtor;
    DragAndScale?: UnknownCtor;
    LGraphCanvas?: UnknownCtor;
    ContextMenu?: UnknownCtor;
    CurveEditor?: UnknownCtor;
    clamp?: typeof clamp;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    webkitRequestAnimationFrame?: (callback: FrameRequestCallback) => number;
    mozRequestAnimationFrame?: (callback: FrameRequestCallback) => number;
    setTimeout?: (handler: TimerHandler, timeout?: number, ...args: unknown[]) => number;
}

export interface GlobalBridgeOptions {
    exposeClamp?: boolean;
    installRequestAnimationFrameShim?: boolean;
}

const defaultBridgeOptions: Required<GlobalBridgeOptions> = {
    exposeClamp: true,
    installRequestAnimationFrameShim: true,
};

/**
 * IIFE 全局挂载兼容桥。
 *
 * Source parity:
 * - `global.LiteGraph = { ... }`
 * - `global.LGraph = LiteGraph.LGraph = LGraph`
 * - `LiteGraph.LLink = LLink`
 * - `global.LGraphNode = LiteGraph.LGraphNode = LGraphNode`
 * - `global.LGraphGroup = LiteGraph.LGraphGroup = LGraphGroup`
 * - `LiteGraph.DragAndScale = DragAndScale`
 * - `global.LGraphCanvas = LiteGraph.LGraphCanvas = LGraphCanvas`
 * - `LiteGraph.ContextMenu = ContextMenu`
 * - `LiteGraph.CurveEditor = CurveEditor`
 * - `global.clamp = clamp`
 */
export function attachLiteGraphGlobalBridge(
    globalScope: LiteGraphGlobalScopeLike,
    runtime: LiteGraphRuntimeConstructors,
    options?: GlobalBridgeOptions
): LiteGraphGlobalScopeLike {
    const resolved = { ...defaultBridgeOptions, ...(options || {}) };
    const liteGraph = runtime.LiteGraph;

    globalScope.LiteGraph = liteGraph;

    if (runtime.LGraph) {
        globalScope.LGraph = runtime.LGraph;
        liteGraph.LGraph = runtime.LGraph;
    }

    if (runtime.LLink) {
        liteGraph.LLink = runtime.LLink;
    }

    if (runtime.LGraphNode) {
        globalScope.LGraphNode = runtime.LGraphNode;
        liteGraph.LGraphNode = runtime.LGraphNode;
    }

    if (runtime.LGraphGroup) {
        globalScope.LGraphGroup = runtime.LGraphGroup;
        liteGraph.LGraphGroup = runtime.LGraphGroup;
    }

    if (runtime.DragAndScale) {
        liteGraph.DragAndScale = runtime.DragAndScale;
    }

    if (runtime.LGraphCanvas) {
        globalScope.LGraphCanvas = runtime.LGraphCanvas;
        liteGraph.LGraphCanvas = runtime.LGraphCanvas;
    }

    if (runtime.ContextMenu) {
        liteGraph.ContextMenu = runtime.ContextMenu;
    }

    if (runtime.CurveEditor) {
        liteGraph.CurveEditor = runtime.CurveEditor;
    }

    if (resolved.exposeClamp) {
        globalScope.clamp = clamp;
    }

    if (resolved.installRequestAnimationFrameShim) {
        installRequestAnimationFrameShim(globalScope);
    }

    return globalScope;
}

/**
 * Mirrors source fallback:
 * `window.requestAnimationFrame = webkitRequestAnimationFrame || mozRequestAnimationFrame || setTimeout`.
 */
export function installRequestAnimationFrameShim(
    globalScope: LiteGraphGlobalScopeLike
): void {
    if (typeof window == "undefined") {
        return;
    }
    if (globalScope.requestAnimationFrame) {
        return;
    }

    globalScope.requestAnimationFrame =
        globalScope.webkitRequestAnimationFrame ||
        globalScope.mozRequestAnimationFrame ||
        function(callback: FrameRequestCallback): number {
            if (!globalScope.setTimeout) {
                return 0;
            }
            return globalScope.setTimeout(callback, 1000 / 60);
        };
}

/**
 * Convenience helper for browser/global execution contexts.
 */
export function attachLiteGraphGlobalBridgeToGlobalThis(
    runtime: LiteGraphRuntimeConstructors,
    options?: GlobalBridgeOptions
): LiteGraphGlobalScopeLike {
    return attachLiteGraphGlobalBridge(
        globalThis as LiteGraphGlobalScopeLike,
        runtime,
        options
    );
}
