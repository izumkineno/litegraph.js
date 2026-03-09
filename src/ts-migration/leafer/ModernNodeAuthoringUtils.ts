import type { NodeViewPortKind } from "./NodeViewHost";
import type {
    ModernNodePortSchema,
    ModernPortPresentation,
    ModernShellState,
} from "./ModernNodeContracts";

interface LiteGraphAuthoringHostLike {
    EVENT?: number;
    ACTION?: number;
    BOX_SHAPE?: number;
    ARROW_SHAPE?: number;
    GRID_SHAPE?: number;
    LINK_COLOR?: string;
    EVENT_LINK_COLOR?: string;
    NODE_DEFAULT_COLOR?: string;
    NODE_DEFAULT_BGCOLOR?: string;
    NODE_DEFAULT_BOXCOLOR?: string;
    NODE_TITLE_HEIGHT?: number;
    NODE_MODES_COLORS?: unknown;
}

interface NodeSlotLike {
    name?: unknown;
    label?: unknown;
    type?: unknown;
    color_on?: unknown;
    color_off?: unknown;
    color?: unknown;
    shape?: unknown;
    dir?: unknown;
}

interface NodeLike {
    constructor?: Record<string, unknown>;
    title?: unknown;
    type?: unknown;
    color?: unknown;
    bgcolor?: unknown;
    boxcolor?: unknown;
    outlinecolor?: unknown;
    title_text_color?: unknown;
    mode?: unknown;
    action_triggered?: unknown;
    execute_triggered?: unknown;
    resizable?: unknown;
    flags?: Record<string, unknown> | null;
    size?: [number, number] | ArrayLike<number> | null;
    widgets?: unknown;
    inputs?: NodeSlotLike[] | null;
    outputs?: NodeSlotLike[] | null;
    getTitle?: () => unknown;
    getSummaryText?: () => unknown;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toStringValue(value: unknown, fallback = ""): string {
    return value == null ? fallback : String(value);
}

export function resolveLiteGraphAuthoringHost(
    value?: unknown
): LiteGraphAuthoringHostLike {
    if (value && typeof value === "object") {
        return value as LiteGraphAuthoringHostLike;
    }

    const globalLike = globalThis as typeof globalThis & {
        LiteGraph?: LiteGraphAuthoringHostLike;
    };
    return globalLike.LiteGraph || {};
}

export function resolveLiteGraphAuthoringHostForNode(
    node: unknown
): LiteGraphAuthoringHostLike {
    if (!node || typeof node !== "object") {
        return resolveLiteGraphAuthoringHost();
    }

    const ctor = (node as { constructor?: { liteGraph?: unknown } }).constructor;
    if (ctor?.liteGraph && typeof ctor.liteGraph === "object") {
        return resolveLiteGraphAuthoringHost(ctor.liteGraph);
    }

    return resolveLiteGraphAuthoringHost();
}

export function buildSlotSchemaFromNode(node: unknown): ModernNodePortSchema {
    const runtimeNode = (node || {}) as NodeLike;
    const inputs = Array.isArray(runtimeNode.inputs)
        ? runtimeNode.inputs.map((slot) => ({
              name: toStringValue(slot?.name),
              type:
                  slot && Object.prototype.hasOwnProperty.call(slot, "type")
                      ? (slot.type as string | number | undefined)
                      : undefined,
          }))
        : [];

    const outputs = Array.isArray(runtimeNode.outputs)
        ? runtimeNode.outputs.map((slot) => ({
              name: toStringValue(slot?.name),
              type:
                  slot && Object.prototype.hasOwnProperty.call(slot, "type")
                      ? (slot.type as string | number | undefined)
                      : undefined,
          }))
        : [];

    return { inputs, outputs };
}

export function truncateText(value: unknown, maxLength = 24): string {
    const text = String(value == null ? "" : value)
        .replace(/\s+/g, " ")
        .trim();
    if (!text) {
        return "";
    }

    const safeMaxLength = Math.max(toFiniteNumber(maxLength, 24), 4);
    if (text.length <= safeMaxLength) {
        return text;
    }

    return `${text.slice(0, safeMaxLength - 3)}...`;
}

export function formatNodeValue(value: unknown, maxLength = 22): string {
    if (value == null) {
        return "null";
    }
    if (value.constructor === Number) {
        return Number.isInteger(value)
            ? String(value)
            : Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    }
    if (value.constructor === Boolean) {
        return value ? "true" : "false";
    }
    if (value.constructor === String) {
        return truncateText(value, maxLength);
    }
    if (Array.isArray(value)) {
        return `Array(${value.length})`;
    }
    if (typeof value === "function") {
        return "fn()";
    }
    if (typeof value === "object") {
        const keys = Object.keys(value as Record<string, unknown>);
        return keys.length ? `{${truncateText(keys.join(", "), 18)}}` : "{}";
    }
    return truncateText(String(value), maxLength);
}

export function describePortType(
    type: unknown,
    hostInput?: unknown
): string {
    const host = resolveLiteGraphAuthoringHost(hostInput);
    if (
        type === host.EVENT ||
        type === host.ACTION ||
        type === "event" ||
        type === "action"
    ) {
        return "EVENT";
    }

    if (type == null || type === "" || type === -1 || type === 0) {
        return "ANY";
    }

    const label = String(type)
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!label) {
        return "ANY";
    }

