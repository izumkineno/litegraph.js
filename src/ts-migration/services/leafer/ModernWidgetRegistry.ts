import {
    getModernWidgetRenderer,
    registerModernWidgets,
    type ModernWidgetActionResult,
    type ModernWidgetRectLike,
    type ModernWidgetRenderContext,
    type ModernWidgetRenderer,
    type ModernWidgetSchema,
    type ModernWidgetViewHandle,
} from "../../modern";

interface BuiltinWidgetHandle extends ModernWidgetViewHandle {
    root: Record<string, unknown>;
    background: Record<string, unknown>;
    labelText?: Record<string, unknown> | null;
    valueText?: Record<string, unknown> | null;
    leftText?: Record<string, unknown> | null;
    rightText?: Record<string, unknown> | null;
}

const LABEL_WIDTH_MIN = 36;
const LABEL_WIDTH_MAX = 74;
const INLINE_PADDING = 10;
const ACTION_ICON_WIDTH = 24;

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function formatWidgetValue(schema: ModernWidgetSchema): string {
    if (schema.type === "toggle") {
        return schema.value ? "ON" : "OFF";
    }
    if (schema.value == null) {
        return "";
    }
    if (typeof schema.value === "number") {
        return Number.isFinite(schema.value) ? String(schema.value) : "";
    }
    if (typeof schema.value === "string") {
        return schema.value;
    }
    return String(schema.value);
}

function resolveLabelWidth(bounds: ModernWidgetRectLike): number {
    return clamp(bounds.width * 0.32, LABEL_WIDTH_MIN, LABEL_WIDTH_MAX);
}

function createRoot(
    context: ModernWidgetRenderContext,
    cursor = "pointer"
): BuiltinWidgetHandle {
    const { Group, Rect } = context.leafer as unknown as Record<string, new (
        data?: Record<string, unknown>
    ) => Record<string, unknown>>;
    const root = new Group({
        x: context.bounds.x,
        y: context.bounds.y,
        width: context.bounds.width,
        height: context.bounds.height,
        button: true,
        cursor,
        state: "",
        states: {
            hover: {
                opacity: 1,
            },
            press: {
                scale: 0.985,
            },
            focus: {
                opacity: 1,
            },
        },
        disabled: Boolean(context.schema.disabled),
        disabledStyle: {
            opacity: 0.42,
        },
    });
    const background = new Rect({
        x: 0,
        y: 0,
        width: context.bounds.width,
        height: context.bounds.height,
        cornerRadius: 8,
        fill: "#162130",
        stroke: "#2E455D",
        strokeWidth: 1,
        hoverStyle: {
            fill: "#1B2A3D",
            stroke: "#4E6D94",
        },
        pressStyle: {
            fill: "#102034",
            stroke: "#76A8FF",
        },
        focusStyle: {
            stroke: "#76A8FF",
        },
        disabledStyle: {
            opacity: 0.45,
        },
        hittable: false,
    });

    (root as { add?: (children: unknown[]) => void }).add?.([background]);

    return {
        root,
        background,
        bounds: { ...context.bounds },
    };
}

function applyRootLayout(
    handle: BuiltinWidgetHandle,
    context: ModernWidgetRenderContext
): void {
    handle.bounds = { ...context.bounds };
    handle.root.x = context.bounds.x;
    handle.root.y = context.bounds.y;
    handle.root.width = context.bounds.width;
    handle.root.height = context.bounds.height;
    handle.root.disabled = Boolean(context.schema.disabled);
    handle.background.width = context.bounds.width;
    handle.background.height = context.bounds.height;
}

function createTextNode(
    context: ModernWidgetRenderContext,
    config: Record<string, unknown>
): Record<string, unknown> {
    const { Text } = context.leafer as unknown as Record<string, new (
        data?: Record<string, unknown>
    ) => Record<string, unknown>>;
    return new Text({
        fontSize: 11,
        fontFamily:
            "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        fill: "#D9E8F7",
        verticalAlign: "middle",
        textWrap: "none",
        textOverflow: "hide",
        hittable: false,
        ...config,
    });
}

function createLabelAndValue(
    context: ModernWidgetRenderContext,
    handle: BuiltinWidgetHandle
): void {
    const labelText = createTextNode(context, {
        x: INLINE_PADDING,
        y: context.bounds.height / 2,
        text: context.schema.label || context.schema.name,
        width: resolveLabelWidth(context.bounds),
    });
    const valueText = createTextNode(context, {
        y: context.bounds.height / 2,
        textAlign: "right",
        text: formatWidgetValue(context.schema),
    });

    handle.labelText = labelText;
    handle.valueText = valueText;
    (handle.root as { add?: (children: unknown[]) => void }).add?.([
        labelText,
        valueText,
    ]);
}

