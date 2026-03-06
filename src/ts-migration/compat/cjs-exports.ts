type UnknownCtor =
    | ((...args: never[]) => unknown)
    | (new (...args: never[]) => unknown);

interface LiteGraphNamespaceLike extends Record<string, unknown> {
    LGraph?: UnknownCtor;
    LLink?: UnknownCtor;
    LGraphNode?: UnknownCtor;
    LGraphGroup?: UnknownCtor;
    DragAndScale?: UnknownCtor;
    LGraphCanvas?: UnknownCtor;
    ContextMenu?: UnknownCtor;
}

export interface LiteGraphCommonJsGlobalLike extends Record<string, unknown> {
    LiteGraph?: LiteGraphNamespaceLike;
    LGraph?: UnknownCtor;
    LLink?: UnknownCtor;
    LGraphNode?: UnknownCtor;
    LGraphGroup?: UnknownCtor;
    DragAndScale?: UnknownCtor;
    LGraphCanvas?: UnknownCtor;
    ContextMenu?: UnknownCtor;
    exports?: LiteGraphCommonJsExportsLike;
}

export interface LiteGraphCommonJsExportsLike extends Record<string, unknown> {
    LiteGraph?: unknown;
    LGraph?: unknown;
    LLink?: unknown;
    LGraphNode?: unknown;
    LGraphGroup?: unknown;
    DragAndScale?: unknown;
    LGraphCanvas?: unknown;
    ContextMenu?: unknown;
}

/**
 * CommonJS 导出兼容桥。
 *
 * Source parity:
 * if (typeof exports != "undefined") {
 *   exports.LiteGraph = this.LiteGraph;
 *   exports.LGraph = this.LGraph;
 *   exports.LLink = this.LLink;
 *   exports.LGraphNode = this.LGraphNode;
 *   exports.LGraphGroup = this.LGraphGroup;
 *   exports.DragAndScale = this.DragAndScale;
 *   exports.LGraphCanvas = this.LGraphCanvas;
 *   exports.ContextMenu = this.ContextMenu;
 * }
 *
 * 兼容增强：当顶层别名不存在时，回退到 `LiteGraph.*`。
 */
export function attachLiteGraphCommonJsExports(
    exportsTarget: LiteGraphCommonJsExportsLike,
    globalScope: LiteGraphCommonJsGlobalLike
): LiteGraphCommonJsExportsLike {
    const liteGraph = globalScope.LiteGraph;

    exportsTarget.LiteGraph = globalScope.LiteGraph;
    exportsTarget.LGraph = globalScope.LGraph || liteGraph?.LGraph;
    exportsTarget.LLink = globalScope.LLink || liteGraph?.LLink;
    exportsTarget.LGraphNode = globalScope.LGraphNode || liteGraph?.LGraphNode;
    exportsTarget.LGraphGroup = globalScope.LGraphGroup || liteGraph?.LGraphGroup;
    exportsTarget.DragAndScale =
        globalScope.DragAndScale || liteGraph?.DragAndScale;
    exportsTarget.LGraphCanvas =
        globalScope.LGraphCanvas || liteGraph?.LGraphCanvas;
    exportsTarget.ContextMenu = globalScope.ContextMenu || liteGraph?.ContextMenu;

    return exportsTarget;
}

/**
 * Convenience helper for direct CommonJS runtime usage.
 */
export function attachLiteGraphCommonJsExportsFromGlobal(
    globalScope: LiteGraphCommonJsGlobalLike = globalThis as LiteGraphCommonJsGlobalLike
): LiteGraphCommonJsExportsLike | null {
    const exportsTarget = globalScope.exports;
    if (!exportsTarget) {
        return null;
    }
    return attachLiteGraphCommonJsExports(exportsTarget, globalScope);
}
