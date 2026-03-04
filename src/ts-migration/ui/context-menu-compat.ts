export const CONTEXT_MENU_CLOSE_ALL_DIFF_ID = "ui.close-all-context-menus" as const;

export type ContextMenuCloseAll = (refWindow?: Window) => void;
export type ContextMenuCloseAllSource =
    | "LiteGraph"
    | "ContextMenu"
    | "fallback"
    | "none";

export interface ContextMenuCloseCompatHost {
    closeAllContextMenus?: ContextMenuCloseAll;
}

export interface LiteGraphContextMenuCompatHost {
    closeAllContextMenus?: ContextMenuCloseAll;
    ContextMenu?: ContextMenuCloseCompatHost;
    [key: string]: unknown;
}

export interface ContextMenuCloseAllCompatResult {
    diffId: typeof CONTEXT_MENU_CLOSE_ALL_DIFF_ID;
    source: ContextMenuCloseAllSource;
    resolved?: ContextMenuCloseAll;
    changed: boolean;
    synced: boolean;
}

/**
 * Task 41 compatibility layer:
 * align `LiteGraph.closeAllContextMenus` and `ContextMenu.closeAllContextMenus`
 * to the same callable reference.
 */
export function applyContextMenuCloseAllCompat(
    liteGraph: LiteGraphContextMenuCompatHost,
    fallback?: ContextMenuCloseAll
): ContextMenuCloseAllCompatResult {
    const beforeLiteGraph = liteGraph.closeAllContextMenus;
    const beforeContextMenu = liteGraph.ContextMenu?.closeAllContextMenus;

    const resolved = resolveContextMenuCloseAll(liteGraph, fallback);
    if (!resolved.fn) {
        return {
            diffId: CONTEXT_MENU_CLOSE_ALL_DIFF_ID,
            source: "none",
            changed: false,
            synced: false,
        };
    }

    liteGraph.closeAllContextMenus = resolved.fn;
    if (!liteGraph.ContextMenu) {
        liteGraph.ContextMenu = {};
    }
    liteGraph.ContextMenu.closeAllContextMenus = resolved.fn;

    const synced = isContextMenuCloseAllCompatSynced(liteGraph);
    return {
        diffId: CONTEXT_MENU_CLOSE_ALL_DIFF_ID,
        source: resolved.source,
        resolved: resolved.fn,
        changed:
            beforeLiteGraph !== liteGraph.closeAllContextMenus ||
            beforeContextMenu !== liteGraph.ContextMenu.closeAllContextMenus,
        synced,
    };
}

export function isContextMenuCloseAllCompatSynced(
    liteGraph: LiteGraphContextMenuCompatHost
): boolean {
    return !!(
        liteGraph.closeAllContextMenus &&
        liteGraph.ContextMenu?.closeAllContextMenus &&
        liteGraph.closeAllContextMenus === liteGraph.ContextMenu.closeAllContextMenus
    );
}

function resolveContextMenuCloseAll(
    liteGraph: LiteGraphContextMenuCompatHost,
    fallback?: ContextMenuCloseAll
): { source: ContextMenuCloseAllSource; fn?: ContextMenuCloseAll } {
    if (liteGraph.closeAllContextMenus) {
        return { source: "LiteGraph", fn: liteGraph.closeAllContextMenus };
    }
    if (liteGraph.ContextMenu?.closeAllContextMenus) {
        return { source: "ContextMenu", fn: liteGraph.ContextMenu.closeAllContextMenus };
    }
    if (fallback) {
        return { source: "fallback", fn: fallback };
    }
    return { source: "none" };
}