    switch (label) {
        case "number":
            return "NUMBER";
        case "boolean":
            return "BOOLEAN";
        case "string":
            return "STRING";
        case "object":
            return "OBJECT";
        case "array":
            return "ARRAY";
        case "json":
            return "JSON";
        default:
            return label.toUpperCase();
    }
}

export function getNodeTitle(node: unknown): string {
    const runtimeNode = (node || {}) as NodeLike;
    if (typeof runtimeNode.getTitle === "function") {
        return toStringValue(
            runtimeNode.getTitle() || runtimeNode.title || runtimeNode.type || "Node"
        );
    }
    return toStringValue(runtimeNode.title || runtimeNode.type || "Node");
}

export function getNodeSummary(node: unknown): string {
    const runtimeNode = (node || {}) as NodeLike;
    if (typeof runtimeNode.getSummaryText === "function") {
        return toStringValue(runtimeNode.getSummaryText());
    }

    if (Array.isArray(runtimeNode.widgets) && runtimeNode.widgets.length) {
        return "";
    }

    const inputCount = Array.isArray(runtimeNode.inputs)
        ? runtimeNode.inputs.length
        : 0;
    const outputCount = Array.isArray(runtimeNode.outputs)
        ? runtimeNode.outputs.length
        : 0;
    if (!inputCount && !outputCount) {
        return "";
    }

    return `${inputCount} in / ${outputCount} out`;
}

function resolveModeBoxColor(
    node: NodeLike,
    host: LiteGraphAuthoringHostLike
): string | null {
    if (node.action_triggered) {
        return "#FFFFFF";
    }
    if (node.execute_triggered) {
        return "#AAAAAA";
    }
    const modeColors = Array.isArray(host.NODE_MODES_COLORS)
        ? (host.NODE_MODES_COLORS as string[])
        : null;
    const mode = toFiniteNumber(node.mode, -1);
    if (modeColors && mode >= 0 && modeColors[mode]) {
        return modeColors[mode];
    }
    return null;
}

export function resolveShellState(
    node: unknown,
    hostInput?: unknown
): ModernShellState {
    const runtimeNode = (node || {}) as NodeLike;
    const constructorRef = runtimeNode.constructor || {};
    const host = resolveLiteGraphAuthoringHost(hostInput);

    return {
        title: getNodeTitle(runtimeNode),
        titleMode: "default",
        titleColor: toStringValue(
            runtimeNode.color ||
                constructorRef.title_color ||
                constructorRef.color ||
                host.NODE_DEFAULT_COLOR ||
                "#333333",
            "#333333"
        ),
        titleTextColor: toStringValue(
            runtimeNode.title_text_color ||
                constructorRef.title_text_color ||
                "#F5F7FA",
            "#F5F7FA"
        ),
        boxColor: toStringValue(
            runtimeNode.boxcolor ||
                resolveModeBoxColor(runtimeNode, host) ||
                host.NODE_DEFAULT_BOXCOLOR ||
                "#666666",
            "#666666"
        ),
        bodyColor: toStringValue(
            runtimeNode.bgcolor ||
                constructorRef.bgcolor ||
                host.NODE_DEFAULT_BGCOLOR ||
                "#353535",
            "#353535"
        ),
        borderColor: toStringValue(
            runtimeNode.outlinecolor || constructorRef.outlinecolor || "#1F2D3D",
            "#1F2D3D"
        ),
        showSignalLamp: true,
        collapsible: constructorRef.collapsable !== false,
        resizable: runtimeNode.resizable !== false,
        showCollapsedSlots: true,
        allowNodeHover: false,
        summaryText: getNodeSummary(runtimeNode),
    };
}

