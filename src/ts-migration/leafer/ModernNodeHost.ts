import { Flow } from "@leafer-in/flow";
import * as leafer from "leafer-ui";
import { Group, Path, Rect, Text, UI } from "leafer-ui";

import {
    MODERN_NODE_STATE_KEY,
    ModernNodeChangeMask,
    type ModernActionPartSchema,
    type ModernNodeChangeMaskValue,
    type ModernNodeLifecycleContext,
    type ModernNodePortLayout,
    type ModernPortPresentation,
    type ModernShellState,
} from "./ModernNodeContracts";
import type {
    ModernWidgetRenderContext,
    ModernWidgetRenderer,
    ModernWidgetSchema,
    ModernWidgetViewHandle,
} from "./index";
import type { GraphMutationNodeLike } from "./GraphMutationBus";
import {
    PORT_DIRECTION_LEFT,
    PORT_DIRECTION_RIGHT,
} from "./NodePortAdapter";
import {
    ensureDefaultModernWidgetRenderers,
    resolveModernWidgetRenderer,
    resolveWidgetBounds,
} from "./ModernWidgetRegistry";
import type {
    NodeViewHost,
    NodeViewPortHit,
    NodeViewPortKind,
} from "./NodeViewHost";

export type ModernNodePartKind =
    | "body"
    | "header"
    | "collapse"
    | "resize"
    | "widget"
    | "action-part"
    | "input-port"
    | "output-port";

export interface ModernNodeRectLike {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ModernNodeWidgetLayout extends ModernNodeRectLike {
    index: number;
    id?: string;
    type?: string;
    action?: "activate" | "toggle" | "edit";
    actionZones?: Record<string, ModernNodeRectLike>;
}

export interface ModernNodePortVisualLayout extends ModernNodeRectLike {
    index: number;
    anchorX: number;
    anchorY: number;
    dir: number;
    radius: number;
    label: string;
    hiddenLabelWhenCollapsed: boolean;
    shape: string;
    colorOn: string;
    colorOff: string;
    active: boolean;
}

export interface ModernNodeActionPartLayout extends ModernNodeRectLike {
    index: number;
    id: string;
    action: string;
    cursor?: string;
}

export interface ModernNodeShellLayout {
    width: number;
    height: number;
    header?: ModernNodeRectLike | null;
    body?: ModernNodeRectLike | null;
    collapse?: ModernNodeRectLike | null;
    resize?: ModernNodeRectLike | null;
    widgets?: ModernNodeWidgetLayout[];
    inputPorts?: ModernNodePortVisualLayout[];
    outputPorts?: ModernNodePortVisualLayout[];
    actionParts?: ModernNodeActionPartLayout[];
}

export interface ModernNodePartHit {
    kind: ModernNodePartKind;
    index?: number;
    id?: string;
    action?: string;
    cursor?: string;
    bounds?: ModernNodeRectLike | null;
}

export interface ModernNodeInteractionState {
    hovered: boolean;
    pressed: boolean;
    dragging: boolean;
    resizing: boolean;
    hoveredPart: ModernNodePartHit | null;
    pressedPart: ModernNodePartHit | null;
}

interface ModernWidgetEntry {
    schema: ModernWidgetSchema;
    renderer: ModernWidgetRenderer;
    handle: ModernWidgetViewHandle;
    layout: ModernNodeWidgetLayout;
}

interface ModernActionPartEntry {
    schema: ModernActionPartSchema<ModernNodeLike, ModernNodeHost>;
    root: Group;
    background: Rect;
    outline: Rect;
    content: Flow;
    label: Text;
    glyph?: Path | null;
    layout: ModernNodeActionPartLayout;
}

interface ModernPortEntry {
    kind: NodeViewPortKind;
    slotIndex: number;
    layout: ModernNodePortVisualLayout;
    root: Group;
    marker: UI | Group;
    label: Text;
}

interface ShellParts {
    shell: Group;
    selectionOutline: Rect;
    header: Rect;
    body: Rect;
    headerContent: Flow;
    title: Text;
    headerMeta: Text;
    summary: Text;
    collapseOverlay: Rect;
    signalLamp: Rect;
    resizeHandle: Group;
    resizeHandleGlyph: Path;
    inputPortLayer: Group;
    outputPortLayer: Group;
    widgetLayer: Group;
    contentLayer: Group;
    actionPartLayer: Group;
}

interface StoredModernNodeState {
    layout: ModernNodeShellLayout;
    shellState: ModernShellState;
}

export interface ModernNodeBuildContext {
    readonly node: ModernNodeLike;
    readonly host: ModernNodeHost;
    readonly root: Group;
    readonly content: UI | Group | null;
    readonly changeMask: ModernNodeChangeMaskValue;
    readonly interactionState: ModernNodeInteractionState;
    readonly shellState: Readonly<ModernShellState>;
    readonly leafer: typeof leafer;
}

export interface ModernNodeLike extends GraphMutationNodeLike {
    pos: [number, number] | Float32Array;
    size: [number, number] | Float32Array;
    title?: string;
    color?: string | null;
    bgcolor?: string | null;
    boxcolor?: string | null;
    title_text_color?: string | null;
    outlinecolor?: string | null;
    mode?: number;
    execute_triggered?: number;
    action_triggered?: number;
    inputs?: Array<unknown> | null;
    outputs?: Array<unknown> | null;
    is_selected?: boolean;
    flags?: { collapsed?: boolean } | null;
    ensureModernPorts?: () => void;
    defineWidgets?: () => ReadonlyArray<ModernWidgetSchema>;
    defineActionParts?: (
        context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>
    ) => ReadonlyArray<ModernActionPartSchema<ModernNodeLike, ModernNodeHost>>;
    getShellState?: (
        context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>
    ) => ModernShellState | null | undefined;
    getPortPresentation?: (
        kind: NodeViewPortKind,
        slotIndex: number,
        context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>
    ) => ModernPortPresentation | null;
    consumeModernChangeMask?: () => ModernNodeChangeMaskValue;
    mountContent?: (
        context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>
    ) => unknown;
    patchContent?: (
        context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>
    ) => void;
    mountView?: (
        context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>
    ) => unknown;
    patchView?: (
        context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>
    ) => void;
    buildUI?: (context: ModernNodeBuildContext) => unknown;
    updateUI?: (context: ModernNodeBuildContext) => void;
    getPortLayout?: (
        kind: NodeViewPortKind,
        slotIndex: number,
        context: ModernNodeBuildContext
    ) => ModernNodePortLayout | null;
    getConnectionPos?: (
        isInput: boolean,
        slotIndex: number,
        out?: [number, number]
    ) => [number, number] | Float32Array;
    getTitle?: () => string;
    onActionPart?: (
        action: string,
        part: ModernActionPartSchema<ModernNodeLike, ModernNodeHost>,
        event?: PointerEvent,
        graphcanvas?: unknown
    ) => void;
}

const TITLE_HEIGHT = 34;
const SLOT_HEIGHT = 20;
const BODY_MIN_WIDTH = 132;
const BODY_MIN_HEIGHT = 34;
const BODY_PADDING_X = 12;
const BODY_PADDING_Y = 10;
const OUTLINE_PADDING = 4;
const RESIZE_HANDLE_SIZE = 14;
const HEADER_META_GAP = 10;
const HEADER_META_MIN_WIDTH = 44;
const HEADER_SIGNAL_SIZE = 10;
const PORT_LABEL_MAX_WIDTH = 84;
const PORT_LABEL_PADDING = 10;
const PORT_GUTTER_MIN = 14;
const WIDGET_ROW_HEIGHT = 28;
const WIDGET_ROW_GAP = 6;

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toPoint(
    value:
        | { x?: unknown; y?: unknown }
        | ArrayLike<unknown>
        | null
        | undefined
): [number, number] | null {
    if (!value) {
        return null;
    }
    if (
        typeof value === "object" &&
        value !== null &&
        ("0" in value || ArrayBuffer.isView(value as ArrayBufferView))
    ) {
        const indexed = value as ArrayLike<unknown>;
        return [toFiniteNumber(indexed[0]), toFiniteNumber(indexed[1])];
    }
    const point = value as { x?: unknown; y?: unknown };
    return [toFiniteNumber(point.x), toFiniteNumber(point.y)];
}

function pointInsideRect(
    point: readonly [number, number],
    rect?: ModernNodeRectLike | null
): boolean {
    if (!rect) {
        return false;
    }
    return (
        point[0] >= rect.x &&
        point[0] <= rect.x + rect.width &&
        point[1] >= rect.y &&
        point[1] <= rect.y + rect.height
    );
}

function samePart(
    a: ModernNodePartHit | null,
    b: ModernNodePartHit | null
): boolean {
    if (!a && !b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    return (
        a.kind === b.kind &&
        a.index === b.index &&
        a.id === b.id &&
        a.action === b.action
    );
}

function clonePartHit(part: ModernNodePartHit | null): ModernNodePartHit | null {
    return part ? { ...part, bounds: part.bounds ? { ...part.bounds } : null } : null;
}

function toUI(value: unknown): UI | Group | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    return value as UI | Group;
}

function createText(config: Record<string, unknown>): Text {
    return new Text({
        fontSize: 12,
        fontFamily:
            "'Aptos', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        fill: "#E8EDF2",
        hittable: false,
        textWrap: "none",
        textOverflow: "hide",
        verticalAlign: "middle",
        ...config,
    });
}

function cloneRect(rect: ModernNodeRectLike): ModernNodeRectLike {
    return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
    };
}

function offsetRect(
    rect: ModernNodeRectLike,
    offsetX: number,
    offsetY: number
): ModernNodeRectLike {
    return {
        x: rect.x + offsetX,
        y: rect.y + offsetY,
        width: rect.width,
        height: rect.height,
    };
}