function patchLabelAndValue(
    handle: BuiltinWidgetHandle,
    context: ModernWidgetRenderContext
): void {
    const labelWidth = resolveLabelWidth(context.bounds);
    if (handle.labelText) {
        handle.labelText.text = context.schema.label || context.schema.name;
        handle.labelText.x = INLINE_PADDING;
        handle.labelText.y = context.bounds.height / 2;
        handle.labelText.width = labelWidth;
    }

    if (handle.valueText) {
        handle.valueText.text = formatWidgetValue(context.schema);
        handle.valueText.x = INLINE_PADDING + labelWidth + 8;
        handle.valueText.y = context.bounds.height / 2;
        handle.valueText.width =
            context.bounds.width - (INLINE_PADDING * 2 + labelWidth + 8);
    }
}

const buttonRenderer: ModernWidgetRenderer = {
    createView(context) {
        const handle = createRoot(context);
        handle.background.fill = "#18324A";
        handle.background.stroke = "#335372";
        handle.background.hoverStyle = {
            fill: "#21415E",
            stroke: "#4A7297",
        };
        handle.background.pressStyle = {
            fill: "#11273A",
            stroke: "#76A8FF",
        };
        const text = createTextNode(context, {
            x: INLINE_PADDING,
            y: context.bounds.height / 2,
            width: context.bounds.width - INLINE_PADDING * 2,
            textAlign: "center",
            text: context.schema.label || context.schema.name,
        });
        handle.valueText = text;
        handle.actionZones = {
            activate: {
                x: 0,
                y: 0,
                width: context.bounds.width,
                height: context.bounds.height,
            },
        };
        (handle.root as { add?: (children: unknown[]) => void }).add?.([text]);
        return handle;
    },
    patchView(context, handle) {
        const builtinHandle = handle as BuiltinWidgetHandle;
        applyRootLayout(builtinHandle, context);
        if (builtinHandle.valueText) {
            builtinHandle.valueText.text =
                context.schema.label || context.schema.name;
            builtinHandle.valueText.width = context.bounds.width - INLINE_PADDING * 2;
            builtinHandle.valueText.y = context.bounds.height / 2;
        }
        builtinHandle.actionZones = {
            activate: {
                x: 0,
                y: 0,
                width: context.bounds.width,
                height: context.bounds.height,
            },
        };
    },
    performAction(context): ModernWidgetActionResult {
        return { consumed: context.action === "activate" };
    },
};

const toggleRenderer: ModernWidgetRenderer = {
    createView(context) {
        const handle = createRoot(context);
        createLabelAndValue(context, handle);
        handle.actionZones = {
            toggle: {
                x: 0,
                y: 0,
                width: context.bounds.width,
                height: context.bounds.height,
            },
        };
        return handle;
    },
    patchView(context, handle) {
        const builtinHandle = handle as BuiltinWidgetHandle;
        applyRootLayout(builtinHandle, context);
        patchLabelAndValue(builtinHandle, context);
        builtinHandle.actionZones = {
            toggle: {
                x: 0,
                y: 0,
                width: context.bounds.width,
                height: context.bounds.height,
            },
        };
    },
    performAction(context): ModernWidgetActionResult {
        return { consumed: true, nextValue: !Boolean(context.schema.value) };
    },
};

