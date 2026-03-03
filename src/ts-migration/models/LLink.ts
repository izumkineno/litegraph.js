import type { SerializedLLink } from "../types/serialization";

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

    configure(o: LLink | SerializedLLinkCompatible): void {
        if (Array.isArray(o)) {
            this.id = Number(o[0] ?? 0);

            // d.ts tuple: [id, type, origin_id, origin_slot, target_id, target_slot]
            if (typeof o[1] === "string") {
                this.type = o[1];
                this.origin_id = Number(o[2] ?? 0);
                this.origin_slot = Number(o[3] ?? 0);
                this.target_id = Number(o[4] ?? 0);
                this.target_slot = Number(o[5] ?? 0);
                return;
            }

            // runtime tuple: [id, origin_id, origin_slot, target_id, target_slot, type]
            this.origin_id = Number(o[1] ?? 0);
            this.origin_slot = Number(o[2] ?? 0);
            this.target_id = Number(o[3] ?? 0);
            this.target_slot = Number(o[4] ?? 0);
            this.type = String(o[5] ?? "");
            return;
        }

        this.id = o.id;
        this.type = o.type;
        this.origin_id = o.origin_id;
        this.origin_slot = o.origin_slot;
        this.target_id = o.target_id;
        this.target_slot = o.target_slot;
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

export type SerializedLLinkRuntime = [
    number,
    number,
    number,
    number,
    number,
    string
];

export type SerializedLLinkCompatible = SerializedLLink | SerializedLLinkRuntime;