function getLiteGraphConstants(): {
    NODE_TITLE_HEIGHT: number;
    NODE_SLOT_HEIGHT: number;
    NODE_DEFAULT_COLOR: string;
    NODE_DEFAULT_BGCOLOR: string;
    NODE_DEFAULT_BOXCOLOR: string;
    NODE_MODES_COLORS: string[];
    LINK_COLOR: string;
    EVENT_LINK_COLOR: string;
    BOX_SHAPE: number;
    ARROW_SHAPE: number;
    GRID_SHAPE: number;
    EVENT: number;
    ACTION: number;
} {
    const host = globalThis as typeof globalThis & {
        LiteGraph?: Record<string, unknown>;
    };
    const liteGraph = host.LiteGraph || {};
    return {
        NODE_TITLE_HEIGHT: toFiniteNumber(liteGraph.NODE_TITLE_HEIGHT, TITLE_HEIGHT),
        NODE_SLOT_HEIGHT: toFiniteNumber(liteGraph.NODE_SLOT_HEIGHT, SLOT_HEIGHT),
        NODE_DEFAULT_COLOR: String(liteGraph.NODE_DEFAULT_COLOR || "#333333"),
        NODE_DEFAULT_BGCOLOR: String(liteGraph.NODE_DEFAULT_BGCOLOR || "#353535"),
        NODE_DEFAULT_BOXCOLOR: String(liteGraph.NODE_DEFAULT_BOXCOLOR || "#666666"),
        NODE_MODES_COLORS: Array.isArray(liteGraph.NODE_MODES_COLORS)
            ? (liteGraph.NODE_MODES_COLORS as string[])
            : ["#666666", "#422222", "#333333", "#224422", "#662266"],
        LINK_COLOR: String(liteGraph.LINK_COLOR || "#9A9"),
        EVENT_LINK_COLOR: String(liteGraph.EVENT_LINK_COLOR || "#A86"),
        BOX_SHAPE: toFiniteNumber(liteGraph.BOX_SHAPE, 1),
        ARROW_SHAPE: toFiniteNumber(liteGraph.ARROW_SHAPE, 5),
        GRID_SHAPE: toFiniteNumber(liteGraph.GRID_SHAPE, 6),
        EVENT: toFiniteNumber(liteGraph.EVENT, -1),
        ACTION: toFiniteNumber(liteGraph.ACTION, -1),
    };
}

let textMeasureCanvas: HTMLCanvasElement | null = null;
let textMeasureContext: CanvasRenderingContext2D | null = null;

function measureTextWidth(
    text: string,
    font = '600 13px "Aptos", "Segoe UI", sans-serif'
): number {
    if (
        typeof document === "undefined" ||
        typeof document.createElement !== "function"
    ) {
        return text.length * 7.2;
    }
    if (!textMeasureCanvas) {
        textMeasureCanvas = document.createElement("canvas");
        textMeasureContext = textMeasureCanvas.getContext("2d");
    }
    if (!textMeasureContext) {
        return text.length * 7.2;
    }
    textMeasureContext.font = font;
    return textMeasureContext.measureText(text).width;
}

function mergeShellState(
    defaults: ModernShellState,
    incoming: ModernShellState | null | undefined
): ModernShellState {
    return {
        ...defaults,
        ...(incoming || {}),
    };
}

function defaultShellState(node: ModernNodeLike): ModernShellState {
    const constants = getLiteGraphConstants();
    const ctor = (node.constructor || {}) as unknown as Record<string, unknown>;
    const triggeredColor =
        toFiniteNumber(node.action_triggered) > 0
            ? "#FFFFFF"
            : toFiniteNumber(node.execute_triggered) > 0
              ? "#AAAAAA"
              : null;
    const modeColor =
        node.mode != null && constants.NODE_MODES_COLORS[node.mode]
            ? constants.NODE_MODES_COLORS[node.mode]
            : null;
    return {
        title:
            (typeof node.getTitle === "function" && node.getTitle()) ||
            node.title ||
            (node as { type?: string }).type ||
            "Node",
        titleMode: "default",
        titleColor:
            (node.color as string | null | undefined) ||
            (ctor.title_color as string | undefined) ||
            (ctor.color as string | undefined) ||
            constants.NODE_DEFAULT_COLOR,
        titleTextColor:
            (node.title_text_color as string | null | undefined) || "#F5F7FA",
        boxColor:
            (node.boxcolor as string | null | undefined) ||
            triggeredColor ||
            modeColor ||
            constants.NODE_DEFAULT_BOXCOLOR,
        bodyColor:
            (node.bgcolor as string | null | undefined) ||
            (ctor.bgcolor as string | undefined) ||
            constants.NODE_DEFAULT_BGCOLOR,
        borderColor:
            (node.outlinecolor as string | null | undefined) || "#243342",
        showSignalLamp: true,
        collapsible: true,
        resizable: true,
        showCollapsedSlots: true,
        allowNodeHover: false,
        summaryText: "",
    };
}

function partStateFor(
    interaction: ModernNodeInteractionState,
    targetKind: ModernNodePartKind,
    index?: number,
    id?: string
): "" | "hover" | "press" {
    const pressed =
        interaction.pressedPart &&
        interaction.pressedPart.kind === targetKind &&
        interaction.pressedPart.index === index &&
        interaction.pressedPart.id === id;
    if (pressed) {
        return "press";
    }

    const hovered =
        interaction.hoveredPart &&
        interaction.hoveredPart.kind === targetKind &&
        interaction.hoveredPart.index === index &&
        interaction.hoveredPart.id === id;
    return hovered ? "hover" : "";
}

function signatureOfWidgets(schemas: readonly ModernWidgetSchema[]): string {
    return schemas.map((schema) => `${schema.id}:${schema.type}`).join("|");
}

function signatureOfActionParts<
    TNode extends { id: number | string },
    THost,
>(
    schemas: readonly ModernActionPartSchema<TNode, THost>[]
): string {
    return schemas
        .map((schema) => `${schema.id}:${schema.action || ""}:${schema.placement || ""}`)
        .join("|");
}

function createPortMarker(shape: string, color: string): UI | Group {
    const marker = (() => {
        switch (shape) {
            case "box":
                return new Rect({
                    x: -4,
                    y: -4,
                    width: 8,
                    height: 8,
                    cornerRadius: 2,
                    fill: color,
                    stroke: "#10151A",
                    strokeWidth: 1,
                    hittable: false,
                }) as UI | Group;
            case "arrow":
                return new Path({
                    path: "M -5 -4 L 5 0 L -5 4 Z",
                    fill: color,
                    stroke: "#10151A",
                    strokeWidth: 1,
                    hittable: false,
                }) as UI | Group;
            case "grid": {
                const group = new Group({ hittable: false });
                group.add([
                    new Rect({
                        x: -5,
                        y: -5,
                        width: 4,
                        height: 4,
                        fill: color,
                        cornerRadius: 1,
                        hittable: false,
                    }),
                    new Rect({
                        x: 1,
                        y: -5,
                        width: 4,
                        height: 4,
                        fill: color,
                        cornerRadius: 1,
                        hittable: false,
                    }),
                    new Rect({
                        x: -5,
                        y: 1,
                        width: 4,
                        height: 4,
                        fill: color,
                        cornerRadius: 1,
                        hittable: false,
                    }),
                    new Rect({
                        x: 1,
                        y: 1,
                        width: 4,
                        height: 4,
                        fill: color,
                        cornerRadius: 1,
                        hittable: false,
                    }),
                ]);
                return group as UI | Group;
            }
            default:
                return new Rect({
                    x: -4,
                    y: -4,
                    width: 8,
                    height: 8,
                    cornerRadius: 999,
                    fill: color,
                    stroke: "#10151A",
                    strokeWidth: 1,
                    hittable: false,
                }) as UI | Group;
        }
    })();
    (marker as unknown as Record<string, unknown>).__litegraphPortShape = shape;
    return marker;
}

function setShapeColor(shape: UI | Group, color: string): void {
    const shapeData = shape as unknown as Record<string, unknown>;
    if ("fill" in shapeData) {
        shapeData.fill = color;
    }
    if ((shape as Group).children) {
        const children = (((shape as Group).children || []) as unknown) as Array<
            Record<string, unknown>
        >;
        for (let i = 0; i < children.length; ++i) {
            if ("fill" in children[i]) {
                children[i].fill = color;
            }
        }
    }
}

export class ModernNodeHost implements NodeViewHost {
    readonly runtime = "modern" as const;
    readonly node: ModernNodeLike;
    readonly root: Group;

    private readonly shell: ShellParts;
    private readonly interactionState: ModernNodeInteractionState = {
        hovered: false,
        pressed: false,
        dragging: false,
        resizing: false,
        hoveredPart: null,
        pressedPart: null,
    };
    private shellState: ModernShellState = {};
    private shellLayout: ModernNodeShellLayout = {
        width: BODY_MIN_WIDTH,
        height: BODY_MIN_HEIGHT,
    };
    private content: UI | Group | null = null;
    private widgetEntries: ModernWidgetEntry[] = [];
    private actionPartEntries: ModernActionPartEntry[] = [];
    private portEntries = new Map<string, ModernPortEntry>();
    private widgetValueSnapshot = new Map<string, unknown>();
    private currentWidgetSchemas: ReadonlyArray<ModernWidgetSchema> = [];
    private currentActionPartSchemas: ReadonlyArray<
        ModernActionPartSchema<ModernNodeLike, ModernNodeHost>
    > = [];
    private lastWidgetSignature = "";
    private lastActionPartSignature = "";
    private mounted = false;
    private resizeAnchor: {
        startWorldX: number;
        startWorldY: number;
        startWidth: number;
        startHeight: number;
    } | null = null;

    constructor(node: ModernNodeLike) {
        this.node = node;
        ensureDefaultModernWidgetRenderers();
        this.root = new Group({
            name: `litegraph-modern-node:${String(node.id)}`,
            hittable: true,
            data: {
                litegraphNodeId: String(node.id),
                litegraphRuntime: "modern",
            },
        });
        this.shell = this.createShellParts();
        this.root.add(this.shell.shell);
        this.repaint();
    }

    repaint(): void {
        this.node.ensureModernPorts?.();
        const changeMask = this.consumeChangeMask();
        this.shellState = this.resolveShellState(changeMask);
        this.currentWidgetSchemas = this.collectWidgetSchemas();
        this.currentActionPartSchemas = this.collectActionPartSchemas(changeMask);
        this.ensureMinimumNodeSize(this.shellState);
        this.shellLayout = this.computeShellLayout(this.shellState);

        if (!this.mounted) {
            this.content = toUI(this.mountContent(changeMask));
            if (this.content) {
                this.content.hittable = false;
                this.shell.contentLayer.add(this.content);
            }
            this.mounted = true;
        } else if (changeMask !== ModernNodeChangeMask.None) {
            this.patchContent(changeMask);
        }

        this.syncWidgets(changeMask);
        this.syncActionParts(changeMask);
        this.syncPorts();
        this.applyShellLayout();
        this.syncContentLayout();
        this.applyInteractionState();
        this.syncPosition();
        this.storeInspectableState();
    }