function createStepperRenderer(type: "number" | "combo"): ModernWidgetRenderer {
    return {
        createView(context) {
            const handle = createRoot(context);
            createLabelAndValue(context, handle);
            handle.leftText = createTextNode(context, {
                x: 0,
                y: context.bounds.height / 2,
                width: ACTION_ICON_WIDTH,
                textAlign: "center",
                text: "-",
                fill: "#8AA5C1",
            });
            handle.rightText = createTextNode(context, {
                y: context.bounds.height / 2,
                width: ACTION_ICON_WIDTH,
                textAlign: "center",
                text: "+",
                fill: "#8AA5C1",
            });
            (handle.root as { add?: (children: unknown[]) => void }).add?.([
                handle.leftText,
                handle.rightText,
            ]);
            this.patchView(context, handle, 0);
            return handle;
        },
        patchView(context, handle) {
            const builtinHandle = handle as BuiltinWidgetHandle;
            applyRootLayout(builtinHandle, context);
            patchLabelAndValue(builtinHandle, context);

            if (builtinHandle.valueText) {
                builtinHandle.valueText.x =
                    INLINE_PADDING + resolveLabelWidth(context.bounds) + ACTION_ICON_WIDTH;
                builtinHandle.valueText.width =
                    context.bounds.width -
                    (INLINE_PADDING * 2 +
                        resolveLabelWidth(context.bounds) +
                        ACTION_ICON_WIDTH * 2);
            }
            if (builtinHandle.leftText) {
                builtinHandle.leftText.x = INLINE_PADDING + resolveLabelWidth(context.bounds);
                builtinHandle.leftText.y = context.bounds.height / 2;
            }
            if (builtinHandle.rightText) {
                builtinHandle.rightText.x =
                    context.bounds.width - INLINE_PADDING - ACTION_ICON_WIDTH;
                builtinHandle.rightText.y = context.bounds.height / 2;
            }

            builtinHandle.actionZones = {
                decrement: {
                    x: INLINE_PADDING + resolveLabelWidth(context.bounds),
                    y: 0,
                    width: ACTION_ICON_WIDTH,
                    height: context.bounds.height,
                },
                edit: {
                    x: INLINE_PADDING + resolveLabelWidth(context.bounds) + ACTION_ICON_WIDTH,
                    y: 0,
                    width:
                        context.bounds.width -
                        (INLINE_PADDING * 2 +
                            resolveLabelWidth(context.bounds) +
                            ACTION_ICON_WIDTH * 2),
                    height: context.bounds.height,
                },
                increment: {
                    x: context.bounds.width - INLINE_PADDING - ACTION_ICON_WIDTH,
                    y: 0,
                    width: ACTION_ICON_WIDTH,
                    height: context.bounds.height,
                },
            };
        },
        performAction(context): ModernWidgetActionResult {
            if (context.action === "edit") {
                return { consumed: true, openEditor: true };
            }
            if (type === "number") {
                const step = toFiniteNumber(context.schema.options?.step, 1) || 1;
                const min = context.schema.options?.min;
                const max = context.schema.options?.max;
                let nextValue =
                    toFiniteNumber(context.schema.value) +
                    (context.action === "decrement" ? -step : step);
                if (min != null) {
                    nextValue = Math.max(toFiniteNumber(min), nextValue);
                }
                if (max != null) {
                    nextValue = Math.min(toFiniteNumber(max), nextValue);
                }
                return { consumed: true, nextValue };
            }
            if (type === "combo") {
                let values = context.schema.options?.values as
                    | unknown[]
                    | Record<string, unknown>
                    | undefined;
                if (!values) {
                    return { consumed: true, openEditor: true };
                }
                const valuesList = Array.isArray(values)
                    ? values
                    : Object.keys(values);
                if (!valuesList.length) {
                    return { consumed: true };
                }
                const currentIndex = Array.isArray(values)
                    ? valuesList.indexOf(context.schema.value)
                    : valuesList.indexOf(String(context.schema.value));
                const delta = context.action === "decrement" ? -1 : 1;
                const nextIndex = clamp(currentIndex + delta, 0, valuesList.length - 1);
                return {
                    consumed: true,
                    nextValue: Array.isArray(values)
                        ? valuesList[nextIndex]
                        : nextIndex,
                };
            }
            return { consumed: false };
        },
    };
}

const textRenderer: ModernWidgetRenderer = {
    createView(context) {
        const handle = createRoot(context);
        createLabelAndValue(context, handle);
        handle.actionZones = {
            edit: {
                x: 0,
                y: 0,
                width: context.bounds.width,
                height: context.bounds.height,
            },
        };
        return handle;
    },
    patchView(context, handle) {
        const builtinHandle = handle as BuiltinWidgetHandle;
        applyRootLayout(builtinHandle, context);
        patchLabelAndValue(builtinHandle, context);
        builtinHandle.actionZones = {
            edit: {
                x: 0,
                y: 0,
                width: context.bounds.width,
                height: context.bounds.height,
            },
        };
    },
    performAction(): ModernWidgetActionResult {
        return { consumed: true, openEditor: true };
    },
};

const builtinRenderers: Record<string, ModernWidgetRenderer> = {
    button: buttonRenderer,
    toggle: toggleRenderer,
    text: textRenderer,
    number: createStepperRenderer("number"),
    combo: createStepperRenderer("combo"),
};

let builtinsRegistered = false;

export function ensureDefaultModernWidgetRenderers(): void {
    if (builtinsRegistered) {
        return;
    }
    registerModernWidgets(builtinRenderers);
    builtinsRegistered = true;
}

export function resolveModernWidgetRenderer(
    type: string
): ModernWidgetRenderer | undefined {
    ensureDefaultModernWidgetRenderers();
    return getModernWidgetRenderer(type);
}

export function resolveWidgetBounds(
    bodyBounds: ModernWidgetRectLike,
    index: number,
    count: number
): ModernWidgetRectLike {
    const totalCount = Math.max(count, 1);
    const verticalPadding = 4;
    const gap = 4;
    const usableHeight =
        bodyBounds.height - verticalPadding * 2 - gap * (totalCount - 1);
    const rowHeight = Math.max(20, usableHeight / totalCount);
    return {
        x: bodyBounds.x + 6,
        y: bodyBounds.y + verticalPadding + index * (rowHeight + gap),
        width: Math.max(32, bodyBounds.width - 12),
        height: rowHeight,
    };
}

export type { ModernWidgetRenderer };
