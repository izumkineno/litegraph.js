import { attachLiteGraphCommonJsExports, attachLiteGraphCommonJsExportsFromGlobal } from "../../src/ts-migration/compat/cjs-exports";
import { attachLiteGraphGlobalBridge, installRequestAnimationFrameShim } from "../../src/ts-migration/compat/global-bridge";

describe("ts-migration compat bridge parity", () => {
    test("global bridge 挂载核心构造器与 clamp", () => {
        function LGraph() {}
        function LLink() {}
        function LGraphNode() {}
        function LGraphGroup() {}
        function DragAndScale() {}
        function LGraphCanvas() {}
        function ContextMenu() {}
        function CurveEditor() {}

        const globalScope: Record<string, unknown> = {};
        const runtime = {
            LiteGraph: {},
            LGraph,
            LLink,
            LGraphNode,
            LGraphGroup,
            DragAndScale,
            LGraphCanvas,
            ContextMenu,
            CurveEditor,
        };

        attachLiteGraphGlobalBridge(globalScope, runtime);

        expect(globalScope.LiteGraph).toBe(runtime.LiteGraph);
        expect(globalScope.LGraph).toBe(LGraph);
        expect(globalScope.LGraphNode).toBe(LGraphNode);
        expect(globalScope.LGraphGroup).toBe(LGraphGroup);
        expect(globalScope.LGraphCanvas).toBe(LGraphCanvas);
        expect(typeof globalScope.clamp).toBe("function");

        const liteGraph = runtime.LiteGraph as Record<string, unknown>;
        expect(liteGraph.LGraph).toBe(LGraph);
        expect(liteGraph.LLink).toBe(LLink);
        expect(liteGraph.DragAndScale).toBe(DragAndScale);
        expect(liteGraph.ContextMenu).toBe(ContextMenu);
        expect(liteGraph.CurveEditor).toBe(CurveEditor);
    });

    test("requestAnimationFrame shim 在缺省时回退 setTimeout", () => {
        const globalScope: Record<string, unknown> = {
            setTimeout: jest.fn(() => 123),
        };
        const previousWindow = (globalThis as Record<string, unknown>).window;
        (globalThis as Record<string, unknown>).window = {};

        try {
            installRequestAnimationFrameShim(globalScope);
            expect(typeof globalScope.requestAnimationFrame).toBe("function");
            const raf = globalScope.requestAnimationFrame as (
                cb: (time: number) => void
            ) => number;
            const id = raf(() => {});
            expect(id).toBe(123);
            expect(globalScope.setTimeout).toHaveBeenCalled();
        } finally {
            (globalThis as Record<string, unknown>).window = previousWindow;
        }
    });

    test("CommonJS 导出桥优先用顶层，缺失时回退 LiteGraph.*", () => {
        function LGraph() {}
        function LGraphNode() {}
        function LGraphCanvas() {}
        function ContextMenu() {}

        const exportsTarget: Record<string, unknown> = {};
        const globalScope = {
            LiteGraph: {
                LGraph,
                LGraphNode,
                LGraphCanvas,
                ContextMenu,
            },
            LGraphNode,
        };

        attachLiteGraphCommonJsExports(exportsTarget, globalScope);

        expect(exportsTarget.LiteGraph).toBe(globalScope.LiteGraph);
        expect(exportsTarget.LGraph).toBe(LGraph);
        expect(exportsTarget.LGraphNode).toBe(LGraphNode);
        expect(exportsTarget.LGraphCanvas).toBe(LGraphCanvas);
        expect(exportsTarget.ContextMenu).toBe(ContextMenu);
    });

    test("CommonJS 快捷入口无 exports 时返回 null", () => {
        expect(attachLiteGraphCommonJsExportsFromGlobal({})).toBeNull();
    });
});
