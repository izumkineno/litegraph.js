import {
    applyContextMenuCloseAllCompat,
    applyLGraphCanvasPrototypeCompatShims,
    applyLGraphCanvasStaticCompatAliases,
    applyLiteGraphApiCompatAliases,
    applyLiteGraphConstantAliases,
    denormalizeSerializedLGraphGroup,
    denormalizeSerializedLLinkTuple,
    type LGraphCanvasPrototypeCompatHost,
    type LGraphCanvasStaticCompatHost,
    type LiteGraphApiCompatTargets,
    type LiteGraphConstantAliasHost,
    type LiteGraphContextMenuCompatHost,
    invokeGraphOnNodeAddedCompatHook,
    normalizeSerializedLGraphGroup,
    normalizeSerializedLLinkTuple,
} from "../../src/ts-migration/types/litegraph-compat";

describe("ts-migration litegraph compat parity", () => {
    test("normalize SerializedLLink d.ts 顺序到 runtime 顺序", () => {
        const tuple = [10, "number", 11, 2, 22, 3] as const;
        expect(normalizeSerializedLLinkTuple(tuple)).toEqual([
            10,
            11,
            2,
            22,
            3,
            "number",
        ]);
    });

    test("normalize SerializedLLink runtime 顺序保持一致", () => {
        const tuple = [10, 11, 2, 22, 3, "event"] as const;
        expect(normalizeSerializedLLinkTuple(tuple)).toEqual([
            10,
            11,
            2,
            22,
            3,
            "event",
        ]);
    });

    test("denormalize SerializedLLink 可导出 d.ts 顺序", () => {
        const runtimeTuple = [10, 11, 2, 22, 3, "number"] as const;
        expect(denormalizeSerializedLLinkTuple(runtimeTuple, "dts")).toEqual([
            10,
            "number",
            11,
            2,
            22,
            3,
        ]);
    });

    test("group 字段兼容：font_size 优先，其次 font，最后默认值", () => {
        const a = normalizeSerializedLGraphGroup({
            title: "A",
            bounding: [0, 0, 10, 10],
            color: "#fff",
            font_size: "18",
            font: "40",
        });
        const b = normalizeSerializedLGraphGroup({
            title: "B",
            bounding: [0, 0, 10, 10],
            color: "#000",
            font: "20",
        });
        const c = normalizeSerializedLGraphGroup({
            title: "C",
            bounding: [0, 0, 10, 10],
            color: "#333",
        });

        expect(a.font_size).toBe(18);
        expect(b.font_size).toBe(20);
        expect(c.font_size).toBe(24);
    });

    test("group 反归一化输出 font 字段", () => {
        const normalized = {
            title: "G",
            bounding: [0, 0, 10, 10] as [number, number, number, number],
            color: "#456",
            font_size: 16,
        };
        expect(denormalizeSerializedLGraphGroup(normalized)).toEqual({
            title: "G",
            bounding: [0, 0, 10, 10],
            color: "#456",
            font: "16",
        });
    });

    test("常量别名双向对齐", () => {
        const hostA: Record<string, unknown> = { GRID_SHAPE: 8 };
        const hostB: Record<string, unknown> = { SQUARE_SHAPE: 7 };
        const hostC: Record<string, unknown> = {};

        expect(applyLiteGraphConstantAliases(hostA)).toBe(8);
        expect(hostA).toMatchObject({ GRID_SHAPE: 8, SQUARE_SHAPE: 8 });

        expect(applyLiteGraphConstantAliases(hostB)).toBe(7);
        expect(hostB).toMatchObject({ GRID_SHAPE: 7, SQUARE_SHAPE: 7 });

        expect(applyLiteGraphConstantAliases(hostC, 6)).toBe(6);
        expect(hostC).toMatchObject({ GRID_SHAPE: 6, SQUARE_SHAPE: 6 });
    });

    test("LGraphCanvas 静态别名与子图菜单别名", () => {
        const resize = jest.fn();
        const nodeToSubgraph = jest.fn();
        const host: LGraphCanvasStaticCompatHost = {
            onMenuResizeNode: resize,
            onMenuNodeToSubgraph: nodeToSubgraph,
        };

        applyLGraphCanvasStaticCompatAliases(host);

        expect(host.onResizeNode).toBe(resize);
        expect(host.onNodeToSubgraph).toBe(nodeToSubgraph);
    });

    test("LGraphCanvas 原型 shim：补齐方法并转发 deselect", () => {
        const deselectNode = jest.fn();
        const host: LGraphCanvasPrototypeCompatHost = { deselectNode };

        applyLGraphCanvasPrototypeCompatShims(host);

        expect(typeof host.drawSlotGraphic).toBe("function");
        expect(typeof host.touchHandler).toBe("function");
        expect(typeof host.processNodeDeselected).toBe("function");

        (host.processNodeDeselected as (node: unknown) => void)("n1");
        expect(deselectNode).toHaveBeenCalledWith("n1");
    });

    test("ContextMenu 关闭入口双向对齐", () => {
        const closeAll = jest.fn();
        const liteGraph: LiteGraphContextMenuCompatHost = {
            ContextMenu: {
                closeAllContextMenus: closeAll,
            },
        };

        applyContextMenuCloseAllCompat(liteGraph);

        expect(liteGraph.closeAllContextMenus).toBe(closeAll);
        expect(liteGraph.ContextMenu.closeAllContextMenus).toBe(closeAll);
    });

    test("graph onNodeAdded 仅在函数存在时调用", () => {
        const onNodeAdded = jest.fn();
        invokeGraphOnNodeAddedCompatHook({ onNodeAdded }, { id: 1 });
        invokeGraphOnNodeAddedCompatHook({ onNodeAdded: null }, { id: 2 });
        expect(onNodeAdded).toHaveBeenCalledTimes(1);
        expect(onNodeAdded).toHaveBeenCalledWith({ id: 1 });
    });

    test("统一入口 applyLiteGraphApiCompatAliases", () => {
        const closeAll = jest.fn();
        const canvasDeselect = jest.fn();
        const liteGraph: LiteGraphConstantAliasHost & LiteGraphContextMenuCompatHost = {
            SQUARE_SHAPE: 9,
            ContextMenu: { closeAllContextMenus: closeAll },
        };
        const canvasStatic: LGraphCanvasStaticCompatHost = {
            onMenuResizeNode: jest.fn(),
        };
        const canvasPrototype: LGraphCanvasPrototypeCompatHost = {
            deselectNode: canvasDeselect,
        };
        const targets: LiteGraphApiCompatTargets = {
            liteGraph,
            canvasStatic,
            canvasPrototype,
        };

        applyLiteGraphApiCompatAliases(targets);

        expect(liteGraph.GRID_SHAPE).toBe(9);
        expect(liteGraph.SQUARE_SHAPE).toBe(9);
        expect(liteGraph.closeAllContextMenus).toBe(closeAll);
        expect(canvasStatic.onResizeNode).toBe(canvasStatic.onMenuResizeNode);
        expect(typeof canvasPrototype.drawSlotGraphic).toBe("function");
        expect(typeof canvasPrototype.touchHandler).toBe("function");
    });
});
