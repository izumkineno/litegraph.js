import type { SerializedLLink } from "../types/serialization";

export const LLINK_SERIALIZATION_DIFF_ID = "serialization.link-tuple-order" as const;

export type SerializedLLinkRuntime = [
    number,
    number,
    number,
    number,
    number,
    string
];

export type SerializedLLinkCompatInput = SerializedLLink | SerializedLLinkRuntime;
export type SerializedLLinkOrder = "runtime" | "dts";

export interface LLinkSerializedShape {
    id: number;
    type: string;
    origin_id: number;
    origin_slot: number;
    target_id: number;
    target_slot: number;
}

export type LLinkSerializedInput = SerializedLLinkCompatInput | LLinkSerializedShape;

export function isSerializedLLinkDtsOrder(
    tuple: readonly unknown[]
): tuple is SerializedLLink {
    return typeof tuple[1] === "string";
}

export function normalizeSerializedLLinkTuple(
    tuple: SerializedLLinkCompatInput
): SerializedLLinkRuntime {
    const source = tuple as readonly unknown[];
    if (isSerializedLLinkDtsOrder(source)) {
        return [
            Number(source[0] ?? 0),
            Number(source[2] ?? 0),
            Number(source[3] ?? 0),
            Number(source[4] ?? 0),
            Number(source[5] ?? 0),
            String(source[1] ?? ""),
        ];
    }

    return [
        Number(source[0] ?? 0),
        Number(source[1] ?? 0),
        Number(source[2] ?? 0),
        Number(source[3] ?? 0),
        Number(source[4] ?? 0),
        String(source[5] ?? ""),
    ];
}

export function denormalizeSerializedLLinkTuple(
    tuple: SerializedLLinkRuntime,
    order: SerializedLLinkOrder = "runtime"
): SerializedLLinkRuntime | SerializedLLink {
    if (order === "runtime") {
        return tuple;
    }
    return [
        tuple[0],
        tuple[5],
        tuple[1],
        tuple[2],
        tuple[3],
        tuple[4],
    ];
}

export function parseSerializedLLinkInput(
    input: LLinkSerializedInput
): LLinkSerializedShape {
    if (Array.isArray(input)) {
        const normalized = normalizeSerializedLLinkTuple(input);
        return {
            id: normalized[0],
            origin_id: normalized[1],
            origin_slot: normalized[2],
            target_id: normalized[3],
            target_slot: normalized[4],
            type: normalized[5],
        };
    }

    return {
        id: Number(input.id ?? 0),
        type: String(input.type ?? ""),
        origin_id: Number(input.origin_id ?? 0),
        origin_slot: Number(input.origin_slot ?? 0),
        target_id: Number(input.target_id ?? 0),
        target_slot: Number(input.target_slot ?? 0),
    };
}

export function serializeLLinkShape(
    shape: LLinkSerializedShape,
    order: SerializedLLinkOrder = "runtime"
): SerializedLLinkRuntime | SerializedLLink {
    const runtimeTuple: SerializedLLinkRuntime = [
        Number(shape.id ?? 0),
        Number(shape.origin_id ?? 0),
        Number(shape.origin_slot ?? 0),
        Number(shape.target_id ?? 0),
        Number(shape.target_slot ?? 0),
        String(shape.type ?? ""),
    ];
    return denormalizeSerializedLLinkTuple(runtimeTuple, order);
}
