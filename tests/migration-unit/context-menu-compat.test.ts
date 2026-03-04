import {
    applyContextMenuCloseAllCompat,
    CONTEXT_MENU_CLOSE_ALL_DIFF_ID,
    isContextMenuCloseAllCompatSynced,
} from "../../src/ts-migration/ui/context-menu-compat";

describe("ts-migration context menu close-all compat", () => {
    test("优先使用 LiteGraph.closeAllContextMenus 作为对齐来源", () => {
        const liteGraphClose = jest.fn();
        const contextClose = jest.fn();
        const host = {
            closeAllContextMenus: liteGraphClose,
            ContextMenu: {
                closeAllContextMenus: contextClose,
            },
        };

        const result = applyContextMenuCloseAllCompat(host);
        expect(result.diffId).toBe(CONTEXT_MENU_CLOSE_ALL_DIFF_ID);
        expect(result.source).toBe("LiteGraph");
        expect(result.synced).toBe(true);
        expect(host.closeAllContextMenus).toBe(liteGraphClose);
        expect(host.ContextMenu.closeAllContextMenus).toBe(liteGraphClose);
    });

    test("LiteGraph 缺失时回退 ContextMenu.closeAllContextMenus", () => {
        const contextClose = jest.fn();
        const host = {
            ContextMenu: {
                closeAllContextMenus: contextClose,
            },
        };

        const result = applyContextMenuCloseAllCompat(host);
        expect(result.source).toBe("ContextMenu");
        expect(result.synced).toBe(true);
        expect(host.closeAllContextMenus).toBe(contextClose);
        expect(host.ContextMenu.closeAllContextMenus).toBe(contextClose);
    });

    test("两端都缺失时可使用 fallback，并补齐双入口", () => {
        const fallback = jest.fn();
        const host: {
            closeAllContextMenus?: (refWindow?: Window) => void;
            ContextMenu?: { closeAllContextMenus?: (refWindow?: Window) => void };
        } = {};

        const result = applyContextMenuCloseAllCompat(host, fallback);
        expect(result.source).toBe("fallback");
        expect(result.synced).toBe(true);
        expect(host.closeAllContextMenus).toBe(fallback);
        expect(host.ContextMenu?.closeAllContextMenus).toBe(fallback);
    });

    test("缺少所有来源且无 fallback 时保持未对齐", () => {
        const host: {
            closeAllContextMenus?: (refWindow?: Window) => void;
            ContextMenu?: { closeAllContextMenus?: (refWindow?: Window) => void };
        } = {};
        const result = applyContextMenuCloseAllCompat(host);
        expect(result.source).toBe("none");
        expect(result.synced).toBe(false);
        expect(isContextMenuCloseAllCompatSynced(host)).toBe(false);
    });

    test("同步检查仅在双入口同引用时为 true", () => {
        const fnA = jest.fn();
        const fnB = jest.fn();
        expect(
            isContextMenuCloseAllCompatSynced({
                closeAllContextMenus: fnA,
                ContextMenu: { closeAllContextMenus: fnA },
            })
        ).toBe(true);
        expect(
            isContextMenuCloseAllCompatSynced({
                closeAllContextMenus: fnA,
                ContextMenu: { closeAllContextMenus: fnB },
            })
        ).toBe(false);
    });
});
