import { type SerializedLGraphGroupCompatInput, type SerializedLGraphGroupOrder, type SerializedLGraphGroupRuntime } from "../compat/compat-schema";
import type { SerializedLGraphGroup } from "../types/serialization";
export declare const LGRAPHGROUP_SERIALIZATION_DIFF_ID: "serialization.group-font-field";
export type { SerializedLGraphGroupCompatInput, SerializedLGraphGroupOrder, SerializedLGraphGroupRuntime, };
export declare function normalizeSerializedLGraphGroup(group: SerializedLGraphGroupCompatInput, defaultFontSize?: number): SerializedLGraphGroupRuntime;
export declare function denormalizeSerializedLGraphGroup(group: SerializedLGraphGroupRuntime): SerializedLGraphGroup;
export declare function parseSerializedLGraphGroupInput(input: SerializedLGraphGroupCompatInput, defaultFontSize?: number): SerializedLGraphGroupRuntime;
export declare function serializeLGraphGroupShape(shape: SerializedLGraphGroupRuntime, order?: SerializedLGraphGroupOrder): SerializedLGraphGroupRuntime | SerializedLGraphGroup;
