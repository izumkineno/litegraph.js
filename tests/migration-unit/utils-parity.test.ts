import { clamp } from "../../src/ts-migration/utils/clamp";
import { colorToString, hex2num, num2hex } from "../../src/ts-migration/utils/color";
import {
    compareObjects,
    distance,
    isInsideBounding,
    isInsideRectangle,
    overlapBounding,
} from "../../src/ts-migration/utils/math-geometry";

describe("ts-migration utils parity", () => {
    test("clamp 与旧逻辑一致", () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-3, 0, 10)).toBe(0);
        expect(clamp(13, 0, 10)).toBe(10);
    });

    test("颜色转换工具行为一致", () => {
        expect(colorToString([1, 0.5, 0, 0.25])).toBe("rgba(255,128,0,0.25)");
        expect(hex2num("#FFA07A")).toEqual([255, 160, 122]);
        expect(num2hex([255, 160, 122])).toBe("#FFA07A");
    });

    test("几何工具行为一致", () => {
        expect(distance([0, 0], [3, 4])).toBe(5);
        expect(isInsideRectangle(5, 5, 0, 0, 10, 10)).toBe(true);
        expect(isInsideRectangle(0, 0, 0, 0, 10, 10)).toBe(false);
        expect(overlapBounding([0, 0, 5, 5], [4, 4, 5, 5])).toBe(true);
        expect(overlapBounding([0, 0, 2, 2], [5, 5, 2, 2])).toBe(false);
    });

    test("isInsideBounding 同时支持 corner 与 flat 格式", () => {
        const p: [number, number] = [5, 5];
        expect(isInsideBounding(p, [[0, 0], [10, 10]])).toBe(true);
        expect(isInsideBounding(p, [0, 0, 10, 10])).toBe(true);
        expect(isInsideBounding([20, 20], [0, 0, 10, 10])).toBe(false);
    });

    test("compareObjects 保持单向键比较语义", () => {
        expect(compareObjects({ a: 1 }, { a: 1, b: 2 })).toBe(true);
        expect(compareObjects({ a: 1 }, { a: 2 })).toBe(false);
    });
});