function measureTitleWidth(text: string): number {
    if (typeof document !== "undefined" && document.createElement) {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (context) {
            context.font = "14px Arial";
            return context.measureText(text).width;
        }
    }
    return text.length * 7.2;
}

export function resolveCollapsedWidth(
    node: unknown,
    hostInput?: unknown
): number {
    const runtimeNode = (node || {}) as NodeLike;
    const host = resolveLiteGraphAuthoringHost(hostInput);
    const titleHeight = toFiniteNumber(host.NODE_TITLE_HEIGHT, 30);
    const nodeWidth = Math.max(
        toFiniteNumber(runtimeNode.size?.[0], 140),
        80
    );
    return Math.min(
        nodeWidth,
        measureTitleWidth(getNodeTitle(runtimeNode)) + titleHeight * 2
    );
}

function resolvePortShape(
    slot: NodeSlotLike | undefined,
    host: LiteGraphAuthoringHostLike
): "circle" | "box" | "arrow" | "grid" {
    if (!slot) {
        return "circle";
    }
    if (
        slot.shape === host.BOX_SHAPE ||
        slot.type === host.EVENT ||
        slot.type === host.ACTION
    ) {
        return "box";
    }
    if (slot.shape === host.ARROW_SHAPE) {
        return "arrow";
    }
    if (slot.shape === host.GRID_SHAPE) {
        return "grid";
    }
    return "circle";
}

function resolvePortColor(
    slot: NodeSlotLike | undefined,
    host: LiteGraphAuthoringHostLike
): { colorOn: string; colorOff: string } {
    if (!slot) {
        return {
            colorOn: toStringValue(host.LINK_COLOR, "#9A9"),
            colorOff: "#6E7681",
        };
    }

    let activeColor =
        slot.type === host.EVENT || slot.type === host.ACTION
            ? toStringValue(host.EVENT_LINK_COLOR, "#A86")
            : toStringValue(host.LINK_COLOR, "#9A9");

    if (typeof slot.color_on === "string") {
        activeColor = slot.color_on;
    } else if (typeof slot.color === "string") {
        activeColor = slot.color;
    }

    return {
        colorOn: activeColor,
        colorOff:
            typeof slot.color_off === "string" ? slot.color_off : "#6E7681",
    };
}

export function resolvePortPresentation(
    node: unknown,
    kind: NodeViewPortKind,
    slotIndex: number,
    hostInput?: unknown
): ModernPortPresentation | null {
    const runtimeNode = (node || {}) as NodeLike;
    const host = resolveLiteGraphAuthoringHost(hostInput);
    const slotList = kind === "input" ? runtimeNode.inputs : runtimeNode.outputs;
    const slot = Array.isArray(slotList) ? slotList[slotIndex] : undefined;
    if (!slot) {
        return null;
    }

    const colors = resolvePortColor(slot, host);
    return {
        label: toStringValue(slot.label || slot.name),
        shape: resolvePortShape(slot, host),
        dir: typeof slot.dir === "number" ? slot.dir : undefined,
        colorOn: colors.colorOn,
        colorOff: colors.colorOff,
        hideLabelWhenCollapsed: true,
        radius: 10,
    };
}

export const ModernNodeAuthoringUtils = {
    buildSlotSchemaFromNode,
    truncateText,
    formatNodeValue,
    describePortType,
    getNodeSummary,
    resolveShellState,
    resolveCollapsedWidth,
    resolvePortPresentation,
    resolveLiteGraphAuthoringHost,
    resolveLiteGraphAuthoringHostForNode,
} as const;
