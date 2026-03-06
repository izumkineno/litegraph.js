import {
    applyLGraphCanvasStaticCompat,
    applyLGraphCanvasStaticCompatAliases,
    applyLGraphCanvasStaticMissingApiGuards,
    hasRequiredLGraphCanvasStaticApis,
    LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID,
    LGRAPHCANVAS_STATIC_RESIZE_DIFF_ID,
    LGRAPHCANVAS_STATIC_SUBGRAPH_MENU_DIFF_ID,
} from "../../src/ts-migration/canvas/LGraphCanvas.static.compat";

describe("ts-migration LGraphCanvas static compat", () => {
    test("resize 与 subgraph 菜单别名可双向对齐", () => {
        const onMenuResizeNode = jest.fn();
        const onMenuNodeToSubgraph = jest.fn();
        const hostA: Record<string, unknown> = {
            onMenuResizeNode,
            onMenuNodeToSubgraph,
        };

        applyLGraphCanvasStaticCompatAliases(hostA);
        expect(hostA.onResizeNode).toBe(onMenuResizeNode);
        expect(hostA.onNodeToSubgraph).toBe(onMenuNodeToSubgraph);

        const onResizeNode = jest.fn();
        const onNodeToSubgraph = jest.fn();
        const hostB: Record<string, unknown> = {
            onResizeNode,
            onNodeToSubgraph,
        };
        applyLGraphCanvasStaticCompatAliases(hostB);
        expect(hostB.onMenuResizeNode).toBe(onResizeNode);
        expect(hostB.onMenuNodeToSubgraph).toBe(onNodeToSubgraph);
    });

    test("缺失静态 API 时自动补 guard", () => {
        const host: Record<string, unknown> = {};
        const result = applyLGraphCanvasStaticMissingApiGuards(host);
        expect(result.diffId).toBe(LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID);
        expect(result.filled).toEqual([
            "getBoundaryNodes",
            "alignNodes",
            "onNodeAlign",
            "onGroupAlign",
            "getPropertyPrintableValue",
        ]);
        expect(typeof host.getBoundaryNodes).toBe("function");
        expect(typeof host.alignNodes).toBe("function");
        expect(typeof host.onNodeAlign).toBe("function");
        expect(typeof host.onGroupAlign).toBe("function");
        expect(typeof host.getPropertyPrintableValue).toBe("function");
        expect((host.getBoundaryNodes as () => unknown)()).toEqual({
            top: null,
            right: null,
            bottom: null,
            left: null,
        });
        expect((host.getPropertyPrintableValue as (v: unknown) => string)(12)).toBe(
            "12"
        );
    });

    test("统一入口 applyLGraphCanvasStaticCompat 可满足完整能力检查", () => {
        const host: Record<string, unknown> = {
            onMenuResizeNode: jest.fn(),
            onMenuNodeToSubgraph: jest.fn(),
        };
        expect(hasRequiredLGraphCanvasStaticApis(host)).toBe(false);
        applyLGraphCanvasStaticCompat(host);
        expect(hasRequiredLGraphCanvasStaticApis(host)).toBe(true);
    });

    test("差异 ID 常量固定", () => {
        expect(LGRAPHCANVAS_STATIC_RESIZE_DIFF_ID).toBe("canvas-static.resize");
        expect(LGRAPHCANVAS_STATIC_SUBGRAPH_MENU_DIFF_ID).toBe(
            "canvas-static.subgraph-menu"
        );
        expect(LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID).toBe(
            "canvas-static.missing-apis"
        );
    });
});
