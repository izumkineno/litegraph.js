import {
    denormalizeSerializedLGraphGroup,
    LGRAPHGROUP_SERIALIZATION_DIFF_ID,
    normalizeSerializedLGraphGroup,
    parseSerializedLGraphGroupInput,
    serializeLGraphGroupShape,
} from "../../src/ts-migration/models/LGraphGroup.serialization.compat";
import { LGraphGroup } from "../../src/ts-migration/models/LGraphGroup";

describe("ts-migration LGraphGroup serialization compat", () => {
    test("font_size 优先于 font 作为字体来源", () => {
        const runtime = normalizeSerializedLGraphGroup({
            title: "A",
            bounding: [0, 0, 140, 80],
            color: "#aaa",
            font_size: "22",
            font: "36",
        });
        expect(runtime.font_size).toBe(22);
    });

    test("仅 d.ts font 字段时可解析为 runtime font_size", () => {
        const runtime = normalizeSerializedLGraphGroup({
            title: "B",
            bounding: [1, 2, 140, 80],
            color: "#bbb",
            font: "19",
        });
        expect(runtime).toMatchObject({
            title: "B",
            color: "#bbb",
            font_size: 19,
        });
    });

    test("缺少字体字段时回退默认值", () => {
        const runtime = normalizeSerializedLGraphGroup(
            {
                title: "C",
                bounding: [1, 2, 140, 80],
                color: "#ccc",
            },
            24
        );
        expect(runtime.font_size).toBe(24);
    });

    test("可反归一化为 d.ts font 字段", () => {
        const dtsShape = denormalizeSerializedLGraphGroup({
            title: "D",
            bounding: [1, 2, 140, 80],
            color: "#ddd",
            font_size: 16,
        });
        expect(dtsShape).toEqual({
            title: "D",
            bounding: [1, 2, 140, 80],
            color: "#ddd",
            font: "16",
        });
    });

    test("shape 序列化支持 runtime 与 d.ts 双输出", () => {
        const shape = {
            title: "E",
            bounding: [1, 2, 140, 80] as [number, number, number, number],
            color: "#eee",
            font_size: 18,
        };
        expect(serializeLGraphGroupShape(shape, "runtime")).toEqual(shape);
        expect(serializeLGraphGroupShape(shape, "dts")).toEqual({
            title: "E",
            bounding: [1, 2, 140, 80],
            color: "#eee",
            font: "18",
        });
    });

    test("LGraphGroup.configure 兼容 runtime/d.ts 输入", () => {
        const group = new LGraphGroup("Compat");
        group.configure({
            title: "Runtime",
            bounding: [10, 20, 140, 80],
            color: "#f00",
            font_size: 28,
        });
        expect(group.serialize()).toMatchObject({
            title: "Runtime",
            color: "#f00",
            font_size: 28,
        });

        group.configure({
            title: "DTS",
            bounding: [11, 22, 140, 80],
            color: "#0f0",
            font: "17",
        });
        expect(group.serialize()).toMatchObject({
            title: "DTS",
            color: "#0f0",
            font_size: 17,
        });
    });

    test("解析入口与差异 ID 常量固定", () => {
        const parsed = parseSerializedLGraphGroupInput({
            title: "Parse",
            bounding: [0, 0, 140, 80],
            color: "#123",
            font: "15",
        });
        expect(parsed.font_size).toBe(15);
        expect(LGRAPHGROUP_SERIALIZATION_DIFF_ID).toBe(
            "serialization.group-font-field"
        );
    });
});
