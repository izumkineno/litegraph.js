import { type SerializedLLinkCompatInput, type SerializedLLinkDtsInput, type SerializedLLinkOrder, type SerializedLLinkRuntime, type SerializedLLinkRuntimeInput } from "../compat/compat-schema";
import type { SerializedLLink } from "../types/serialization";
export declare const LLINK_SERIALIZATION_DIFF_ID: "serialization.link-tuple-order";
export type { SerializedLLinkCompatInput, SerializedLLinkDtsInput, SerializedLLinkOrder, SerializedLLinkRuntime, SerializedLLinkRuntimeInput, };
export interface LLinkSerializedShape {
    id: number;
    type: string;
    origin_id: number;
    origin_slot: number;
    target_id: number;
    target_slot: number;
}
export type LLinkSerializedInput = SerializedLLinkCompatInput | LLinkSerializedShape;
export declare function isSerializedLLinkDtsOrder(tuple: readonly unknown[]): tuple is SerializedLLink | SerializedLLinkDtsInput;
export declare function normalizeSerializedLLinkTuple(tuple: SerializedLLinkCompatInput): SerializedLLinkRuntime;
export declare function denormalizeSerializedLLinkTuple(tuple: SerializedLLinkRuntime | SerializedLLinkRuntimeInput, order?: SerializedLLinkOrder): SerializedLLinkRuntime | SerializedLLink;
export declare function parseSerializedLLinkInput(input: LLinkSerializedInput): LLinkSerializedShape;
export declare function serializeLLinkShape(shape: LLinkSerializedShape, order?: SerializedLLinkOrder): SerializedLLinkRuntime | SerializedLLink;
