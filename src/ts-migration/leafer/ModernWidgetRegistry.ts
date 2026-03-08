import { Flow } from "@leafer-in/flow";

import {
    getModernWidgetRenderer,
    registerModernWidgets,
    type ModernWidgetActionResult,
    type ModernWidgetRectLike,
    type ModernWidgetRenderContext,
    type ModernWidgetRenderer,
    type ModernWidgetSchema,
    type ModernWidgetViewHandle,
} from "./index";

interface BuiltinWidgetHandle extends ModernWidgetViewHandle {
    root: Record<string, unknown>;
    background: Record<string, unknown>;
    outline?: Record<string, unknown> | null;
    content?: Flow | null;
    actionsFlow?: Flow | null;
    labelText?: Record<string, unknown> | null;
    valueText?: Record<string, unknown> | null;
    leftText?: Record<string, unknown> | null;
    rightText?: Record<string, unknown> | null;
}

const LABEL_WIDTH_MIN = 48;
const LABEL_WIDTH_MAX = 92;
const INLINE_PADDING = 10;
const ACTION_ICON_WIDTH = 20;
const WIDGET_VERTICAL_PADDING = 4;
const WIDGET_ROW_GAP = 6;
const WIDGET_ROW_MIN_HEIGHT = 28;
const STEPPER_MIN_VALUE_WIDTH = 40;
const STEPPER_GAP = 6;
const FLOW_GAP = 8;
const ACTION_FLOW_GAP = 4;

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
    return clamp(bounds.width * 0.38, LABEL_WIDTH_MIN, LABEL_WIDTH_MAX);
}

