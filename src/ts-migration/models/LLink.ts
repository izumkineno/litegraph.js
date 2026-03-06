import type { GraphLinkPersistenceInput } from "./graph-persistence.types";
import {
    parseSerializedLLinkInput,
    type LLinkSerializedInput,
    type SerializedLLinkRuntime,
} from "./LLink.serialization.compat";

/**
 * this is the class in charge of storing link information
 */
export class LLink {
    id: number;
    type: string;
    origin_id: number;
    origin_slot: number;
    target_id: number;
    target_slot: number;

    _data: unknown;
    _pos: Float32Array;

    constructor(
        id: number,
        type: string,
        origin_id: number,
        origin_slot: number,
        target_id: number,
        target_slot: number
    ) {
        this.id = id;
        this.type = type;
        this.origin_id = origin_id;
        this.origin_slot = origin_slot;
        this.target_id = target_id;
        this.target_slot = target_slot;

        this._data = null;
        this._pos = new Float32Array(2); // center
    }

    configure(
        o: LLink | LLinkSerializedInput | GraphLinkPersistenceInput
    ): void {
        const parsed = parseSerializedLLinkInput(o as LLinkSerializedInput);
        this.id = parsed.id;
        this.type = parsed.type;
        this.origin_id = parsed.origin_id;
        this.origin_slot = parsed.origin_slot;
        this.target_id = parsed.target_id;
        this.target_slot = parsed.target_slot;
    }

    serialize(): SerializedLLinkRuntime {
        return [
            this.id,
            this.origin_id,
            this.origin_slot,
            this.target_id,
            this.target_slot,
            this.type,
        ];
    }
}
