import {
    hasGraphOnNodeAddedCompatHook,
    invokeGraphOnNodeAddedCompatHook,
    LGRAPH_ON_NODE_ADDED_DIFF_ID,
} from "../../src/ts-migration/models/LGraph.hooks";

describe("ts-migration LGraph hooks compat", () => {
    test("存在函数钩子时可识别并触发", () => {
        const onNodeAdded = jest.fn();
        const graph = { onNodeAdded };
        expect(hasGraphOnNodeAddedCompatHook(graph)).toBe(true);
        expect(invokeGraphOnNodeAddedCompatHook(graph, { id: 1 })).toBe(true);
        expect(onNodeAdded).toHaveBeenCalledTimes(1);
        expect(onNodeAdded).toHaveBeenCalledWith({ id: 1 });
    });

    test("钩子为空或缺失时安全跳过", () => {
        expect(hasGraphOnNodeAddedCompatHook({ onNodeAdded: null })).toBe(false);
        expect(invokeGraphOnNodeAddedCompatHook({ onNodeAdded: null }, { id: 1 })).toBe(
            false
        );
        expect(invokeGraphOnNodeAddedCompatHook({}, { id: 2 })).toBe(false);
    });

    test("不吞掉用户钩子抛错", () => {
        const graph = {
            onNodeAdded: (): void => {
                throw new Error("boom");
            },
        };
        expect(() => invokeGraphOnNodeAddedCompatHook(graph, { id: 3 })).toThrow("boom");
    });

    test("差异 ID 常量固定", () => {
        expect(LGRAPH_ON_NODE_ADDED_DIFF_ID).toBe("graph-hooks.on-node-added");
    });
});
