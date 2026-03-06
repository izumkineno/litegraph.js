import {
    attachLiteGraphCommonJsExports,
    type LiteGraphCommonJsExportsLike,
    type LiteGraphCommonJsGlobalLike,
} from "./cjs-exports";
import {
    attachLiteGraphGlobalBridge,
    type GlobalBridgeOptions,
    type LiteGraphGlobalScopeLike,
    type LiteGraphRuntimeConstructors,
} from "./global-bridge";

type UnknownCtor =
    | ((...args: never[]) => unknown)
    | (new (...args: never[]) => unknown);

export interface LiteGraphAssemblyBridgeBundle {
    LiteGraph: Record<string, unknown>;
    LGraph: UnknownCtor;
    LLink: UnknownCtor;
    LGraphNode: UnknownCtor;
    LGraphGroup: UnknownCtor;
    DragAndScale: UnknownCtor;
    LGraphCanvas: UnknownCtor;
    ContextMenu: UnknownCtor;
    CurveEditor: UnknownCtor;
}

export interface LiteGraphAssemblyBridgeOptions {
    globalScope?: LiteGraphGlobalScopeLike;
    attachToGlobal?: boolean;
    attachCommonJsExports?: boolean;
    exportsTarget?: LiteGraphCommonJsExportsLike;
    bridgeOptions?: GlobalBridgeOptions;
}

export function resolveLiteGraphGlobalScope(
    input?: LiteGraphGlobalScopeLike
): LiteGraphGlobalScopeLike {
    if (input) {
        return input;
    }
    return globalThis as unknown as LiteGraphGlobalScopeLike;
}

export function attachLiteGraphAssemblyBridges(
    bundle: LiteGraphAssemblyBridgeBundle,
    options: LiteGraphAssemblyBridgeOptions = {}
): LiteGraphGlobalScopeLike {
    const globalScope = resolveLiteGraphGlobalScope(options.globalScope);

    if (options.attachToGlobal) {
        const runtimeConstructors: LiteGraphRuntimeConstructors = {
            LiteGraph: bundle.LiteGraph,
            LGraph: bundle.LGraph,
            LLink: bundle.LLink,
            LGraphNode: bundle.LGraphNode,
            LGraphGroup: bundle.LGraphGroup,
            DragAndScale: bundle.DragAndScale,
            LGraphCanvas: bundle.LGraphCanvas,
            ContextMenu: bundle.ContextMenu,
            CurveEditor: bundle.CurveEditor,
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

    return globalScope;
}
