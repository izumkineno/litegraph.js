import type { GraphLinkPersistenceInput } from "./graph-persistence.types";
import { type LLinkSerializedInput, type SerializedLLinkRuntime } from "./LLink.serialization.compat";
/**
 * this is the class in charge of storing link information
 */
export declare class LLink {
    id: number;
    type: string;
    origin_id: number;
    origin_slot: number;
    target_id: number;
    target_slot: number;
    _data: unknown;
    _pos: Float32Array;
    constructor(id: number, type: string, origin_id: number, origin_slot: number, target_id: number, target_slot: number);
    configure(o: LLink | LLinkSerializedInput | GraphLinkPersistenceInput): void;
    serialize(): SerializedLLinkRuntime;
}