    private collectWidgetSchemas(): ReadonlyArray<ModernWidgetSchema> {
        if (Boolean(this.node.flags?.collapsed)) {
            return [];
        }
        const schemas = this.node.defineWidgets?.();
        return Array.isArray(schemas) ? [...schemas] : [];
    }

    private collectActionPartSchemas(
        changeMask: ModernNodeChangeMaskValue
    ): ReadonlyArray<ModernActionPartSchema<ModernNodeLike, ModernNodeHost>> {
        if (Boolean(this.node.flags?.collapsed)) {
            return [];
        }
        const parts = this.node.defineActionParts?.(
            this.createLifecycleContext(changeMask)
        );
        return Array.isArray(parts)
            ? parts.filter((schema) => schema.visible !== false)
            : [];
    }

    private ensureMinimumNodeSize(shellState: ModernShellState): void {
        if (Boolean(this.node.flags?.collapsed)) {
            return;
        }

        const size = this.node.size;
        const nextWidth = Math.max(
            toFiniteNumber(size?.[0], BODY_MIN_WIDTH),
            toFiniteNumber(shellState.minimumWidth, BODY_MIN_WIDTH),
            this.resolveMinimumShellWidth(shellState)
        );
        const nextHeight = Math.max(
            toFiniteNumber(size?.[1], BODY_MIN_HEIGHT),
            toFiniteNumber(shellState.minimumHeight, BODY_MIN_HEIGHT),
            this.resolveMinimumBodyHeight(shellState)
        );

        if (size) {
            size[0] = nextWidth;
            size[1] = nextHeight;
        } else {
            this.node.size = [nextWidth, nextHeight] as [number, number];
        }
    }

    syncPosition(): void {
        this.root.x = toFiniteNumber(this.node.pos?.[0]);
        this.root.y = toFiniteNumber(this.node.pos?.[1]);
    }

    destroy(): void {
        this.clearWidgets();
        this.clearActionParts();
        for (const entry of this.portEntries.values()) {
            entry.root.destroy();
            entry.label.destroy();
        }
        this.portEntries.clear();
        this.content?.destroy();
        this.root.destroy();
    }

    getInteractionState(): Readonly<ModernNodeInteractionState> {
        return this.interactionState;
    }

    updateInteractionState(patch: Partial<ModernNodeInteractionState>): void {
        const nextHoveredPart =
            patch.hoveredPart === undefined
                ? this.interactionState.hoveredPart
                : clonePartHit(patch.hoveredPart);
        const nextPressedPart =
            patch.pressedPart === undefined
                ? this.interactionState.pressedPart
                : clonePartHit(patch.pressedPart);

        const changed =
            (patch.hovered ?? this.interactionState.hovered) !==
                this.interactionState.hovered ||
            (patch.pressed ?? this.interactionState.pressed) !==
                this.interactionState.pressed ||
            (patch.dragging ?? this.interactionState.dragging) !==
                this.interactionState.dragging ||
            (patch.resizing ?? this.interactionState.resizing) !==
                this.interactionState.resizing ||
            !samePart(nextHoveredPart, this.interactionState.hoveredPart) ||
            !samePart(nextPressedPart, this.interactionState.pressedPart);

        if (!changed) {
            return;
        }

        this.interactionState.hovered =
            patch.hovered ?? this.interactionState.hovered;
        this.interactionState.pressed =
            patch.pressed ?? this.interactionState.pressed;
        this.interactionState.dragging =
            patch.dragging ?? this.interactionState.dragging;
        this.interactionState.resizing =
            patch.resizing ?? this.interactionState.resizing;
        this.interactionState.hoveredPart = nextHoveredPart;
        this.interactionState.pressedPart = nextPressedPart;
        this.applyInteractionState();
    }

    clearPointerState(): void {
        this.updateInteractionState({
            hovered: false,
            pressed: false,
            dragging: false,
            resizing: false,
            hoveredPart: null,
            pressedPart: null,
        });
    }

    getInteractivePartAt(
        worldX: number,
        worldY: number
    ): ModernNodePartHit | null {
        const localPoint = this.getLocalPoint(worldX, worldY);
        const layout = this.shellLayout;

        const widgetHit = this.hitWidgetPart(localPoint, layout.widgets);
        if (widgetHit) {
            return widgetHit;
        }

        const actionPartHit = this.hitActionPart(localPoint, layout.actionParts);
        if (actionPartHit) {
            return actionPartHit;
        }

        const outputPortHit = this.hitPortPart(
            localPoint,
            "output-port",
            layout.outputPorts
        );
        if (outputPortHit) {
            return outputPortHit;
        }

        const inputPortHit = this.hitPortPart(
            localPoint,
            "input-port",
            layout.inputPorts
        );
        if (inputPortHit) {
            return inputPortHit;
        }

        if (pointInsideRect(localPoint, layout.collapse)) {
            return {
                kind: "collapse",
                cursor: "pointer",
                bounds: layout.collapse || null,
            };
        }

        if (pointInsideRect(localPoint, layout.resize)) {
            return {
                kind: "resize",
                cursor: "se-resize",
                bounds: layout.resize || null,
            };
        }

        if (pointInsideRect(localPoint, layout.header)) {
            return {
                kind: "header",
                bounds: layout.header || null,
            };
        }

        if (pointInsideRect(localPoint, layout.body)) {
            return {
                kind: "body",
                bounds: layout.body || null,
            };
        }

        return null;
    }

    beginResize(worldX: number, worldY: number): void {
        this.resizeAnchor = {
            startWorldX: worldX,
            startWorldY: worldY,
            startWidth: Math.max(toFiniteNumber(this.node.size?.[0], 160), 80),
            startHeight: Math.max(toFiniteNumber(this.node.size?.[1], 80), 30),
        };
        this.updateInteractionState({
            resizing: true,
            dragging: false,
            pressed: true,
        });
    }

    updateResize(worldX: number, worldY: number): boolean {
        if (!this.resizeAnchor) {
            return false;
        }

        const nextWidth = Math.max(
            BODY_MIN_WIDTH,
            Math.round(
                this.resizeAnchor.startWidth +
                    (worldX - this.resizeAnchor.startWorldX)
            )
        );
        const nextHeight = Math.max(
            BODY_MIN_HEIGHT,
            Math.round(
                this.resizeAnchor.startHeight +
                    (worldY - this.resizeAnchor.startWorldY)
            )
        );

        if (
            nextWidth === toFiniteNumber(this.node.size?.[0]) &&
            nextHeight === toFiniteNumber(this.node.size?.[1])
        ) {
            return false;
        }

        this.node.size[0] = nextWidth;
        this.node.size[1] = nextHeight;
        this.repaint();
        return true;
    }

    endResize(): void {
        this.resizeAnchor = null;
        this.updateInteractionState({
            resizing: false,
            pressed: false,
            pressedPart: null,
        });
    }

    getWidgetEntry(index: number): ModernWidgetEntry | null {
        return this.widgetEntries[index] || null;
    }

    getActionPartEntry(index: number): ModernActionPartEntry | null {
        return this.actionPartEntries[index] || null;
    }

    executeActionPart(
        part: ModernNodePartHit,
        event?: PointerEvent,
        graphcanvas?: unknown
    ): void {
        if (part.index == null) {
            return;
        }
        const entry = this.actionPartEntries[part.index];
        if (!entry || entry.schema.disabled) {
            return;
        }

        entry.schema.onTrigger?.({
            node: this.node,
            host: this,
            graphcanvas,
            event,
        });

        this.node.onActionPart?.(
            entry.schema.action || entry.schema.id,
            entry.schema,
            event,
            graphcanvas
        );
    }

    getLocalPoint(worldX: number, worldY: number): readonly [number, number] {
        const point = this.root.getInnerPoint({ x: worldX, y: worldY });
        return [toFiniteNumber(point.x), toFiniteNumber(point.y)];
    }

    getPortAnchor(
        kind: NodeViewPortKind,
        slotIndex: number
    ): readonly [number, number] | null {
        const layout = this.resolvePortLayout(kind, slotIndex);
        if (layout) {
            return [
                toFiniteNumber(this.root.x) + layout.anchorX,
                toFiniteNumber(this.root.y) + layout.anchorY,
            ];
        }

        const fallbackPoint = toPoint(
            this.node.getConnectionPos?.(kind === "input", slotIndex)
        );
        return fallbackPoint || null;
    }

    getPortDirection(
        kind: NodeViewPortKind,
        _slotIndex: number
    ): number | null {
        return kind === "input" ? PORT_DIRECTION_LEFT : PORT_DIRECTION_RIGHT;
    }

    hitPortAt(worldX: number, worldY: number): NodeViewPortHit | null {
        let bestHit: (NodeViewPortHit & { distance: number }) | null = null;
        const kinds: NodeViewPortKind[] = ["output", "input"];

        for (let i = 0; i < kinds.length; ++i) {
            const kind = kinds[i];
            const layouts =
                kind === "input"
                    ? this.shellLayout.inputPorts || []
                    : this.shellLayout.outputPorts || [];
            for (let slotIndex = 0; slotIndex < layouts.length; ++slotIndex) {
                const layout = layouts[slotIndex];
                const anchor = this.getPortAnchor(kind, layout.index);
                if (!anchor) {
                    continue;
                }
                const dx = worldX - anchor[0];
                const dy = worldY - anchor[1];
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > layout.radius) {
                    continue;
                }

                if (!bestHit || dist < bestHit.distance) {
                    bestHit = {
                        kind,
                        slotIndex: layout.index,
                        anchor,
                        dir: layout.dir,
                        distance: dist,
                    };
                }
            }
        }

        if (!bestHit) {
            return null;
        }