function resolveStepperFrames(bounds: ModernWidgetRectLike): {
    labelX: number;
    labelWidth: number;
    valueX: number;
    valueWidth: number;
    decrementX: number;
    incrementX: number;
    actionWidth: number;
} {
    const actionWidth = 18;
    const clusterGap = 4;
    const availableWidth =
        bounds.width - INLINE_PADDING * 2 - actionWidth * 2 - clusterGap - STEPPER_GAP;
    const labelWidth = clamp(
        Math.min(
            resolveLabelWidth(bounds),
            Math.max(24, availableWidth - STEPPER_MIN_VALUE_WIDTH)
        ),
        24,
        LABEL_WIDTH_MAX
    );
    const valueWidth = Math.max(STEPPER_MIN_VALUE_WIDTH, availableWidth - labelWidth);
    const valueX = INLINE_PADDING + labelWidth + STEPPER_GAP;
    const decrementX =
        bounds.width - INLINE_PADDING - actionWidth * 2 - clusterGap;
    const incrementX = bounds.width - INLINE_PADDING - actionWidth;
    return {
        labelX: INLINE_PADDING,
        labelWidth,
        valueX,
        valueWidth,
        decrementX,
        incrementX,
        actionWidth,
    };
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
                scale: 0.992,
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
        cornerRadius: 10,
        fill: "#141C26",
        stroke: "#314253",
        strokeWidth: 1,
        hoverStyle: {
            fill: "#182230",
            stroke: "#486179",
        },
        pressStyle: {
            fill: "#101821",
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
    const outline = new Rect({
        x: 0,
        y: 0,
        width: Math.max(0, context.bounds.width),
        height: Math.max(0, context.bounds.height),
        cornerRadius: 10,
        fill: "rgba(0,0,0,0)",
        stroke: "#78AEFF",
        strokeWidth: 1.5,
        opacity: 0,
        visible: false,
        hittable: false,
    });
    const content = new Flow({
        x: INLINE_PADDING,
        y: WIDGET_VERTICAL_PADDING,
        width: Math.max(1, context.bounds.width - INLINE_PADDING * 2),
        height: Math.max(1, context.bounds.height - WIDGET_VERTICAL_PADDING * 2),
        flow: "x",
        gap: FLOW_GAP,
        flowAlign: {
            content: "left",
            y: "center",
        },
        hittable: false,
    });

    (root as { add?: (children: unknown[]) => void }).add?.([
        background,
        outline,
        content,
    ]);

    return {
        root,
        background,
        outline,
        content,
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
    if (handle.outline) {
        handle.outline.x = 0;
        handle.outline.y = 0;
        handle.outline.width = Math.max(0, context.bounds.width);
        handle.outline.height = Math.max(0, context.bounds.height);
        handle.outline.cornerRadius = 10;
    }
    if (handle.content) {
        handle.content.x = INLINE_PADDING;
        handle.content.y = WIDGET_VERTICAL_PADDING;
        handle.content.width = Math.max(
            1,
            context.bounds.width - INLINE_PADDING * 2
        );
        handle.content.height = Math.max(
            1,
            context.bounds.height - WIDGET_VERTICAL_PADDING * 2
        );
    }
}

function createTextNode(
    context: ModernWidgetRenderContext,
    config: Record<string, unknown>
): Record<string, unknown> {
    const { Text } = context.leafer as unknown as Record<string, new (
        data?: Record<string, unknown>
    ) => Record<string, unknown>>;
    return new Text({
        fontSize: 10.5,
        fontFamily:
            "'Aptos', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        fill: "#C2D2E2",
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
    const contentHeight = Math.max(
        1,
        context.bounds.height - WIDGET_VERTICAL_PADDING * 2
    );
    const labelText = createTextNode(context, {
        text: context.schema.label || context.schema.name,
        width: resolveLabelWidth(context.bounds),
        height: contentHeight,
        fontSize: 10,
        fill: "#88A0B8",
    });
    const valueText = createTextNode(context, {
        textAlign: "right",
        text: formatWidgetValue(context.schema),
        width: 1,
        autoWidth: 1,
        height: contentHeight,
        fontSize: 12,
        fontFamily:
            "'Cascadia Code', 'Consolas', 'Fira Code', 'Microsoft YaHei', monospace",
        fill: "#EEF5FF",
    });

    handle.labelText = labelText;
    handle.valueText = valueText;
    (handle.content as { add?: (children: unknown[]) => void } | null)?.add?.([
        labelText,
        valueText,
    ]);
}

function patchLabelAndValue(
    handle: BuiltinWidgetHandle,
    context: ModernWidgetRenderContext
): void {
    const labelWidth = resolveLabelWidth(context.bounds);
    const contentHeight = Math.max(
        1,
        context.bounds.height - WIDGET_VERTICAL_PADDING * 2
    );
    if (handle.labelText) {
        handle.labelText.text = context.schema.label || context.schema.name;
        handle.labelText.width = labelWidth;
        handle.labelText.height = contentHeight;
    }

    if (handle.valueText) {
        handle.valueText.text = formatWidgetValue(context.schema);
        handle.valueText.autoWidth = 1;
        handle.valueText.width = 1;
        handle.valueText.height = contentHeight;
    }
}

const buttonRenderer: ModernWidgetRenderer = {
    createView(context) {
        const handle = createRoot(context);
        handle.background.fill = "#18324A";
        handle.background.stroke = "#416180";
        handle.background.hoverStyle = {
            fill: "#203A55",
            stroke: "#5A80A8",
        };
        handle.background.pressStyle = {
            fill: "#15293C",
            stroke: "#76A8FF",
        };
        const text = createTextNode(context, {
            width: 1,
            autoWidth: 1,
            height: Math.max(1, context.bounds.height - WIDGET_VERTICAL_PADDING * 2),
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
        (handle.content as { add?: (children: unknown[]) => void } | null)?.add?.([
            text,
        ]);
        return handle;
    },
    patchView(context, handle) {
        const builtinHandle = handle as BuiltinWidgetHandle;
        applyRootLayout(builtinHandle, context);
        if (builtinHandle.valueText) {
            builtinHandle.valueText.text =
                context.schema.label || context.schema.name;
            builtinHandle.valueText.autoWidth = 1;
            builtinHandle.valueText.width = 1;
            builtinHandle.valueText.height = Math.max(
                1,
                context.bounds.height - WIDGET_VERTICAL_PADDING * 2
            );
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
        handle.background.fill = context.schema.value ? "#1A3148" : "#141C26";
        handle.background.stroke = context.schema.value ? "#4E78A1" : "#314253";
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
            builtinHandle.background.fill = context.schema.value ? "#1A3148" : "#141C26";
            builtinHandle.background.stroke = context.schema.value
                ? "#4E78A1"
                : "#314253";
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
            handle.actionsFlow = new Flow({
                flow: "x",
                gap: ACTION_FLOW_GAP,
                flowAlign: {
                    content: "left",
                    y: "center",
                },
                hittable: false,
            });
            handle.leftText = createTextNode(context, {
                width: ACTION_ICON_WIDTH,
                height: Math.max(
                    1,
                    context.bounds.height - WIDGET_VERTICAL_PADDING * 2
                ),
                textAlign: "center",
                text: "-",
                fill: "#8AA5C1",
            });
            handle.rightText = createTextNode(context, {
                width: ACTION_ICON_WIDTH,
                height: Math.max(
                    1,
                    context.bounds.height - WIDGET_VERTICAL_PADDING * 2
                ),
                textAlign: "center",
                text: type === "combo" ? ">" : "+",
                fill: "#8AA5C1",
            });
            if (handle.leftText) {
                handle.leftText.text = type === "combo" ? "<" : "-";
            }
            (
                handle.actionsFlow as { add?: (children: unknown[]) => void } | null
            )?.add?.([handle.leftText, handle.rightText]);
            (handle.content as { add?: (children: unknown[]) => void } | null)?.add?.([
                handle.actionsFlow,
            ]);
            this.patchView(context, handle, 0);
            return handle;
        },
        patchView(context, handle) {
            const builtinHandle = handle as BuiltinWidgetHandle;
            applyRootLayout(builtinHandle, context);
            patchLabelAndValue(builtinHandle, context);
            const frames = resolveStepperFrames(context.bounds);
            const contentHeight = Math.max(
                1,
                context.bounds.height - WIDGET_VERTICAL_PADDING * 2
            );

            if (builtinHandle.valueText) {
                builtinHandle.valueText.textAlign =
                    type === "combo" ? "center" : "right";
                builtinHandle.valueText.autoWidth = undefined;
                builtinHandle.valueText.width = frames.valueWidth;
                builtinHandle.valueText.height = contentHeight;
            }
            if (builtinHandle.labelText) {
                builtinHandle.labelText.width = frames.labelWidth;
                builtinHandle.labelText.height = contentHeight;
            }
            if (builtinHandle.actionsFlow) {
                builtinHandle.actionsFlow.width =
                    frames.actionWidth * 2 + ACTION_FLOW_GAP;
                builtinHandle.actionsFlow.height = contentHeight;
            }
            if (builtinHandle.leftText) {
                builtinHandle.leftText.width = frames.actionWidth;
                builtinHandle.leftText.height = contentHeight;
            }
            if (builtinHandle.rightText) {
                builtinHandle.rightText.width = frames.actionWidth;
                builtinHandle.rightText.height = contentHeight;
            }

            const contentX = toFiniteNumber(builtinHandle.content?.x, INLINE_PADDING);
            const labelWidth = builtinHandle.labelText
                ? toFiniteNumber(builtinHandle.labelText.width, frames.labelWidth)
                : frames.labelWidth;
            const valueWidth = builtinHandle.valueText
                ? toFiniteNumber(builtinHandle.valueText.width, frames.valueWidth)
                : frames.valueWidth;
            const decrementWidth = builtinHandle.leftText
                ? toFiniteNumber(builtinHandle.leftText.width, frames.actionWidth)
                : frames.actionWidth;
            const incrementWidth = builtinHandle.rightText
                ? toFiniteNumber(builtinHandle.rightText.width, frames.actionWidth)
                : frames.actionWidth;
            const editX = contentX + labelWidth + FLOW_GAP;
            const editWidth = valueWidth;
            const decrementX = editX + valueWidth + FLOW_GAP;
            const incrementX = decrementX + decrementWidth + ACTION_FLOW_GAP;

            builtinHandle.actionZones = {
                decrement: {
                    x: decrementX,
                    y: 0,
                    width: decrementWidth,
                    height: context.bounds.height,
                },
                edit: {
                    x: editX,
                    y: 0,
                    width: editWidth,
                    height: context.bounds.height,
                },
                increment: {
                    x: incrementX,
                    y: 0,
                    width: incrementWidth,
                    height: context.bounds.height,
                },
            };
        },
        performAction(context): ModernWidgetActionResult {
            if (
                context.action === "edit" ||
                context.action === "activate"
            ) {
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
    const verticalPadding = WIDGET_VERTICAL_PADDING;
    const gap = WIDGET_ROW_GAP;
    const usableHeight =
        bodyBounds.height - verticalPadding * 2 - gap * (totalCount - 1);
    const rowHeight = Math.max(WIDGET_ROW_MIN_HEIGHT, usableHeight / totalCount);
    return {
        x: bodyBounds.x + 6,
        y: bodyBounds.y + verticalPadding + index * (rowHeight + gap),
        width: Math.max(32, bodyBounds.width - 12),
        height: rowHeight,
    };
}

export type { ModernWidgetRenderer };
