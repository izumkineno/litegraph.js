import { LGraphCanvas } from "../canvas/LGraphCanvas.static";
import type { ContextMenuCtor, ResolvedMenuPanelCanvasClassPort } from "./menu-panel-types";

type MenuClassTarget = typeof LGraphCanvas & Record<string, any>;

let cachedMenuPanelCanvasClass: ResolvedMenuPanelCanvasClassPort | null = null;

class DefaultContextMenu {
    constructor(_values: unknown, _options?: unknown, _window?: Window) {}
}

function resolveTarget(): MenuClassTarget {
    return LGraphCanvas as MenuClassTarget;
}

function bindStaticMethod(methodName: keyof ResolvedMenuPanelCanvasClassPort) {
    return (...args: any[]): unknown => {
        const target = resolveTarget();
        const method = target[methodName];
        if (typeof method !== "function") {
            return undefined;
        }
        return method.apply(target, args);
    };
}

export function resolveMenuPanelCanvasClass(): ResolvedMenuPanelCanvasClassPort {
    if (cachedMenuPanelCanvasClass) {
        return cachedMenuPanelCanvasClass;
    }

    const resolved = {} as ResolvedMenuPanelCanvasClassPort;

    Object.defineProperties(resolved, {
        active_canvas: {
            enumerable: true,
            get: () => resolveTarget().active_canvas as unknown,
            set: (value: unknown) => {
                resolveTarget().active_canvas = value as any;
            },
        },
        active_node: {
            enumerable: true,
            get: () => resolveTarget().active_node as unknown,
            set: (value: unknown) => {
                resolveTarget().active_node = value as any;
            },
        },
        search_limit: {
            enumerable: true,
            get: () => {
                const value = resolveTarget().search_limit;
                return typeof value === "number" ? value : -1;
            },
        },
        ContextMenu: {
            enumerable: true,
            get: () =>
                (resolveTarget().ContextMenu as ContextMenuCtor | undefined) ||
                DefaultContextMenu,
        },
        node_colors: {
            enumerable: true,
            get: () => resolveTarget().node_colors || {},
        },
        getPropertyPrintableValue: {
            enumerable: true,
            value: (value: unknown, values?: unknown): string => {
                const target = resolveTarget();
                if (typeof target.getPropertyPrintableValue === "function") {
                    return target.getPropertyPrintableValue(value, values as any);
                }
                return String(value);
            },
        },
        onGroupAdd: { enumerable: true, value: bindStaticMethod("onGroupAdd") },
        onGroupAlign: { enumerable: true, value: bindStaticMethod("onGroupAlign") },
        onMenuAdd: { enumerable: true, value: bindStaticMethod("onMenuAdd") },
        showMenuNodeOptionalInputs: {
            enumerable: true,
            value: bindStaticMethod("showMenuNodeOptionalInputs"),
        },
        showMenuNodeOptionalOutputs: {
            enumerable: true,
            value: bindStaticMethod("showMenuNodeOptionalOutputs"),
        },
        onShowMenuNodeProperties: {
            enumerable: true,
            value: bindStaticMethod("onShowMenuNodeProperties"),
        },
        onShowPropertyEditor: {
            enumerable: true,
            value: bindStaticMethod("onShowPropertyEditor"),
        },
        onMenuNodeMode: {
            enumerable: true,
            value: bindStaticMethod("onMenuNodeMode"),
        },
        onMenuResizeNode: {
            enumerable: true,
            value: bindStaticMethod("onMenuResizeNode"),
        },
        onMenuNodeCollapse: {
            enumerable: true,
            value: bindStaticMethod("onMenuNodeCollapse"),
        },
        onMenuNodePin: {
            enumerable: true,
            value: bindStaticMethod("onMenuNodePin"),
        },
        onMenuNodeColors: {
            enumerable: true,
            value: bindStaticMethod("onMenuNodeColors"),
        },
        onMenuNodeShapes: {
            enumerable: true,
            value: bindStaticMethod("onMenuNodeShapes"),
        },
        onMenuNodeClone: {
            enumerable: true,
            value: bindStaticMethod("onMenuNodeClone"),
        },
        onMenuNodeToSubgraph: {
            enumerable: true,
            value: bindStaticMethod("onMenuNodeToSubgraph"),
        },
        onNodeAlign: {
            enumerable: true,
            value: bindStaticMethod("onNodeAlign"),
        },
        onMenuNodeRemove: {
            enumerable: true,
            value: bindStaticMethod("onMenuNodeRemove"),
        },
    });

    cachedMenuPanelCanvasClass = resolved;
    return resolved;
}
