import {
    applyGridSquareShapeAlias,
    GRID_SQUARE_SHAPE_DEFAULT,
    GRID_SQUARE_SHAPE_DIFF_ID,
    isGridSquareShapeAliasSynced,
    resolveGridSquareShapeValue,
} from "../../src/ts-migration/core/litegraph.constants.compat";

describe("ts-migration constants compat", () => {
    test("优先使用 GRID_SHAPE 作为别名源", () => {
        const host = { GRID_SHAPE: 8 };
        const resolved = resolveGridSquareShapeValue(host, GRID_SQUARE_SHAPE_DEFAULT);
        expect(resolved).toEqual({ value: 8, source: "GRID_SHAPE" });
    });

    test("缺少 GRID_SHAPE 时回退 SQUARE_SHAPE", () => {
        const host = { SQUARE_SHAPE: 7 };
        const resolved = resolveGridSquareShapeValue(host, GRID_SQUARE_SHAPE_DEFAULT);
        expect(resolved).toEqual({ value: 7, source: "SQUARE_SHAPE" });
    });

    test("双字段都缺失时使用默认值", () => {
        const host = {};
        const result = applyGridSquareShapeAlias(host, GRID_SQUARE_SHAPE_DEFAULT);
        expect(result.diffId).toBe(GRID_SQUARE_SHAPE_DIFF_ID);
        expect(result.value).toBe(6);
        expect(result.source).toBe("fallback");
        expect(host).toMatchObject({ GRID_SHAPE: 6, SQUARE_SHAPE: 6 });
    });

    test("同步检查可识别别名一致性", () => {
        expect(
            isGridSquareShapeAliasSynced({ GRID_SHAPE: 6, SQUARE_SHAPE: 6 })
        ).toBe(true);
        expect(
            isGridSquareShapeAliasSynced({ GRID_SHAPE: 6, SQUARE_SHAPE: 7 })
        ).toBe(false);
    });
});
