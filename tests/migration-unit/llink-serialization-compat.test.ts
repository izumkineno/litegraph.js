import { LLink } from "../../src/ts-migration/models/LLink";
import {
    denormalizeSerializedLLinkTuple,
    isSerializedLLinkDtsOrder,
    LLINK_SERIALIZATION_DIFF_ID,
    normalizeSerializedLLinkTuple,
    parseSerializedLLinkInput,
    serializeLLinkShape,
} from "../../src/ts-migration/models/LLink.serialization.compat";

describe("ts-migration LLink serialization compat", () => {
    test("识别 d.ts 顺序元组", () => {
        expect(
            isSerializedLLinkDtsOrder([10, "number", 11, 2, 22, 3])
        ).toBe(true);
        expect(isSerializedLLinkDtsOrder([10, 11, 2, 22, 3, "number"])).toBe(
            false
        );
    });

    test("d.ts 顺序可归一化为 runtime 顺序", () => {
        const normalized = normalizeSerializedLLinkTuple([
            10,
            "number",
            11,
            2,
            22,
            3,
        ]);
        expect(normalized).toEqual([10, 11, 2, 22, 3, "number"]);
    });

    test("runtime 顺序可反归一化为 d.ts 顺序", () => {
        const denormalized = denormalizeSerializedLLinkTuple(
            [10, 11, 2, 22, 3, "event"],
            "dts"
        );
        expect(denormalized).toEqual([10, "event", 11, 2, 22, 3]);
    });

    test("对象输入可解析为标准字段形态", () => {
        const parsed = parseSerializedLLinkInput({
            id: 9,
            type: "float",
            origin_id: 1,
            origin_slot: 2,
            target_id: 3,
            target_slot: 4,
        });
        expect(parsed).toEqual({
            id: 9,
            type: "float",
            origin_id: 1,
            origin_slot: 2,
            target_id: 3,
            target_slot: 4,
        });
    });

    test("shape 序列化支持 runtime/d.ts 双输出", () => {
        const shape = {
            id: 7,
            type: "number",
            origin_id: 8,
            origin_slot: 0,
            target_id: 9,
            target_slot: 1,
        };

        expect(serializeLLinkShape(shape, "runtime")).toEqual([
            7,
            8,
            0,
            9,
            1,
            "number",
        ]);
        expect(serializeLLinkShape(shape, "dts")).toEqual([
            7,
            "number",
            8,
            0,
            9,
            1,
        ]);
    });

    test("LLink.configure 兼容 d.ts 与 runtime 输入", () => {
        const byDts = new LLink(0, "", 0, 0, 0, 0);
        byDts.configure([11, "event", 21, 1, 31, 2]);

        const byRuntime = new LLink(0, "", 0, 0, 0, 0);
        byRuntime.configure([11, 21, 1, 31, 2, "event"]);

        expect(byDts.serialize()).toEqual([11, 21, 1, 31, 2, "event"]);
        expect(byRuntime.serialize()).toEqual([11, 21, 1, 31, 2, "event"]);
    });

    test("兼容差异 ID 固定为 serialization.link-tuple-order", () => {
        expect(LLINK_SERIALIZATION_DIFF_ID).toBe(
            "serialization.link-tuple-order"
        );
    });
});