        return {
            kind: bestHit.kind,
            slotIndex: bestHit.slotIndex,
            anchor: bestHit.anchor,
            dir: bestHit.dir,
        };
    }

    private createShellParts(): ShellParts {
        const shell = new Group({
            name: `litegraph-modern-shell:${String(this.node.id)}`,
            hittable: false,
        });
        const selectionOutline = new Rect({
            fill: "rgba(0,0,0,0)",
            stroke: "#67A2FF",
            strokeWidth: 1.5,
            cornerRadius: 14,
            visible: false,
            hittable: false,
        });
        const header = new Rect({
            fill: "#283444",
            stroke: "#314254",
            strokeWidth: 1,
            cornerRadius: [12, 12, 0, 0],
            hittable: false,
        });
        const body = new Rect({
            fill: "#101720",
            stroke: "#243342",
            strokeWidth: 1.25,
            cornerRadius: [0, 0, 12, 12],
            hittable: false,
        });
        const headerContent = new Flow({
            x: 34,
            y: -TITLE_HEIGHT,
            width: 1,
            height: TITLE_HEIGHT,
            flow: "x",
            gap: HEADER_META_GAP,
            flowAlign: {
                content: "left",
                y: "center",
            },
            hittable: false,
        });
        const title = createText({
            text: "",
            height: TITLE_HEIGHT,
            fontSize: 13,
            fontWeight: 600,
        });
        const headerMeta = createText({
            width: HEADER_META_MIN_WIDTH,
            height: TITLE_HEIGHT,
            fontSize: 10,
            fontWeight: 500,
            textAlign: "right",
            fill: "#89A0B7",
            text: "",
        });
        headerContent.add([title, headerMeta]);
        const summary = createText({
            x: BODY_PADDING_X,
            y: 18,
            text: "",
            fontSize: 11,
            fill: "#A5B4C1",
        });
        const collapseOverlay = new Rect({
            x: 0,
            y: -TITLE_HEIGHT,
            width: TITLE_HEIGHT,
            height: TITLE_HEIGHT,
            cornerRadius: [10, 0, 0, 0],
            fill: "rgba(255,255,255,0)",
            stroke: "rgba(255,255,255,0)",
            strokeWidth: 0,
            hittable: false,
        });
        const signalLamp = new Rect({
            x: 10,
            y: -TITLE_HEIGHT + (TITLE_HEIGHT - HEADER_SIGNAL_SIZE) / 2,
            width: HEADER_SIGNAL_SIZE,
            height: HEADER_SIGNAL_SIZE,
            cornerRadius: 999,
            fill: "#666666",
            stroke: "#10151A",
            strokeWidth: 1,
            hittable: false,
        });
        const resizeHandleGlyph = new Path({
            path: "M 2 12 L 12 2 M 6 12 L 12 6 M 10 12 L 12 10",
            stroke: "#8593A0",
            strokeWidth: 1,
            opacity: 0.9,
            hittable: false,
        });
        const resizeHandle = new Group({
            visible: false,
            hittable: false,
        });
        resizeHandle.add(resizeHandleGlyph);
        const inputPortLayer = new Group({ name: "input-ports", hittable: false });
        const outputPortLayer = new Group({ name: "output-ports", hittable: false });
        const widgetLayer = new Group({ name: "widgets", hittable: false });
        const contentLayer = new Group({ name: "content", hittable: false });
        const actionPartLayer = new Group({ name: "action-parts", hittable: false });

        shell.add([
            selectionOutline,
            header,
            body,
            collapseOverlay,
            signalLamp,
            headerContent,
            summary,
            inputPortLayer,
            outputPortLayer,
            contentLayer,
            widgetLayer,
            actionPartLayer,
            resizeHandle,
        ]);

        return {
            shell,
            selectionOutline,
            header,
            body,
            headerContent,
            title,
            headerMeta,
            summary,
            collapseOverlay,
            signalLamp,
            resizeHandle,
            resizeHandleGlyph,
            inputPortLayer,
            outputPortLayer,
            widgetLayer,
            contentLayer,
            actionPartLayer,
        };
    }

    private consumeChangeMask(): ModernNodeChangeMaskValue {
        const rawMask = this.node.consumeModernChangeMask?.();
        if (rawMask == null) {
            return ModernNodeChangeMask.All;
        }
        const normalizedMask = toFiniteNumber(rawMask, ModernNodeChangeMask.None);
        return normalizedMask <= ModernNodeChangeMask.None
            ? ModernNodeChangeMask.None
            : normalizedMask;
    }

    private resolveShellState(
        changeMask: ModernNodeChangeMaskValue
    ): ModernShellState {
        const context = this.createLifecycleContext(changeMask);
        return mergeShellState(
            defaultShellState(this.node),
            this.node.getShellState?.(context)
        );
    }

    private computeShellLayout(
        shellState: ModernShellState
    ): ModernNodeShellLayout {
        const constants = getLiteGraphConstants();
        const titleHeight = Math.max(constants.NODE_TITLE_HEIGHT, TITLE_HEIGHT);
        const bodyHeight = Math.max(
            toFiniteNumber(this.node.size?.[1], BODY_MIN_HEIGHT),
            toFiniteNumber(shellState.minimumHeight, BODY_MIN_HEIGHT),
            this.resolveMinimumBodyHeight(shellState)
        );
        const isCollapsed = Boolean(this.node.flags?.collapsed);
        const minWidth = this.resolveMinimumShellWidth(shellState, titleHeight);
        const expandedWidth = Math.max(
            toFiniteNumber(this.node.size?.[0], BODY_MIN_WIDTH),
            minWidth
        );
        const collapsedWidth =
            shellState.collapsedWidth != null
                ? Math.max(
                      toFiniteNumber(shellState.collapsedWidth, expandedWidth),
                      Math.min(minWidth, expandedWidth),
                      56
                  )
                : Math.min(
                      expandedWidth,
                      Math.max(
                          56,
                          measureTextWidth(String(shellState.title || "")) +
                              titleHeight * 1.8
                      )
                  );
        const width = isCollapsed ? collapsedWidth : expandedWidth;
        const header: ModernNodeRectLike = {
            x: 0,
            y: -titleHeight,
            width,
            height: titleHeight,
        };
        const body: ModernNodeRectLike | null = isCollapsed
            ? null
            : {
                  x: 0,
                  y: 0,
                  width,
                  height: bodyHeight,
              };
        const collapse = shellState.collapsible
            ? {
                  x: 0,
                  y: -titleHeight,
                  width: titleHeight,
                  height: titleHeight,
              }
            : null;
        const resize =
            shellState.resizable && body
                ? {
                      x: body.width - RESIZE_HANDLE_SIZE,
                      y: body.height - RESIZE_HANDLE_SIZE,
                      width: RESIZE_HANDLE_SIZE,
                      height: RESIZE_HANDLE_SIZE,
                  }
                : null;

        return {
            width,
            height: body ? body.height : 0,
            header,
            body,
            collapse,
            resize,
            widgets: [],
            actionParts: [],
            inputPorts: [],
            outputPorts: [],
        };
    }

    private applyShellLayout(): void {
        const layout = this.shellLayout;
        const shellState = this.shellState;
        const header = layout.header || {
            x: 0,
            y: -TITLE_HEIGHT,
            width: layout.width,
            height: TITLE_HEIGHT,
        };
        const body = layout.body;
        const totalHeight = header.height + (body?.height || 0);

        this.shell.header.x = header.x;
        this.shell.header.y = header.y;
        this.shell.header.width = header.width;
        this.shell.header.height = header.height;
        this.shell.header.fill = shellState.titleColor || "#283444";
        this.shell.header.stroke = shellState.borderColor || "#314254";
        this.shell.header.cornerRadius = body ? [12, 12, 0, 0] : [12, 12, 12, 12];

        this.shell.body.visible = Boolean(body);
        if (body) {
            this.shell.body.x = body.x;
            this.shell.body.y = body.y;
            this.shell.body.width = body.width;
            this.shell.body.height = body.height;
            this.shell.body.fill = shellState.bodyColor || "#101720";
            this.shell.body.stroke = shellState.borderColor || "#314254";
            this.shell.body.cornerRadius = [0, 0, 12, 12];
        }

        const headerMeta = this.resolveHeaderMetaText(shellState);
        const headerMetaWidth = headerMeta
            ? Math.max(
                  HEADER_META_MIN_WIDTH,
                  measureTextWidth(
                      headerMeta,
                      '500 10px "Aptos", "Segoe UI", sans-serif'
                  ) + 8
              )
            : 0;
        const titleStartX = this.resolveTitleStartX(Boolean(layout.collapse), header.height);
        const showHeaderMeta =
            Boolean(headerMeta) &&
            !Boolean(this.node.flags?.collapsed) &&
            header.width - titleStartX - headerMetaWidth - HEADER_META_GAP - 12 >= 56;
        const titleEndPadding = showHeaderMeta
            ? headerMetaWidth + HEADER_META_GAP + 12
            : 14;
        const titleWidth = Math.max(24, header.width - titleStartX - titleEndPadding);

        this.shell.headerContent.x = titleStartX;
        this.shell.headerContent.y = header.y;
        this.shell.headerContent.width = Math.max(24, header.width - titleStartX - 12);
        this.shell.headerContent.height = header.height;
        this.shell.headerContent.visible =
            shellState.titleMode !== "hidden" || showHeaderMeta;

        this.shell.title.text = String(shellState.title || "");
        this.shell.title.fill = shellState.titleTextColor || "#F5F7FA";
        this.shell.title.height = header.height;
        this.shell.title.width = titleWidth;
        this.shell.title.visible = shellState.titleMode !== "hidden";

        this.shell.headerMeta.text = headerMeta;
        this.shell.headerMeta.visible = showHeaderMeta;
        this.shell.headerMeta.width = Math.max(HEADER_META_MIN_WIDTH, headerMetaWidth);
        this.shell.headerMeta.height = header.height;

        this.shell.summary.text = String(shellState.summaryText || "");
        this.shell.summary.visible = Boolean(
            body &&
                !this.widgetEntries.length &&
                !this.content &&
                shellState.summaryText
        );
        const contentArea = this.getContentArea();
        this.shell.summary.x = contentArea?.x || BODY_PADDING_X;
        this.shell.summary.y =
            (contentArea?.y || BODY_PADDING_Y) +
            Math.min(20, Math.max(14, (contentArea?.height || 24) * 0.45));
        this.shell.summary.width = Math.max(
            20,
            (contentArea?.width || layout.width - BODY_PADDING_X * 2)
        );

        this.shell.signalLamp.visible = shellState.showSignalLamp !== false;
        this.shell.signalLamp.x = 10;
        this.shell.signalLamp.y =
            header.y + (header.height - HEADER_SIGNAL_SIZE) / 2;
        this.shell.signalLamp.fill = shellState.boxColor || "#666666";

        this.shell.collapseOverlay.visible = Boolean(layout.collapse);
        if (layout.collapse) {
            this.shell.collapseOverlay.x = layout.collapse.x;
            this.shell.collapseOverlay.y = layout.collapse.y;
            this.shell.collapseOverlay.width = layout.collapse.width;
            this.shell.collapseOverlay.height = layout.collapse.height;
        }

        this.shell.resizeHandle.visible = Boolean(layout.resize);
        if (layout.resize) {
            this.shell.resizeHandle.x = layout.resize.x;
            this.shell.resizeHandle.y = layout.resize.y;
        }

        this.shell.selectionOutline.x = -OUTLINE_PADDING;
        this.shell.selectionOutline.y = header.y - OUTLINE_PADDING;
        this.shell.selectionOutline.width = layout.width + OUTLINE_PADDING * 2;
        this.shell.selectionOutline.height = totalHeight + OUTLINE_PADDING * 2;
        this.shell.selectionOutline.visible = Boolean(this.node.is_selected);
    }

    private resolveMinimumBodyHeight(shellState?: ModernShellState): number {
        const slotCount = Math.max(
            Array.isArray(this.node.inputs) ? this.node.inputs.length : 0,
            Array.isArray(this.node.outputs) ? this.node.outputs.length : 0
        );
        const widgetHeight = this.currentWidgetSchemas.length
            ? BODY_PADDING_Y * 2 +
              this.currentWidgetSchemas.length * WIDGET_ROW_HEIGHT +
              Math.max(0, this.currentWidgetSchemas.length - 1) * WIDGET_ROW_GAP
            : 0;
        const portHeight = slotCount
            ? BODY_PADDING_Y * 2 + slotCount * getLiteGraphConstants().NODE_SLOT_HEIGHT
            : 0;
        const summaryHeight =
            !this.currentWidgetSchemas.length && !this.content ? 42 : 0;
        const footerHeight = this.hasFooterActionParts() ? TITLE_HEIGHT : 0;
        return Math.max(
            BODY_MIN_HEIGHT,
            toFiniteNumber(shellState?.minimumHeight, BODY_MIN_HEIGHT),
            widgetHeight + footerHeight,
            portHeight + footerHeight,
            summaryHeight + footerHeight
        );
    }

    private resolveMinimumShellWidth(
        shellState: ModernShellState,
        headerHeight = TITLE_HEIGHT
    ): number {
        const gutters = this.resolvePortGutters();
        const headerMeta = this.resolveHeaderMetaText(shellState);
        const headerMetaWidth = headerMeta
            ? Math.max(
                  HEADER_META_MIN_WIDTH,
                  measureTextWidth(
                      headerMeta,
                      '500 10px "Aptos", "Segoe UI", sans-serif'
                  ) + 8
              )
            : 0;
        const titleWidth = measureTextWidth(
            String(shellState.title || ""),
            '600 13px "Aptos", "Segoe UI", sans-serif'
        );
        const contentWidth = this.resolveMinimumContentWidth();

        return Math.max(
            BODY_MIN_WIDTH,
            toFiniteNumber(shellState.minimumWidth, BODY_MIN_WIDTH),
            BODY_PADDING_X * 2 + gutters.left + gutters.right + contentWidth,
            this.resolveTitleStartX(Boolean(shellState.collapsible), headerHeight) +
                titleWidth +
                (headerMetaWidth
                    ? HEADER_META_GAP + headerMetaWidth + 12
                    : 14)
        );
    }

    private resolveMinimumContentWidth(): number {
        if (!this.currentWidgetSchemas.length) {
            return 72;
        }

        let minWidth = 104;
        for (let i = 0; i < this.currentWidgetSchemas.length; ++i) {
            const schema = this.currentWidgetSchemas[i];
            if (schema.type === "number" || schema.type === "combo") {
                minWidth = Math.max(minWidth, 156);
            } else if (schema.type === "text" || schema.type === "toggle") {
                minWidth = Math.max(minWidth, 124);
            } else if (schema.type === "button") {
                minWidth = Math.max(minWidth, 110);
            }
        }

        return minWidth;
    }

    private resolveHeaderMetaText(shellState: ModernShellState): string {
        if (typeof shellState.headerMetaText === "string") {
            return shellState.headerMetaText.trim();
        }
        const inputCount = Array.isArray(this.node.inputs) ? this.node.inputs.length : 0;
        const outputCount = Array.isArray(this.node.outputs)
            ? this.node.outputs.length
            : 0;
        if (inputCount || outputCount) {
            return `I${inputCount} / O${outputCount}`;
        }
        const summary = String(shellState.summaryText || "").trim();
        return summary.length > 18 ? `${summary.slice(0, 17)}...` : summary;
    }

    private resolveTitleStartX(hasCollapse: boolean, headerHeight: number): number {
        const collapseWidth = hasCollapse ? headerHeight : 0;
        return Math.max(collapseWidth + 10, 30);
    }

    private resolvePortGutters(): { left: number; right: number } {
        return {
            left: this.measurePortGutter("input"),
            right: this.measurePortGutter("output"),
        };
    }

    private measurePortGutter(kind: NodeViewPortKind): number {
        const slots = kind === "input" ? this.node.inputs : this.node.outputs;
        if (!Array.isArray(slots) || !slots.length || Boolean(this.node.flags?.collapsed)) {
            return 0;
        }

        let maxWidth = 0;
        for (let i = 0; i < slots.length; ++i) {
            const presentation = this.resolvePortPresentation(kind, i, slots[i]);
            const label =
                presentation.hideLabelWhenCollapsed && this.node.flags?.collapsed
                    ? ""
                    : presentation.label;
            if (!label) {
                continue;
            }
            maxWidth = Math.max(
                maxWidth,
                Math.min(
                    PORT_LABEL_MAX_WIDTH,
                    measureTextWidth(
                        String(label),
                        '500 11px "Aptos", "Segoe UI", sans-serif'
                    )
                )
            );
        }

        if (!maxWidth) {
            return PORT_GUTTER_MIN;
        }
        return Math.max(PORT_GUTTER_MIN, maxWidth + PORT_LABEL_PADDING + 10);
    }

    private syncContentLayout(): void {
        const contentArea = this.getContentArea();
        this.shell.contentLayer.visible = Boolean(contentArea);
        if (!this.content || !contentArea) {
            return;
        }

        this.content.x = contentArea.x;
        this.content.y = contentArea.y;
        if ("width" in (this.content as unknown as Record<string, unknown>)) {
            (this.content as unknown as Record<string, unknown>).width =
                contentArea.width;
        }
        if ("height" in (this.content as unknown as Record<string, unknown>)) {
            (this.content as unknown as Record<string, unknown>).height =
                contentArea.height;
        }
    }

    private syncWidgets(changeMask: ModernNodeChangeMaskValue): void {
        const schemas = this.currentWidgetSchemas;
        this.shell.widgetLayer.visible = schemas.length > 0;

        const nextSignature = signatureOfWidgets(schemas);
        const needsRebuild =
            this.widgetEntries.length !== schemas.length ||
            this.lastWidgetSignature !== nextSignature ||
            (changeMask & ModernNodeChangeMask.Layout) !== 0;

        if (!schemas.length) {
            this.clearWidgets();
            this.patchShellWidgetLayout([]);
            this.lastWidgetSignature = "";
            return;
        }

        const widgetArea = this.resolveWidgetArea();
        const layouts: ModernNodeWidgetLayout[] = [];
        for (let i = 0; i < schemas.length; ++i) {
            const layout = resolveWidgetBounds(widgetArea, i, schemas.length);
            layouts.push({
                ...layout,
                index: i,
                id: schemas[i].id,
                type: schemas[i].type,
                action: schemas[i].type === "toggle" ? "toggle" : "activate",
                actionZones: this.widgetEntries[i]?.handle.actionZones,
            });
        }

        if (needsRebuild) {
            this.clearWidgets();
            for (let i = 0; i < schemas.length; ++i) {
                const schema = schemas[i];
                const renderer = resolveModernWidgetRenderer(schema.type);
                if (!renderer) {
                    continue;
                }
                const context = this.createWidgetContext(schema, layouts[i]);
                const handle = renderer.createView(context);
                this.addWidgetHandle(handle);
                this.widgetEntries.push({
                    schema,
                    renderer,
                    handle,
                    layout: layouts[i],
                });
                this.widgetValueSnapshot.set(schema.id, schema.value);
            }
            this.lastWidgetSignature = nextSignature;
        } else {
            for (let i = 0; i < schemas.length; ++i) {
                const entry = this.widgetEntries[i];
                if (!entry) {
                    continue;
                }
                const nextSchema = schemas[i];
                const nextLayout = layouts[i];
                const shouldPatch =
                    (changeMask &
                        (ModernNodeChangeMask.Layout |
                            ModernNodeChangeMask.Style)) !==
                        0 ||
                    entry.schema.value !== nextSchema.value ||
                    entry.schema.disabled !== nextSchema.disabled ||
                    entry.schema.label !== nextSchema.label ||
                    entry.schema.name !== nextSchema.name ||
                    entry.layout.x !== nextLayout.x ||
                    entry.layout.y !== nextLayout.y ||
                    entry.layout.width !== nextLayout.width ||
                    entry.layout.height !== nextLayout.height;
                entry.schema = nextSchema;
                entry.layout = nextLayout;
                if (shouldPatch) {
                    entry.renderer.patchView(
                        this.createWidgetContext(entry.schema, nextLayout),
                        entry.handle,
                        changeMask
                    );
                }
                this.widgetValueSnapshot.set(entry.schema.id, entry.schema.value);
            }
        }

        for (let i = 0; i < this.widgetEntries.length; ++i) {
            this.widgetEntries[i].layout.actionZones =
                this.widgetEntries[i].handle.actionZones;
        }
        this.patchShellWidgetLayout(layouts);
    }

    private syncActionParts(changeMask: ModernNodeChangeMaskValue): void {
        const visibleParts = this.currentActionPartSchemas;
        this.shell.actionPartLayer.visible = visibleParts.length > 0;

        const nextSignature = signatureOfActionParts(visibleParts);
        const needsRebuild =
            this.actionPartEntries.length !== visibleParts.length ||
            this.lastActionPartSignature !== nextSignature ||
            (changeMask & ModernNodeChangeMask.Layout) !== 0;
        const layouts = this.computeActionPartLayouts(visibleParts);

        if (needsRebuild) {
            this.clearActionParts();
            for (let i = 0; i < visibleParts.length; ++i) {
                const schema = visibleParts[i];
                const layout = layouts[i];
                const isFooterSplitPart =
                    schema.placement === "footer-left" ||
                    schema.placement === "footer-right";
                const root = new Group({
                    x: layout.x,
                    y: layout.y,
                    width: layout.width,
                    height: layout.height,
                    hittable: false,
                });
                const background = new Rect({
                    x: 0,
                    y: 0,
                    width: layout.width,
                    height: layout.height,
                    fill: isFooterSplitPart ? "#20252C" : "#172332",
                    stroke: isFooterSplitPart ? "#394454" : "#2B4663",
                    strokeWidth: isFooterSplitPart ? 1 : 1,
                    cornerRadius:
                        schema.placement === "footer-left"
                            ? 4
                            : schema.placement === "footer-right"
                              ? 4
                              : 8,
                    hittable: false,
                });
                const outline = new Rect({
                    x: 0,
                    y: 0,
                    width: Math.max(0, layout.width),
                    height: Math.max(0, layout.height),
                    cornerRadius:
                        schema.placement === "footer-left"
                            ? 4
                            : schema.placement === "footer-right"
                              ? 4
                              : 8,
                    fill: "rgba(0,0,0,0)",
                    stroke: "#78AEFF",
                    strokeWidth: 1.5,
                    visible: false,
                    opacity: 0,
                    hittable: false,
                });
                const content = new Flow({
                    x: isFooterSplitPart ? 0 : 8,
                    y: 0,
                    width: Math.max(
                        1,
                        isFooterSplitPart ? layout.width : layout.width - 16
                    ),
                    height: layout.height,
                    flow: "x",
                    flowAlign: "center",
                    hittable: false,
                });
                const label = createText({
                    x: isFooterSplitPart ? 0 : undefined,
                    y: isFooterSplitPart ? -4 : undefined,
                    width: isFooterSplitPart ? layout.width : 1,
                    autoWidth: isFooterSplitPart ? 0 : 1,
                    height: layout.height,
                    textAlign: "center",
                    text: String(schema.label || schema.id),
                    fontSize: isFooterSplitPart ? 13 : 12,
                    fill: isFooterSplitPart ? "#999" : "#BBD0E6",
                });
                const glyph = isFooterSplitPart
                    ? new Path({
                          x: layout.width / 2,
                          y: layout.height / 2,
                          path: "M -5 0 L 5 0 M 0 -5 L 0 5",
                          fill: "rgba(0,0,0,0)",
                          stroke: "#B7C4D1",
                          strokeWidth: 1.75,
                          hittable: false,
                      })
                    : null;
                if (isFooterSplitPart) {
                    content.visible = false;
                    label.visible = false;
                    root.add([background, outline, glyph as Path]);
                } else {
                    content.add(label);
                    root.add([background, outline, content]);
                }
                this.shell.actionPartLayer.add(root);
                this.actionPartEntries.push({
                    schema,
                    root,
                    background,
                    outline,
                    content,
                    label,
                    glyph,
                    layout,
                });
            }
            this.lastActionPartSignature = nextSignature;
        } else {
            for (let i = 0; i < visibleParts.length; ++i) {
                const entry = this.actionPartEntries[i];
                entry.schema = visibleParts[i];
                entry.layout = layouts[i];
                entry.root.x = entry.layout.x;
                entry.root.y = entry.layout.y;
                entry.root.width = entry.layout.width;
                entry.root.height = entry.layout.height;
                entry.background.width = entry.layout.width;
                entry.background.height = entry.layout.height;
                entry.outline.width = Math.max(0, entry.layout.width);
                entry.outline.height = Math.max(0, entry.layout.height);
                const isFooterSplitPart =
                    entry.schema.placement === "footer-left" ||
                    entry.schema.placement === "footer-right";
                entry.outline.cornerRadius =
                    entry.schema.placement === "footer-left"
                        ? 4
                        : entry.schema.placement === "footer-right"
                          ? 4
                          : 8;
                entry.background.fill = isFooterSplitPart
                    ? "#20252C"
                    : "#172332";
                entry.background.stroke = isFooterSplitPart
                    ? "#394454"
                    : "#2B4663";
                entry.background.strokeWidth = 1;
                entry.content.visible = !isFooterSplitPart;
                entry.content.x = isFooterSplitPart ? 0 : 8;
                entry.content.width = Math.max(
                    1,
                    isFooterSplitPart
                        ? entry.layout.width
                        : entry.layout.width - 16
                );
                entry.content.height = entry.layout.height;
                entry.label.x = isFooterSplitPart ? 0 : 0;
                entry.label.y = isFooterSplitPart ? -4 : 0;
                entry.label.width = isFooterSplitPart ? entry.layout.width : 1;
                entry.label.autoWidth = isFooterSplitPart ? 0 : 1;
                entry.label.height = entry.layout.height;
                entry.label.fontSize = isFooterSplitPart ? 13 : 12;
                entry.label.visible = !isFooterSplitPart;
                entry.label.text = String(entry.schema.label || entry.schema.id);
                if (entry.glyph) {
                    entry.glyph.x = entry.layout.width / 2;
                    entry.glyph.y = entry.layout.height / 2;
                }
            }
        }

        this.shellLayout.actionParts = layouts;
    }

    private syncPorts(): void {
        const inputLayouts = this.buildPortLayouts("input");
        const outputLayouts = this.buildPortLayouts("output");
        this.shellLayout.inputPorts = inputLayouts;
        this.shellLayout.outputPorts = outputLayouts;
        this.syncPortLayer("input", inputLayouts);
        this.syncPortLayer("output", outputLayouts);
    }

    private mountContent(changeMask: ModernNodeChangeMaskValue): unknown {
        const lifecycleContext = this.createLifecycleContext(changeMask);
        if (typeof this.node.mountContent === "function") {
            return this.node.mountContent(lifecycleContext);
        }
        if (typeof this.node.mountView === "function") {
            return this.node.mountView(lifecycleContext);
        }
        if (typeof this.node.buildUI === "function") {
            return this.node.buildUI(this.createContextWithMask(changeMask, this.shellState));
        }
        return null;
    }

    private patchContent(changeMask: ModernNodeChangeMaskValue): void {
        const lifecycleContext = this.createLifecycleContext(changeMask);
        if (typeof this.node.patchContent === "function") {
            this.node.patchContent(lifecycleContext);
            return;
        }
        if (typeof this.node.patchView === "function") {
            this.node.patchView(lifecycleContext);
            return;
        }
        this.node.updateUI?.(this.createContextWithMask(changeMask, this.shellState));
    }

    private getContentArea(): ModernNodeRectLike | null {
        const body = this.shellLayout.body;
        if (!body) {
            return null;
        }
        const gutters = this.resolvePortGutters();
        const footerHeight = this.hasFooterActionParts() ? TITLE_HEIGHT : 0;
        return {
            x: BODY_PADDING_X + gutters.left,
            y: BODY_PADDING_Y,
            width: Math.max(
                16,
                body.width - BODY_PADDING_X * 2 - gutters.left - gutters.right
            ),
            height: Math.max(0, body.height - BODY_PADDING_Y * 2 - footerHeight),
        };
    }

    private hasFooterActionParts(): boolean {
        return Boolean(
            this.currentActionPartSchemas.some(
                (schema) =>
                    schema.placement === "footer-left" ||
                    schema.placement === "footer-right"
            )
        );
    }

    private patchShellWidgetLayout(layout: ModernNodeWidgetLayout[]): void {
        this.shellLayout.widgets = layout;
    }

    private resolveWidgetArea(): ModernNodeRectLike {
        const body = this.shellLayout.body || {
            x: 0,
            y: 0,
            width: this.shellLayout.width,
            height: BODY_MIN_HEIGHT,
        };
        const gutters = this.resolvePortGutters();
        const footerHeight = this.hasFooterActionParts() ? TITLE_HEIGHT : 0;
        return {
            x: BODY_PADDING_X + gutters.left,
            y: BODY_PADDING_Y,
            width: Math.max(
                20,
                body.width - BODY_PADDING_X * 2 - gutters.left - gutters.right
            ),
            height: Math.max(20, body.height - BODY_PADDING_Y * 2 - footerHeight),
        };
    }

    private addWidgetHandle(handle: ModernWidgetViewHandle): void {
        const root = toUI(handle.root);
        if (!root) {
            return;
        }
        root.hittable = false;
        this.shell.widgetLayer.add(root);
    }

    private computeActionPartLayouts(
        schemas: readonly ModernActionPartSchema<ModernNodeLike, ModernNodeHost>[]
    ): ModernNodeActionPartLayout[] {
        const body = this.shellLayout.body;
        if (!body) {
            return [];
        }

        const layouts: ModernNodeActionPartLayout[] = [];
        for (let i = 0; i < schemas.length; ++i) {
            const schema = schemas[i];
            let bounds: ModernNodeRectLike | null = schema.bounds
                ? cloneRect(schema.bounds)
                : null;

            if (!bounds) {
                if (schema.placement === "footer-left") {
                    bounds = {
                        x: 0,
                        y: body.height - TITLE_HEIGHT,
                        width: body.width / 2,
                        height: TITLE_HEIGHT,
                    };
                } else if (schema.placement === "footer-right") {
                    bounds = {
                        x: body.width / 2,
                        y: body.height - TITLE_HEIGHT,
                        width: body.width / 2,
                        height: TITLE_HEIGHT,
                    };
                } else if (schema.placement === "header-right") {
                    bounds = {
                        x: body.width - TITLE_HEIGHT,
                        y: -TITLE_HEIGHT,
                        width: TITLE_HEIGHT,
                        height: TITLE_HEIGHT,
                    };
                } else {
                    bounds = {
                        x: BODY_PADDING_X,
                        y: BODY_PADDING_Y,
                        width: Math.max(24, body.width - BODY_PADDING_X * 2),
                        height: 24,
                    };
                }
            }

            layouts.push({
                ...bounds,
                index: i,
                id: schema.id,
                action: schema.action || schema.id,
                cursor: schema.cursor || "pointer",
            });
        }

        return layouts;
    }

    private buildPortLayouts(kind: NodeViewPortKind): ModernNodePortVisualLayout[] {
        const slotList = kind === "input" ? this.node.inputs : this.node.outputs;
        const slots = Array.isArray(slotList) ? slotList : [];
        const isCollapsed = Boolean(this.node.flags?.collapsed);
        if (isCollapsed && this.shellState.showCollapsedSlots === false) {
            return [];
        }

        const layouts: ModernNodePortVisualLayout[] = [];
        for (let i = 0; i < slots.length; ++i) {
            const presentation = this.resolvePortPresentation(kind, i, slots[i]);
            const anchor = this.resolvePortAnchorLocal(kind, i);
            if (!anchor) {
                continue;
            }
            const radius = Math.max(
                toFiniteNumber(
                    presentation.radius,
                    this.node.getPortLayout?.(
                        kind,
                        i,
                        this.createContextWithMask(
                            ModernNodeChangeMask.Ports,
                            this.shellState
                        )
                    )?.radius
                ),
                6
            );
            const label = String(presentation.label || "");
            layouts.push({
                index: i,
                x: anchor[0] - radius,
                y: anchor[1] - radius,
                width: radius * 2,
                height: radius * 2,
                anchorX: anchor[0],
                anchorY: anchor[1],
                dir: toFiniteNumber(
                    presentation.dir,
                    kind === "input" ? PORT_DIRECTION_LEFT : PORT_DIRECTION_RIGHT
                ),
                radius,
                label,
                hiddenLabelWhenCollapsed: Boolean(
                    isCollapsed && presentation.hideLabelWhenCollapsed !== false
                ),
                shape: presentation.shape || "circle",
                colorOn: presentation.colorOn || getLiteGraphConstants().LINK_COLOR,
                colorOff: presentation.colorOff || "#6E7681",
                active: this.isPortActive(kind, i, slots[i]),
            });
        }
        return layouts;
    }

    private resolvePortPresentation(
        kind: NodeViewPortKind,
        slotIndex: number,
        slot: unknown
    ): ModernPortPresentation {
        const constants = getLiteGraphConstants();
        const slotRecord = (slot || {}) as Record<string, unknown>;
        const explicit =
            this.node.getPortPresentation?.(
                kind,
                slotIndex,
                this.createLifecycleContext(ModernNodeChangeMask.Ports)
            ) || null;
        const hasExplicitLabel = Boolean(
            explicit && Object.prototype.hasOwnProperty.call(explicit, "label")
        );

        let shape = explicit?.shape || "circle";
        if (!explicit?.shape) {
            if (
                toFiniteNumber(slotRecord.shape) === constants.BOX_SHAPE ||
                slotRecord.type === constants.EVENT ||
                slotRecord.type === constants.ACTION
            ) {
                shape = "box";
            } else if (toFiniteNumber(slotRecord.shape) === constants.ARROW_SHAPE) {
                shape = "arrow";
            } else if (toFiniteNumber(slotRecord.shape) === constants.GRID_SHAPE) {
                shape = "grid";
            }
        }

        const defaultActiveColor =
            slotRecord.type === constants.EVENT || slotRecord.type === constants.ACTION
                ? constants.EVENT_LINK_COLOR
                : constants.LINK_COLOR;

        return {
            label: String(
                hasExplicitLabel
                    ? explicit?.label ?? ""
                    : slotRecord.label ?? slotRecord.name ?? ""
            ),
            shape,
            dir: explicit?.dir,
            colorOn:
                explicit?.colorOn ||
                String(slotRecord.color_on || slotRecord.color || defaultActiveColor),
            colorOff: explicit?.colorOff || String(slotRecord.color_off || "#6E7681"),
            hideLabelWhenCollapsed: explicit?.hideLabelWhenCollapsed !== false,
            radius: explicit?.radius,
        };
    }

    private resolvePortAnchorLocal(
        kind: NodeViewPortKind,
        slotIndex: number
    ): [number, number] | null {
        const explicit = this.node.getPortLayout?.(
            kind,
            slotIndex,
            this.createContextWithMask(ModernNodeChangeMask.Ports, this.shellState)
        );
        if (explicit) {
            if (explicit.space === "world") {
                return [
                    explicit.x - toFiniteNumber(this.node.pos?.[0]),
                    explicit.y - toFiniteNumber(this.node.pos?.[1]),
                ];
            }
            return [toFiniteNumber(explicit.x), toFiniteNumber(explicit.y)];
        }
        return this.resolveDefaultPortAnchorLocal(kind, slotIndex);
    }

    private resolveDefaultPortAnchorLocal(
        kind: NodeViewPortKind,
        slotIndex: number
    ): [number, number] | null {
        const slots = kind === "input" ? this.node.inputs : this.node.outputs;
        if (!Array.isArray(slots) || slotIndex < 0 || slotIndex >= slots.length) {
            return null;
        }

        const header = this.shellLayout.header || {
            x: 0,
            y: -TITLE_HEIGHT,
            width: this.shellLayout.width,
            height: TITLE_HEIGHT,
        };
        const body = this.shellLayout.body;
        const anchorX = kind === "input" ? 0 : this.shellLayout.width;

        if (!body || Boolean(this.node.flags?.collapsed)) {
            return [anchorX, header.y + header.height / 2];
        }

        const widgetLayout =
            (slots.length === 1 || this.currentWidgetSchemas.length === slots.length) &&
            this.shellLayout.widgets?.[slotIndex];
        if (widgetLayout) {
            return [anchorX, widgetLayout.y + widgetLayout.height / 2];
        }

        const footerHeight = this.hasFooterActionParts() ? TITLE_HEIGHT : 0;
        const usableTop = body.y + BODY_PADDING_Y + 4;
        const usableHeight = Math.max(
            getLiteGraphConstants().NODE_SLOT_HEIGHT,
            body.height - BODY_PADDING_Y * 2 - footerHeight - 8
        );
        const step = usableHeight / Math.max(slots.length, 1);
        const anchorY = usableTop + step * slotIndex + step / 2;
        const minY = body.y + 12;
        const maxY = body.y + body.height - footerHeight - 12;
        return [anchorX, Math.max(minY, Math.min(maxY, anchorY))];
    }

    private isPortActive(
        kind: NodeViewPortKind,
        _slotIndex: number,
        slot: unknown
    ): boolean {
        const slotRecord = (slot || {}) as Record<string, unknown>;
        if (kind === "input") {
            return slotRecord.link != null;
        }
        return Array.isArray(slotRecord.links) && slotRecord.links.length > 0;
    }

    private syncPortLayer(
        kind: NodeViewPortKind,
        layouts: readonly ModernNodePortVisualLayout[]
    ): void {
        const layer =
            kind === "input" ? this.shell.inputPortLayer : this.shell.outputPortLayer;
        const activeKeys = new Set<string>();

        for (let i = 0; i < layouts.length; ++i) {
            const layout = layouts[i];
            const key = `${kind}:${layout.index}`;
            activeKeys.add(key);
            let entry = this.portEntries.get(key);
            const markerColor = layout.active ? layout.colorOn : layout.colorOff;
            if (!entry) {
                const root = new Group({
                    x: layout.anchorX,
                    y: layout.anchorY,
                    hittable: false,
                });
                const marker = createPortMarker(layout.shape, markerColor);
                const labelFrame = this.resolvePortLabelFrame(kind);
                const label = createText({
                    x: labelFrame.x,
                    y: layout.anchorY,
                    width: labelFrame.width,
                    textAlign: labelFrame.textAlign,
                    fontSize: 10.5,
                    fill: "#93A8BD",
                    text: layout.label,
                });
                root.add(marker);
                layer.add([root, label]);
                entry = {
                    kind,
                    slotIndex: layout.index,
                    layout,
                    root,
                    marker,
                    label,
                };
                this.portEntries.set(key, entry);
            }

            entry.layout = layout;
            entry.root.x = layout.anchorX;
            entry.root.y = layout.anchorY;
            if (!this.isSameMarkerShape(entry.marker, layout.shape)) {
                entry.marker.destroy();
                entry.marker = createPortMarker(layout.shape, markerColor);
                entry.root.add(entry.marker);
            } else {
                setShapeColor(entry.marker, markerColor);
            }

            entry.label.text = layout.label;
            entry.label.visible = !layout.hiddenLabelWhenCollapsed && Boolean(layout.label);
            const labelFrame = this.resolvePortLabelFrame(kind);
            entry.label.x = labelFrame.x;
            entry.label.y = layout.anchorY;
            entry.label.width = labelFrame.width;
            entry.label.textAlign = labelFrame.textAlign;
        }

        for (const [key, entry] of this.portEntries.entries()) {
            if (!key.startsWith(`${kind}:`) || activeKeys.has(key)) {
                continue;
            }
            entry.root.destroy();
            entry.label.destroy();
            this.portEntries.delete(key);
        }
    }

    private isSameMarkerShape(marker: UI | Group, shape: string): boolean {
        return (
            ((marker as unknown as Record<string, unknown>).__litegraphPortShape as
                | string
                | undefined) === shape
        );
    }

    private resolvePortLayout(
        kind: NodeViewPortKind,
        slotIndex: number
    ): ModernNodePortVisualLayout | null {
        const list =
            kind === "input"
                ? this.shellLayout.inputPorts || []
                : this.shellLayout.outputPorts || [];
        for (let i = 0; i < list.length; ++i) {
            if (list[i].index === slotIndex) {
                return list[i];
            }
        }
        return null;
    }

    private resolvePortLabelFrame(
        kind: NodeViewPortKind
    ): { x: number; width: number; textAlign: "left" | "right" } {
        const gutters = this.resolvePortGutters();
        if (kind === "input") {
            return {
                x: PORT_LABEL_PADDING,
                width: Math.max(28, gutters.left - PORT_LABEL_PADDING - 4),
                textAlign: "left",
            };
        }

        return {
            x: Math.max(
                PORT_LABEL_PADDING,
                this.shellLayout.width - gutters.right + 4
            ),
            width: Math.max(28, gutters.right - PORT_LABEL_PADDING - 8),
            textAlign: "right",
        };
    }

    private storeInspectableState(): void {
        (this.root as unknown as Record<string, unknown>)[MODERN_NODE_STATE_KEY] = {
            layout: this.shellLayout,
            shellState: this.shellState,
        } satisfies StoredModernNodeState;
    }

    private applyInteractionState(): void {
        const shellState = this.shellState;
        const headerHoverEnabled = Boolean(shellState.allowNodeHover);
        const headerState = headerHoverEnabled
            ? partStateFor(this.interactionState, "header")
            : "";
        const bodyState = headerHoverEnabled
            ? partStateFor(this.interactionState, "body")
            : "";
        const collapseState = partStateFor(this.interactionState, "collapse");
        const resizeState = partStateFor(this.interactionState, "resize");

        this.root.selected = Boolean(this.node.is_selected);
        this.shell.selectionOutline.visible = Boolean(this.node.is_selected);

        this.shell.header.stroke =
            headerState === "press"
                ? "#76A8FF"
                : headerState === "hover"
                  ? "#4E6D94"
                  : shellState.borderColor || "#243342";
        if (this.shellLayout.body) {
            this.shell.body.stroke =
                bodyState === "press"
                    ? "#76A8FF"
                    : bodyState === "hover"
                      ? "#4E6D94"
                      : shellState.borderColor || "#243342";
        }

        this.shell.collapseOverlay.fill =
            collapseState === "press"
                ? "rgba(255,255,255,0.16)"
                : collapseState === "hover"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0)";
        this.shell.resizeHandleGlyph.stroke =
            resizeState === "press"
                ? "#76A8FF"
                : resizeState === "hover"
                  ? "#C7D5E0"
                  : "#8593A0";

        this.applyWidgetInteractionState();
        this.applyActionPartInteractionState();
        this.applyPortInteractionState();
    }

    private clearWidgets(): void {
        for (let i = 0; i < this.widgetEntries.length; ++i) {
            const handle = this.widgetEntries[i].handle;
            if (handle.destroy) {
                handle.destroy();
            } else {
                toUI(handle.root)?.destroy();
            }
        }
        this.widgetEntries = [];
        this.widgetValueSnapshot.clear();
    }

    private clearActionParts(): void {
        for (let i = 0; i < this.actionPartEntries.length; ++i) {
            this.actionPartEntries[i].root.destroy();
        }
        this.actionPartEntries = [];
    }

    private createLifecycleContext(
        changeMask: ModernNodeChangeMaskValue
    ): ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost> {
        return {
            node: this.node,
            host: this,
            root: this.root,
            content: this.content,
            changeMask,
            interactionState: this.interactionState,
            leafer,
            shellState: this.shellState,
        };
    }

    private createContextWithMask(
        changeMask: ModernNodeChangeMaskValue,
        shellState: ModernShellState
    ): ModernNodeBuildContext {
        return {
            node: this.node,
            host: this,
            root: this.root,
            content: this.content,
            changeMask,
            interactionState: this.interactionState,
            shellState,
            leafer,
        };
    }

    private createWidgetContext(
        schema: ModernWidgetSchema,
        bounds: ModernNodeRectLike
    ): ModernWidgetRenderContext<ModernNodeLike, ModernNodeHost> {
        return {
            node: this.node,
            host: this,
            schema,
            bounds,
            leafer,
        };
    }

    private applyWidgetInteractionState(): void {
        const hoveredPart =
            this.interactionState.hoveredPart?.kind === "widget"
                ? this.interactionState.hoveredPart
                : null;
        const pressedPart =
            this.interactionState.pressedPart?.kind === "widget"
                ? this.interactionState.pressedPart
                : null;
        const hoveredIndex = hoveredPart?.index ?? null;
        const pressedIndex = pressedPart?.index ?? null;

        for (let i = 0; i < this.widgetEntries.length; ++i) {
            const entry = this.widgetEntries[i];
            const widgetRoot = entry.handle.root as Record<string, unknown>;
            if (!widgetRoot || typeof widgetRoot !== "object") {
                continue;
            }
            const outline = toUI(
                (entry.handle as { outline?: unknown }).outline
            ) as Rect | null;
            widgetRoot.disabled = Boolean(entry.schema.disabled);
            if (entry.schema.disabled) {
                widgetRoot.state = "";
                if (outline) {
                    outline.visible = false;
                    outline.opacity = 0;
                }
                continue;
            }
            if (pressedIndex === i) {
                widgetRoot.state = "press";
            } else if (hoveredIndex === i) {
                widgetRoot.state = "hover";
            } else {
                widgetRoot.state = "";
            }

            if (!outline) {
                continue;
            }

            const activePart =
                pressedIndex === i
                    ? pressedPart
                    : hoveredIndex === i
                      ? hoveredPart
                      : null;
            if (!activePart) {
                outline.visible = false;
                outline.opacity = 0;
                continue;
            }

            const actionZone =
                activePart.action && entry.handle.actionZones
                    ? entry.handle.actionZones[activePart.action]
                    : null;
            const frame = actionZone || {
                x: 0,
                y: 0,
                width: entry.handle.bounds.width,
                height: entry.handle.bounds.height,
            };
            outline.x = frame.x;
            outline.y = frame.y;
            outline.width = Math.max(0, frame.width);
            outline.height = Math.max(0, frame.height);
            outline.cornerRadius = actionZone ? 8 : 10;
            outline.stroke = pressedIndex === i ? "#A4CAFF" : "#7EB2FF";
            outline.strokeWidth = pressedIndex === i ? 2 : 1.5;
            outline.visible = true;
            outline.opacity = pressedIndex === i ? 1 : 0.95;
        }
    }

    private applyActionPartInteractionState(): void {
        for (let i = 0; i < this.actionPartEntries.length; ++i) {
            const entry = this.actionPartEntries[i];
            const state = partStateFor(
                this.interactionState,
                "action-part",
                i,
                entry.schema.id
            );
            const isFooterSplitPart =
                entry.schema.placement === "footer-left" ||
                entry.schema.placement === "footer-right";
            if (isFooterSplitPart) {
                entry.background.fill =
                    state === "press"
                        ? "#2D3A48"
                        : state === "hover"
                          ? "#283442"
                          : "#20252C";
                entry.background.stroke =
                    state === "press"
                        ? "#7EB2FF"
                        : state === "hover"
                          ? "#5D7898"
                          : "#394454";
                entry.outline.visible = state === "press" || state === "hover";
                entry.outline.opacity =
                    state === "press" ? 1 : state === "hover" ? 0.9 : 0;
                entry.outline.stroke =
                    state === "press" ? "#A4CAFF" : "#7EB2FF";
                entry.outline.strokeWidth = state === "press" ? 2 : 1.5;
                if (entry.glyph) {
                    entry.glyph.stroke =
                        state === "press"
                            ? "#F3F8FF"
                            : state === "hover"
                              ? "#DCEBFB"
                              : "#B7C4D1";
                }
                continue;
            }
            entry.background.fill =
                state === "press"
                    ? "#1B3657"
                    : state === "hover"
                      ? "#21364E"
                      : "#172332";
            entry.background.stroke =
                state === "press"
                    ? "#76A8FF"
                    : state === "hover"
                      ? "#5A7FA8"
                      : "#2B4663";
            entry.outline.visible = state === "press" || state === "hover";
            entry.outline.opacity =
                state === "press" ? 1 : state === "hover" ? 0.95 : 0;
            entry.outline.stroke =
                state === "press" ? "#A4CAFF" : "#7EB2FF";
            entry.outline.strokeWidth = state === "press" ? 2 : 1.5;
            entry.label.fill =
                state === "press"
                    ? "#F3F8FF"
                    : state === "hover"
                      ? "#D6E8FA"
                      : "#BBD0E6";
        }
    }

    private applyPortInteractionState(): void {
        for (const entry of this.portEntries.values()) {
            const partKind: ModernNodePartKind =
                entry.kind === "input" ? "input-port" : "output-port";
            const state = partStateFor(
                this.interactionState,
                partKind,
                entry.slotIndex
            );
            const baseColor = entry.layout.active
                ? entry.layout.colorOn
                : entry.layout.colorOff;
            const color =
                state === "press"
                    ? "#FFFFFF"
                    : state === "hover"
                      ? "#B9D7FF"
                      : baseColor;
            setShapeColor(entry.marker, color);
        }
    }

    private hitWidgetPart(
        point: readonly [number, number],
        widgets?: ModernNodeWidgetLayout[] | null
    ): ModernNodePartHit | null {
        if (!widgets?.length) {
            return null;
        }

        for (let i = 0; i < widgets.length; ++i) {
            const widget = widgets[i];
            const entry = this.widgetEntries[i];
            if (entry) {
                const rendererHit = entry.renderer.hitTest?.(
                    this.createWidgetContext(entry.schema, entry.handle.bounds),
                    entry.handle,
                    point
                );
                if (rendererHit) {
                    return {
                        kind: "widget",
                        index: widget.index,
                        action: rendererHit.action || widget.action || "activate",
                        cursor: rendererHit.cursor || "pointer",
                        bounds:
                            (rendererHit.bounds as ModernNodeRectLike | null | undefined) ||
                            widget,
                    };
                }
            }

            if (widget.actionZones) {
                for (const [action, rect] of Object.entries(widget.actionZones)) {
                    const absoluteRect = offsetRect(rect, widget.x, widget.y);
                    if (pointInsideRect(point, absoluteRect)) {
                        return {
                            kind: "widget",
                            index: widget.index,
                            action,
                            cursor: "pointer",
                            bounds: absoluteRect,
                        };
                    }
                }
            }

            if (pointInsideRect(point, widget)) {
                return {
                    kind: "widget",
                    index: widget.index,
                    action: widget.action || "activate",
                    cursor: "pointer",
                    bounds: widget,
                };
            }
        }

        return null;
    }

    private hitActionPart(
        point: readonly [number, number],
        actionParts?: ModernNodeActionPartLayout[] | null
    ): ModernNodePartHit | null {
        if (!actionParts?.length) {
            return null;
        }

        for (let i = 0; i < actionParts.length; ++i) {
            const part = actionParts[i];
            if (pointInsideRect(point, part)) {
                return {
                    kind: "action-part",
                    index: part.index,
                    id: part.id,
                    action: part.action,
                    cursor: part.cursor || "pointer",
                    bounds: part,
                };
            }
        }

        return null;
    }

    private hitPortPart(
        point: readonly [number, number],
        kind: "input-port" | "output-port",
        ports?: ModernNodePortVisualLayout[] | null
    ): ModernNodePartHit | null {
        if (!ports?.length) {
            return null;
        }

        for (let i = 0; i < ports.length; ++i) {
            const port = ports[i];
            if (pointInsideRect(point, port)) {
                return {
                    kind,
                    index: port.index,
                    cursor: "crosshair",
                    bounds: port,
                };
            }
        }

        return null;
    }
}
