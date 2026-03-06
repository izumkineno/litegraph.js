import {
    LITEGRAPH_COMPAT_DIFF_IDS,
    type SerializedLGraphGroupCompatInput,
    type SerializedLGraphGroupOrder,
    type SerializedLGraphGroupRuntime,
} from "../compat/compat-schema";
import type { Vector4 } from "../types/core-types";
import type { SerializedLGraphGroup } from "../types/serialization";

export const LGRAPHGROUP_SERIALIZATION_DIFF_ID =
    LITEGRAPH_COMPAT_DIFF_IDS.serializationGroupFontField;
export type {
    SerializedLGraphGroupCompatInput,
    SerializedLGraphGroupOrder,
    SerializedLGraphGroupRuntime,
};

export function normalizeSerializedLGraphGroup(
    group: SerializedLGraphGroupCompatInput,
    defaultFontSize = 24
): SerializedLGraphGroupRuntime {
    const anyGroup = group as {
        title: string;
        bounding: Vector4;
        color: string;
        font?: string | number;
        font_size?: string | number;
    };

    let fontSize = parseNumber(anyGroup.font_size);
    if (fontSize == null) {
        fontSize = parseNumber(anyGroup.font);
    }
    if (fontSize == null) {
        fontSize = defaultFontSize;
    }

    return {
        title: anyGroup.title,
        bounding: anyGroup.bounding,
        color: anyGroup.color,
        font_size: fontSize,
    };
}

export function denormalizeSerializedLGraphGroup(
    group: SerializedLGraphGroupRuntime
): SerializedLGraphGroup {
    return {
        title: group.title,
        bounding: group.bounding,
        color: group.color,
        font: String(group.font_size),
    };
}

export function parseSerializedLGraphGroupInput(
    input: SerializedLGraphGroupCompatInput,
    defaultFontSize = 24
): SerializedLGraphGroupRuntime {
    return normalizeSerializedLGraphGroup(input, defaultFontSize);
}

export function serializeLGraphGroupShape(
    shape: SerializedLGraphGroupRuntime,
    order: SerializedLGraphGroupOrder = "runtime"
): SerializedLGraphGroupRuntime | SerializedLGraphGroup {
    const runtimeShape: SerializedLGraphGroupRuntime = {
        title: shape.title,
        bounding: shape.bounding,
        color: shape.color,
        font_size: shape.font_size,
    };

    if (order === "runtime") {
        return runtimeShape;
    }
    return denormalizeSerializedLGraphGroup(runtimeShape);
}

function parseNumber(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) {
        return v;
    }
    if (typeof v === "string" && v.trim() !== "") {
        const parsed = Number(v);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}
