import {
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

    configure(o: LLink | LLinkSerializedInput): void {
        const source = o as LLinkSerializedInput;
        if (Array.isArray(source)) {
            // d.ts tuple order: [id,type,origin_id,origin_slot,target_id,target_slot]
            if (typeof source[1] === "string") {
                this.id = source[0] as number;
                this.type = source[1];
                this.origin_id = source[2] as number;
                this.origin_slot = source[3] as number;
                this.target_id = source[4] as number;
                this.target_slot = source[5] as number;
                return;
            }

            // runtime tuple order: [id,origin_id,origin_slot,target_id,target_slot,type]
            this.id = source[0] as number;
            this.origin_id = source[1] as number;
            this.origin_slot = source[2] as number;
            this.target_id = source[3] as number;
            this.target_slot = source[4] as number;
            this.type = source[5] as string;
            return;
        }

        this.id = source.id as number;
        this.type = source.type as string;
        this.origin_id = source.origin_id as number;
        this.origin_slot = source.origin_slot as number;
        this.target_id = source.target_id as number;
        this.target_slot = source.target_slot as number;
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
