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
import {
    measureLeaferTextWidth,
    MODERN_NODE_TITLE_MEASURE_FONT,
} from "./LeaferTextMetrics";
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

interface ModernPortPresentationCacheEntry {
    version: number;
    presentation: ModernPortPresentation;
}

interface ModernPortGeometryCacheEntry {
    version: number;
    anchor: [number, number] | null;
    radius: number;
    labelWidth: number;
    gutter: number;
}

interface ModernPortGutterCacheEntry {
    version: number;
    left: number;
    right: number;
}

interface ModernShellTextMetricsCacheEntry {
    key: string;
    titleText: string;
    titleWidth: number;
    headerMeta: string;
    headerMetaWidth: number;
    summaryText: string;
}

interface ModernContentAreaCacheEntry {
    key: string;
    area: ModernNodeRectLike | null;
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
const HEADER_META_MEASURE_FONT =
    '500 10px "Aptos", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
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

function measureTextWidth(
    text: string,
    font = MODERN_NODE_TITLE_MEASURE_FONT
): number {
    return measureLeaferTextWidth(text, font);
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

function signatureOfActionPartLayouts<
    TNode extends { id: number | string },
    THost,
>(
    schemas: readonly ModernActionPartSchema<TNode, THost>[]
): string {
    return schemas
        .map((schema) => {
            const bounds = schema.bounds
                ? `${schema.bounds.x},${schema.bounds.y},${schema.bounds.width},${schema.bounds.height}`
                : "";
            return `${schema.id}:${schema.placement || ""}:${bounds}`;
        })
        .join("|");
}

function signatureOfShellGeometry(shellState: ModernShellState): string {
    return [
        shellState.title || "",
        shellState.titleMode || "default",
        shellState.collapsedWidth ?? "",
        shellState.headerMetaText || "",
        shellState.minimumWidth ?? "",
        shellState.minimumHeight ?? "",
        shellState.summaryText || "",
        shellState.collapsible !== false ? 1 : 0,
        shellState.resizable !== false ? 1 : 0,
        shellState.showCollapsedSlots !== false ? 1 : 0,
    ].join("|");
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
        if (shapeData.fill !== color) {
            shapeData.fill = color;
        }
    }
    if ((shape as Group).children) {
        const children = (((shape as Group).children || []) as unknown) as Array<
            Record<string, unknown>
        >;
        for (let i = 0; i < children.length; ++i) {
            if ("fill" in children[i] && children[i].fill !== color) {
                children[i].fill = color;
            }
        }
    }
}

function isSameAttrValue(current: unknown, next: unknown): boolean {
    if (Array.isArray(current) && Array.isArray(next)) {
        if (current.length !== next.length) {
            return false;
        }
        for (let i = 0; i < current.length; ++i) {
            if (current[i] !== next[i]) {
                return false;
            }
        }
        return true;
    }
    return current === next;
}

function setAttrIfChanged(
    target: Record<string, unknown>,
    key: string,
    value: unknown
): void {
    if (!isSameAttrValue(target[key], value)) {
        target[key] = value;
    }
}

function setRectIfChanged(
    target: Record<string, unknown>,
    rect: ModernNodeRectLike
): void {
    setAttrIfChanged(target, "x", rect.x);
    setAttrIfChanged(target, "y", rect.y);
    setAttrIfChanged(target, "width", rect.width);
    setAttrIfChanged(target, "height", rect.height);
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
    private portPresentationCache = new Map<
        string,
        ModernPortPresentationCacheEntry
    >();
    private portGeometryCache = new Map<string, ModernPortGeometryCacheEntry>();
    private portGutterCache: ModernPortGutterCacheEntry | null = null;
    private shellTextMetricsCache: ModernShellTextMetricsCacheEntry | null = null;
    private contentAreaCache: ModernContentAreaCacheEntry | null = null;
    private widgetValueSnapshot = new Map<string, unknown>();
    private currentWidgetSchemas: ReadonlyArray<ModernWidgetSchema> = [];
    private currentActionPartSchemas: ReadonlyArray<
        ModernActionPartSchema<ModernNodeLike, ModernNodeHost>
    > = [];
    private lastWidgetSignature = "";
    private lastActionPartSignature = "";
    private lastActionPartLayoutSignature = "";
    private portPresentationCacheVersion = 1;
    private portGeometryCacheVersion = 1;
    private portLifecycleContext:
        | ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>
        | null = null;
    private portBuildContext: ModernNodeBuildContext | null = null;
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
        const previousShellState = this.shellState;
        this.shellState = this.resolveShellState(changeMask);
        this.currentWidgetSchemas = this.collectWidgetSchemas();
        this.currentActionPartSchemas = this.collectActionPartSchemas(changeMask);
        const nextWidgetSignature = signatureOfWidgets(this.currentWidgetSchemas);
        const nextActionPartSignature = signatureOfActionParts(
            this.currentActionPartSchemas
        );
        const nextActionPartLayoutSignature = signatureOfActionPartLayouts(
            this.currentActionPartSchemas
        );
        const shellGeometryChanged =
            signatureOfShellGeometry(previousShellState) !==
            signatureOfShellGeometry(this.shellState);
        const needsGeometryPass =
            !this.mounted ||
            (changeMask &
                (ModernNodeChangeMask.Layout | ModernNodeChangeMask.Ports)) !==
                0 ||
            shellGeometryChanged ||
            this.lastWidgetSignature !== nextWidgetSignature ||
            this.lastActionPartLayoutSignature !== nextActionPartLayoutSignature;
        this.refreshPortCacheVersions(changeMask, needsGeometryPass);
        if (needsGeometryPass) {
            this.ensureMinimumNodeSize(this.shellState);
            this.shellLayout = this.computeShellLayout(this.shellState);
        }

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

        this.syncWidgets(changeMask, nextWidgetSignature, needsGeometryPass);
        this.syncActionParts(
            changeMask,
            nextActionPartSignature,
            nextActionPartLayoutSignature,
            needsGeometryPass
        );
        const needsPortSync =
            needsGeometryPass ||
            (changeMask &
                (ModernNodeChangeMask.Ports |
                    ModernNodeChangeMask.Data |
                    ModernNodeChangeMask.Style)) !==
                0;
        if (needsPortSync) {
            this.syncPorts();
        }
        this.applyShellLayout();
        if (needsGeometryPass) {
            this.syncContentLayout();
        }
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
        const rootRecord = this.root as unknown as Record<string, unknown>;
        setAttrIfChanged(rootRecord, "x", toFiniteNumber(this.node.pos?.[0]));
        setAttrIfChanged(rootRecord, "y", toFiniteNumber(this.node.pos?.[1]));
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
        const textMetrics = this.resolveShellTextMetrics(shellState);
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
                      Math.max(56, textMetrics.titleWidth + titleHeight * 1.8)
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
        const textMetrics = this.resolveShellTextMetrics(shellState);
        const headerRect = this.shell.header as unknown as Record<string, unknown>;
        const bodyRect = this.shell.body as unknown as Record<string, unknown>;
        const headerContent = this.shell.headerContent as unknown as Record<
            string,
            unknown
        >;
        const titleText = this.shell.title as unknown as Record<string, unknown>;
        const headerMetaText = this.shell.headerMeta as unknown as Record<
            string,
            unknown
        >;
        const summaryText = this.shell.summary as unknown as Record<string, unknown>;
        const signalLamp = this.shell.signalLamp as unknown as Record<string, unknown>;
        const collapseOverlay = this.shell.collapseOverlay as unknown as Record<
            string,
            unknown
        >;
        const resizeHandle = this.shell.resizeHandle as unknown as Record<
            string,
            unknown
        >;
        const selectionOutline = this.shell.selectionOutline as unknown as Record<
            string,
            unknown
        >;
        const header = layout.header || {
            x: 0,
            y: -TITLE_HEIGHT,
            width: layout.width,
            height: TITLE_HEIGHT,
        };
        const body = layout.body;
        const totalHeight = header.height + (body?.height || 0);
        const contentArea = this.getContentArea();

        setRectIfChanged(headerRect, header);
        setAttrIfChanged(headerRect, "fill", shellState.titleColor || "#283444");
        setAttrIfChanged(headerRect, "stroke", shellState.borderColor || "#314254");
        setAttrIfChanged(
            headerRect,
            "cornerRadius",
            body ? [12, 12, 0, 0] : [12, 12, 12, 12]
        );

        setAttrIfChanged(bodyRect, "visible", Boolean(body));
        if (body) {
            setRectIfChanged(bodyRect, body);
            setAttrIfChanged(bodyRect, "fill", shellState.bodyColor || "#101720");
            setAttrIfChanged(bodyRect, "stroke", shellState.borderColor || "#314254");
            setAttrIfChanged(bodyRect, "cornerRadius", [0, 0, 12, 12]);
        }

        const headerMeta = textMetrics.headerMeta;
        const headerMetaWidth = textMetrics.headerMetaWidth;
        const titleStartX = this.resolveTitleStartX(Boolean(layout.collapse), header.height);
        const showHeaderMeta =
            Boolean(headerMeta) &&
            !Boolean(this.node.flags?.collapsed) &&
            header.width - titleStartX - headerMetaWidth - HEADER_META_GAP - 12 >= 56;
        const titleEndPadding = showHeaderMeta
            ? headerMetaWidth + HEADER_META_GAP + 12
            : 14;
        const titleWidth = Math.max(24, header.width - titleStartX - titleEndPadding);

        setAttrIfChanged(headerContent, "x", titleStartX);
        setAttrIfChanged(headerContent, "y", header.y);
        setAttrIfChanged(
            headerContent,
            "width",
            Math.max(24, header.width - titleStartX - 12)
        );
        setAttrIfChanged(headerContent, "height", header.height);
        setAttrIfChanged(
            headerContent,
            "visible",
            shellState.titleMode !== "hidden" || showHeaderMeta
        );

        setAttrIfChanged(titleText, "text", textMetrics.titleText);
        setAttrIfChanged(titleText, "fill", shellState.titleTextColor || "#F5F7FA");
        setAttrIfChanged(titleText, "height", header.height);
        setAttrIfChanged(titleText, "width", titleWidth);
        setAttrIfChanged(
            titleText,
            "visible",
            shellState.titleMode !== "hidden"
        );

        setAttrIfChanged(headerMetaText, "text", headerMeta);
        setAttrIfChanged(headerMetaText, "visible", showHeaderMeta);
        setAttrIfChanged(
            headerMetaText,
            "width",
            Math.max(HEADER_META_MIN_WIDTH, headerMetaWidth)
        );
        setAttrIfChanged(headerMetaText, "height", header.height);

        setAttrIfChanged(summaryText, "text", textMetrics.summaryText);
        setAttrIfChanged(
            summaryText,
            "visible",
            Boolean(
                body &&
                    !this.widgetEntries.length &&
                    !this.content &&
                    shellState.summaryText
            )
        );
        setAttrIfChanged(summaryText, "x", contentArea?.x || BODY_PADDING_X);
        setAttrIfChanged(
            summaryText,
            "y",
            (contentArea?.y || BODY_PADDING_Y) +
                Math.min(20, Math.max(14, (contentArea?.height || 24) * 0.45))
        );
        setAttrIfChanged(
            summaryText,
            "width",
            Math.max(20, contentArea?.width || layout.width - BODY_PADDING_X * 2)
        );

        setAttrIfChanged(
            signalLamp,
            "visible",
            shellState.showSignalLamp !== false
        );
        setAttrIfChanged(signalLamp, "x", 10);
        setAttrIfChanged(
            signalLamp,
            "y",
            header.y + (header.height - HEADER_SIGNAL_SIZE) / 2
        );
        setAttrIfChanged(signalLamp, "fill", shellState.boxColor || "#666666");

        setAttrIfChanged(collapseOverlay, "visible", Boolean(layout.collapse));
        if (layout.collapse) {
            setRectIfChanged(collapseOverlay, layout.collapse);
        }

        setAttrIfChanged(resizeHandle, "visible", Boolean(layout.resize));
        if (layout.resize) {
            setAttrIfChanged(resizeHandle, "x", layout.resize.x);
            setAttrIfChanged(resizeHandle, "y", layout.resize.y);
        }

        setAttrIfChanged(selectionOutline, "x", -OUTLINE_PADDING);
        setAttrIfChanged(selectionOutline, "y", header.y - OUTLINE_PADDING);
        setAttrIfChanged(
            selectionOutline,
            "width",
            layout.width + OUTLINE_PADDING * 2
        );
        setAttrIfChanged(
            selectionOutline,
            "height",
            totalHeight + OUTLINE_PADDING * 2
        );
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
        const textMetrics = this.resolveShellTextMetrics(shellState);
        const contentWidth = this.resolveMinimumContentWidth();

        return Math.max(
            BODY_MIN_WIDTH,
            toFiniteNumber(shellState.minimumWidth, BODY_MIN_WIDTH),
            BODY_PADDING_X * 2 + gutters.left + gutters.right + contentWidth,
            this.resolveTitleStartX(Boolean(shellState.collapsible), headerHeight) +
                textMetrics.titleWidth +
                (textMetrics.headerMetaWidth
                    ? HEADER_META_GAP + textMetrics.headerMetaWidth + 12
                    : 14)
        );
    }

    private resolveShellTextMetrics(
        shellState: ModernShellState
    ): ModernShellTextMetricsCacheEntry {
        const titleText = String(shellState.title || "");
        const headerMeta = this.resolveHeaderMetaText(shellState);
        const summaryText = String(shellState.summaryText || "");
        const cacheKey = `${titleText}\u0000${headerMeta}\u0000${summaryText}`;
        const cached = this.shellTextMetricsCache;
        if (cached?.key === cacheKey) {
            return cached;
        }

        const resolved: ModernShellTextMetricsCacheEntry = {
            key: cacheKey,
            titleText,
            titleWidth: measureTextWidth(titleText, MODERN_NODE_TITLE_MEASURE_FONT),
            headerMeta,
            headerMetaWidth: headerMeta
                ? Math.max(
                      HEADER_META_MIN_WIDTH,
                      measureTextWidth(headerMeta, HEADER_META_MEASURE_FONT) + 8
                  )
                : 0,
            summaryText,
        };
        this.shellTextMetricsCache = resolved;
        return resolved;
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
        if (this.portGutterCache?.version === this.portGeometryCacheVersion) {
            return {
                left: this.portGutterCache.left,
                right: this.portGutterCache.right,
            };
        }

        const gutters = {
            left: this.measurePortGutter("input"),
            right: this.measurePortGutter("output"),
        };
        this.portGutterCache = {
            version: this.portGeometryCacheVersion,
            ...gutters,
        };
        return {
            left: gutters.left,
            right: gutters.right,
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
            const geometry = this.resolvePortGeometry(
                kind,
                i,
                slots[i],
                presentation
            );
            maxWidth = Math.max(maxWidth, geometry?.gutter || PORT_GUTTER_MIN);
        }

        if (!maxWidth) {
            return PORT_GUTTER_MIN;
        }
        return Math.max(PORT_GUTTER_MIN, maxWidth);
    }

    private syncContentLayout(): void {
        const contentArea = this.getContentArea();
        const contentLayerRecord = this.shell.contentLayer as unknown as Record<
            string,
            unknown
        >;
        setAttrIfChanged(contentLayerRecord, "visible", Boolean(contentArea));
        if (!this.content || !contentArea) {
            return;
        }

        const contentRecord = this.content as unknown as Record<string, unknown>;
        setAttrIfChanged(contentRecord, "x", contentArea.x);
        setAttrIfChanged(contentRecord, "y", contentArea.y);
        if ("width" in contentRecord) {
            setAttrIfChanged(contentRecord, "width", contentArea.width);
        }
        if ("height" in contentRecord) {
            setAttrIfChanged(contentRecord, "height", contentArea.height);
        }
    }

    private syncWidgets(
        changeMask: ModernNodeChangeMaskValue,
        nextSignature: string,
        needsLayoutPass: boolean
    ): void {
        const schemas = this.currentWidgetSchemas;
        const widgetLayerRecord = this.shell.widgetLayer as unknown as Record<
            string,
            unknown
        >;
        setAttrIfChanged(widgetLayerRecord, "visible", schemas.length > 0);
        const needsRebuild =
            this.widgetEntries.length !== schemas.length ||
            this.lastWidgetSignature !== nextSignature;

        if (!schemas.length) {
            this.clearWidgets();
            this.patchShellWidgetLayout([]);
            this.lastWidgetSignature = "";
            return;
        }

        const shouldRecomputeLayout =
            needsLayoutPass ||
            needsRebuild ||
            !Array.isArray(this.shellLayout.widgets) ||
            this.shellLayout.widgets.length !== schemas.length;
        const layouts = shouldRecomputeLayout
            ? this.computeWidgetLayouts(schemas)
            : this.reuseWidgetLayouts(schemas);
        const widgetChangeMask = shouldRecomputeLayout
            ? changeMask | ModernNodeChangeMask.Layout
            : changeMask;

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
                    (widgetChangeMask &
                        (ModernNodeChangeMask.Layout |
                            ModernNodeChangeMask.Style)) !==
                        0 ||
                    entry.schema.value !== nextSchema.value ||
                    entry.schema.disabled !== nextSchema.disabled ||
                    entry.schema.readonly !== nextSchema.readonly ||
                    entry.schema.label !== nextSchema.label ||
                    entry.schema.name !== nextSchema.name ||
                    entry.schema.property !== nextSchema.property ||
                    entry.schema.options !== nextSchema.options ||
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
                        widgetChangeMask
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
        this.lastWidgetSignature = nextSignature;
    }

    private syncActionParts(
        _changeMask: ModernNodeChangeMaskValue,
        nextSignature: string,
        nextLayoutSignature: string,
        needsLayoutPass: boolean
    ): void {
        const visibleParts = this.currentActionPartSchemas;
        const actionPartLayerRecord = this.shell.actionPartLayer as unknown as Record<
            string,
            unknown
        >;
        setAttrIfChanged(
            actionPartLayerRecord,
            "visible",
            visibleParts.length > 0
        );

        const needsRebuild =
            this.actionPartEntries.length !== visibleParts.length ||
            this.lastActionPartSignature !== nextSignature;
        const shouldRecomputeLayout =
            needsLayoutPass ||
            needsRebuild ||
            this.lastActionPartLayoutSignature !== nextLayoutSignature ||
            !Array.isArray(this.shellLayout.actionParts) ||
            this.shellLayout.actionParts.length !== visibleParts.length;
        const layouts = shouldRecomputeLayout
            ? this.computeActionPartLayouts(visibleParts)
            : this.reuseActionPartLayouts(visibleParts);

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
                const rootRecord = entry.root as unknown as Record<string, unknown>;
                const backgroundRecord = entry.background as unknown as Record<
                    string,
                    unknown
                >;
                const outlineRecord = entry.outline as unknown as Record<
                    string,
                    unknown
                >;
                const contentRecord = entry.content as unknown as Record<
                    string,
                    unknown
                >;
                const labelRecord = entry.label as unknown as Record<
                    string,
                    unknown
                >;
                setRectIfChanged(rootRecord, entry.layout);
                setAttrIfChanged(backgroundRecord, "width", entry.layout.width);
                setAttrIfChanged(backgroundRecord, "height", entry.layout.height);
                setAttrIfChanged(
                    outlineRecord,
                    "width",
                    Math.max(0, entry.layout.width)
                );
                setAttrIfChanged(
                    outlineRecord,
                    "height",
                    Math.max(0, entry.layout.height)
                );
                const isFooterSplitPart =
                    entry.schema.placement === "footer-left" ||
                    entry.schema.placement === "footer-right";
                setAttrIfChanged(
                    outlineRecord,
                    "cornerRadius",
                    entry.schema.placement === "footer-left"
                        ? 4
                        : entry.schema.placement === "footer-right"
                          ? 4
                          : 8
                );
                setAttrIfChanged(
                    backgroundRecord,
                    "fill",
                    isFooterSplitPart
                    ? "#20252C"
                    : "#172332"
                );
                setAttrIfChanged(
                    backgroundRecord,
                    "stroke",
                    isFooterSplitPart
                    ? "#394454"
                    : "#2B4663"
                );
                setAttrIfChanged(backgroundRecord, "strokeWidth", 1);
                setAttrIfChanged(contentRecord, "visible", !isFooterSplitPart);
                setAttrIfChanged(contentRecord, "x", isFooterSplitPart ? 0 : 8);
                setAttrIfChanged(
                    contentRecord,
                    "width",
                    Math.max(
                        1,
                        isFooterSplitPart
                        ? entry.layout.width
                        : entry.layout.width - 16
                    )
                );
                setAttrIfChanged(contentRecord, "height", entry.layout.height);
                setAttrIfChanged(labelRecord, "x", 0);
                setAttrIfChanged(labelRecord, "y", isFooterSplitPart ? -4 : 0);
                setAttrIfChanged(
                    labelRecord,
                    "width",
                    isFooterSplitPart ? entry.layout.width : 1
                );
                setAttrIfChanged(
                    labelRecord,
                    "autoWidth",
                    isFooterSplitPart ? 0 : 1
                );
                setAttrIfChanged(labelRecord, "height", entry.layout.height);
                setAttrIfChanged(
                    labelRecord,
                    "fontSize",
                    isFooterSplitPart ? 13 : 12
                );
                setAttrIfChanged(labelRecord, "visible", !isFooterSplitPart);
                setAttrIfChanged(
                    labelRecord,
                    "text",
                    String(entry.schema.label || entry.schema.id)
                );
                if (entry.glyph) {
                    const glyphRecord = entry.glyph as unknown as Record<
                        string,
                        unknown
                    >;
                    setAttrIfChanged(glyphRecord, "x", entry.layout.width / 2);
                    setAttrIfChanged(glyphRecord, "y", entry.layout.height / 2);
                }
            }
        }

        this.shellLayout.actionParts = layouts;
        this.lastActionPartSignature = nextSignature;
        this.lastActionPartLayoutSignature = nextLayoutSignature;
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
            const cacheKey = "collapsed";
            if (this.contentAreaCache?.key !== cacheKey) {
                this.contentAreaCache = { key: cacheKey, area: null };
            }
            return null;
        }
        const gutters = this.resolvePortGutters();
        const footerHeight = this.hasFooterActionParts() ? TITLE_HEIGHT : 0;
        const cacheKey = [
            body.x,
            body.y,
            body.width,
            body.height,
            gutters.left,
            gutters.right,
            footerHeight,
        ].join(",");
        const cached = this.contentAreaCache;
        if (cached?.key === cacheKey) {
            return cached.area;
        }

        const area = {
            x: BODY_PADDING_X + gutters.left,
            y: BODY_PADDING_Y,
            width: Math.max(
                16,
                body.width - BODY_PADDING_X * 2 - gutters.left - gutters.right
            ),
            height: Math.max(0, body.height - BODY_PADDING_Y * 2 - footerHeight),
        };
        this.contentAreaCache = { key: cacheKey, area };
        return area;
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

    private computeWidgetLayouts(
        schemas: ReadonlyArray<ModernWidgetSchema>
    ): ModernNodeWidgetLayout[] {
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
        return layouts;
    }

    private reuseWidgetLayouts(
        schemas: ReadonlyArray<ModernWidgetSchema>
    ): ModernNodeWidgetLayout[] {
        const previousLayouts = this.shellLayout.widgets || [];
        if (previousLayouts.length !== schemas.length) {
            return this.computeWidgetLayouts(schemas);
        }

        return schemas.map((schema, index) => {
            const layout = previousLayouts[index];
            if (!layout) {
                return this.computeWidgetLayouts(schemas)[index];
            }
            return {
                ...layout,
                index,
                id: schema.id,
                type: schema.type,
                action: schema.type === "toggle" ? "toggle" : "activate",
                actionZones: this.widgetEntries[index]?.handle.actionZones,
            };
        });
    }

    private reuseActionPartLayouts(
        schemas: readonly ModernActionPartSchema<ModernNodeLike, ModernNodeHost>[]
    ): ModernNodeActionPartLayout[] {
        const previousLayouts = this.shellLayout.actionParts || [];
        if (previousLayouts.length !== schemas.length) {
            return this.computeActionPartLayouts(schemas);
        }

        return schemas.map((schema, index) => {
            const layout = previousLayouts[index];
            if (!layout) {
                return this.computeActionPartLayouts(schemas)[index];
            }
            return {
                ...layout,
                index,
                id: schema.id,
                action: schema.action || schema.id,
                cursor: schema.cursor || "pointer",
            };
        });
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
            const geometry = this.resolvePortGeometry(
                kind,
                i,
                slots[i],
                presentation
            );
            if (!geometry?.anchor) {
                continue;
            }
            const label = String(presentation.label || "");
            layouts.push({
                index: i,
                x: geometry.anchor[0] - geometry.radius,
                y: geometry.anchor[1] - geometry.radius,
                width: geometry.radius * 2,
                height: geometry.radius * 2,
                anchorX: geometry.anchor[0],
                anchorY: geometry.anchor[1],
                dir: toFiniteNumber(
                    presentation.dir,
                    kind === "input" ? PORT_DIRECTION_LEFT : PORT_DIRECTION_RIGHT
                ),
                radius: geometry.radius,
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
        const cacheKey = `${kind}:${String(slotIndex)}`;
        const cached = this.portPresentationCache.get(cacheKey);
        if (cached?.version === this.portPresentationCacheVersion) {
            return cached.presentation;
        }

        const constants = getLiteGraphConstants();
        const slotRecord = (slot || {}) as Record<string, unknown>;
        const explicit =
            this.node.getPortPresentation?.(
                kind,
                slotIndex,
                this.getPortLifecycleContext()
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

        const presentation = {
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
        this.portPresentationCache.set(cacheKey, {
            version: this.portPresentationCacheVersion,
            presentation,
        });
        return presentation;
    }

    private resolvePortGeometry(
        kind: NodeViewPortKind,
        slotIndex: number,
        _slot: unknown,
        presentation: ModernPortPresentation
    ): ModernPortGeometryCacheEntry | null {
        const cacheKey = `${kind}:${String(slotIndex)}`;
        const cached = this.portGeometryCache.get(cacheKey);
        if (cached?.version === this.portGeometryCacheVersion) {
            return cached;
        }

        const explicitLayout = this.node.getPortLayout?.(
            kind,
            slotIndex,
            this.getPortBuildContext()
        );
        let anchor: [number, number] | null;
        if (explicitLayout) {
            if (explicitLayout.space === "world") {
                anchor = [
                    explicitLayout.x - toFiniteNumber(this.node.pos?.[0]),
                    explicitLayout.y - toFiniteNumber(this.node.pos?.[1]),
                ];
            } else {
                anchor = [
                    toFiniteNumber(explicitLayout.x),
                    toFiniteNumber(explicitLayout.y),
                ];
            }
        } else {
            anchor = this.resolveDefaultPortAnchorLocal(kind, slotIndex);
        }

        const label = String(presentation.label || "");
        const labelWidth = label
            ? Math.min(
                  PORT_LABEL_MAX_WIDTH,
                  measureTextWidth(
                      label,
                      '500 11px "Aptos", "Segoe UI", sans-serif'
                  )
              )
            : 0;
        const geometry: ModernPortGeometryCacheEntry = {
            version: this.portGeometryCacheVersion,
            anchor,
            radius: Math.max(
                toFiniteNumber(presentation.radius, explicitLayout?.radius),
                6
            ),
            labelWidth,
            gutter: labelWidth
                ? Math.max(
                      PORT_GUTTER_MIN,
                      labelWidth + PORT_LABEL_PADDING + 10
                  )
                : PORT_GUTTER_MIN,
        };
        this.portGeometryCache.set(cacheKey, geometry);
        return geometry;
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
        const labelFrame = this.resolvePortLabelFrame(kind);

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
            const rootRecord = entry.root as unknown as Record<string, unknown>;
            const labelRecord = entry.label as unknown as Record<string, unknown>;
            setAttrIfChanged(rootRecord, "x", layout.anchorX);
            setAttrIfChanged(rootRecord, "y", layout.anchorY);
            if (!this.isSameMarkerShape(entry.marker, layout.shape)) {
                entry.marker.destroy();
                entry.marker = createPortMarker(layout.shape, markerColor);
                entry.root.add(entry.marker);
            } else {
                setShapeColor(entry.marker, markerColor);
            }

            setAttrIfChanged(labelRecord, "text", layout.label);
            setAttrIfChanged(
                labelRecord,
                "visible",
                !layout.hiddenLabelWhenCollapsed && Boolean(layout.label)
            );
            setAttrIfChanged(labelRecord, "x", labelFrame.x);
            setAttrIfChanged(labelRecord, "y", layout.anchorY);
            setAttrIfChanged(labelRecord, "width", labelFrame.width);
            setAttrIfChanged(labelRecord, "textAlign", labelFrame.textAlign);
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
        const rootRecord = this.root as unknown as Record<string, unknown>;
        const selectionOutlineRecord = this.shell.selectionOutline as unknown as Record<
            string,
            unknown
        >;
        const headerRecord = this.shell.header as unknown as Record<string, unknown>;

        setAttrIfChanged(rootRecord, "selected", Boolean(this.node.is_selected));
        setAttrIfChanged(
            selectionOutlineRecord,
            "visible",
            Boolean(this.node.is_selected)
        );

        setAttrIfChanged(
            headerRecord,
            "stroke",
            headerState === "press"
                ? "#76A8FF"
                : headerState === "hover"
                  ? "#4E6D94"
                  : shellState.borderColor || "#243342"
        );
        if (this.shellLayout.body) {
            const bodyRecord = this.shell.body as unknown as Record<string, unknown>;
            setAttrIfChanged(
                bodyRecord,
                "stroke",
                bodyState === "press"
                    ? "#76A8FF"
                    : bodyState === "hover"
                      ? "#4E6D94"
                      : shellState.borderColor || "#243342"
            );
        }

        const collapseOverlayRecord = this.shell.collapseOverlay as unknown as Record<
            string,
            unknown
        >;
        setAttrIfChanged(
            collapseOverlayRecord,
            "fill",
            collapseState === "press"
                ? "rgba(255,255,255,0.16)"
                : collapseState === "hover"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0)"
        );
        const resizeHandleGlyphRecord =
            this.shell.resizeHandleGlyph as unknown as Record<string, unknown>;
        setAttrIfChanged(
            resizeHandleGlyphRecord,
            "stroke",
            resizeState === "press"
                ? "#76A8FF"
                : resizeState === "hover"
                  ? "#C7D5E0"
                  : "#8593A0"
        );

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

    private refreshPortCacheVersions(
        changeMask: ModernNodeChangeMaskValue,
        needsGeometryPass: boolean
    ): void {
        const invalidatePresentation = Boolean(
            needsGeometryPass ||
                (changeMask &
                    (ModernNodeChangeMask.Ports |
                        ModernNodeChangeMask.Data |
                        ModernNodeChangeMask.Style)) !==
                    0
        );
        const invalidateGeometry =
            needsGeometryPass ||
            (changeMask &
                (ModernNodeChangeMask.Ports | ModernNodeChangeMask.Layout)) !==
                0;

        if (invalidatePresentation) {
            this.portPresentationCacheVersion += 1;
        }
        if (invalidateGeometry) {
            this.portGeometryCacheVersion += 1;
            this.portGutterCache = null;
        }

        this.portLifecycleContext = null;
        this.portBuildContext = null;
    }

    private getPortLifecycleContext(): ModernNodeLifecycleContext<
        ModernNodeLike,
        ModernNodeHost
    > {
        if (!this.portLifecycleContext) {
            this.portLifecycleContext = this.createLifecycleContext(
                ModernNodeChangeMask.Ports
            );
        }
        return this.portLifecycleContext;
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

    private getPortBuildContext(): ModernNodeBuildContext {
        if (!this.portBuildContext) {
            this.portBuildContext = this.createContextWithMask(
                ModernNodeChangeMask.Ports,
                this.shellState
            );
        }
        return this.portBuildContext;
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
            const outlineRecord = outline as unknown as Record<string, unknown> | null;
            setAttrIfChanged(widgetRoot, "disabled", Boolean(entry.schema.disabled));
            if (entry.schema.disabled) {
                setAttrIfChanged(widgetRoot, "state", "");
                if (outlineRecord) {
                    setAttrIfChanged(outlineRecord, "visible", false);
                    setAttrIfChanged(outlineRecord, "opacity", 0);
                }
                continue;
            }
            if (pressedIndex === i) {
                setAttrIfChanged(widgetRoot, "state", "press");
            } else if (hoveredIndex === i) {
                setAttrIfChanged(widgetRoot, "state", "hover");
            } else {
                setAttrIfChanged(widgetRoot, "state", "");
            }

            if (!outlineRecord) {
                continue;
            }

            const activePart =
                pressedIndex === i
                    ? pressedPart
                    : hoveredIndex === i
                      ? hoveredPart
                      : null;
            if (!activePart) {
                setAttrIfChanged(outlineRecord, "visible", false);
                setAttrIfChanged(outlineRecord, "opacity", 0);
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
            setAttrIfChanged(outlineRecord, "x", frame.x);
            setAttrIfChanged(outlineRecord, "y", frame.y);
            setAttrIfChanged(outlineRecord, "width", Math.max(0, frame.width));
            setAttrIfChanged(outlineRecord, "height", Math.max(0, frame.height));
            setAttrIfChanged(outlineRecord, "cornerRadius", actionZone ? 8 : 10);
            setAttrIfChanged(
                outlineRecord,
                "stroke",
                pressedIndex === i ? "#A4CAFF" : "#7EB2FF"
            );
            setAttrIfChanged(
                outlineRecord,
                "strokeWidth",
                pressedIndex === i ? 2 : 1.5
            );
            setAttrIfChanged(outlineRecord, "visible", true);
            setAttrIfChanged(
                outlineRecord,
                "opacity",
                pressedIndex === i ? 1 : 0.95
            );
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
            const backgroundRecord = entry.background as unknown as Record<
                string,
                unknown
            >;
            const outlineRecord = entry.outline as unknown as Record<string, unknown>;
            const labelRecord = entry.label as unknown as Record<string, unknown>;
            const glyphRecord = entry.glyph as unknown as Record<string, unknown> | null;
            if (isFooterSplitPart) {
                setAttrIfChanged(
                    backgroundRecord,
                    "fill",
                    state === "press"
                        ? "#2D3A48"
                        : state === "hover"
                          ? "#283442"
                          : "#20252C"
                );
                setAttrIfChanged(
                    backgroundRecord,
                    "stroke",
                    state === "press"
                        ? "#7EB2FF"
                        : state === "hover"
                          ? "#5D7898"
                          : "#394454"
                );
                setAttrIfChanged(
                    outlineRecord,
                    "visible",
                    state === "press" || state === "hover"
                );
                setAttrIfChanged(
                    outlineRecord,
                    "opacity",
                    state === "press" ? 1 : state === "hover" ? 0.9 : 0
                );
                setAttrIfChanged(
                    outlineRecord,
                    "stroke",
                    state === "press" ? "#A4CAFF" : "#7EB2FF"
                );
                setAttrIfChanged(
                    outlineRecord,
                    "strokeWidth",
                    state === "press" ? 2 : 1.5
                );
                if (glyphRecord) {
                    setAttrIfChanged(
                        glyphRecord,
                        "stroke",
                        state === "press"
                            ? "#F3F8FF"
                            : state === "hover"
                              ? "#DCEBFB"
                              : "#B7C4D1"
                    );
                }
                continue;
            }
            setAttrIfChanged(
                backgroundRecord,
                "fill",
                state === "press"
                    ? "#1B3657"
                    : state === "hover"
                      ? "#21364E"
                      : "#172332"
            );
            setAttrIfChanged(
                backgroundRecord,
                "stroke",
                state === "press"
                    ? "#76A8FF"
                    : state === "hover"
                      ? "#5A7FA8"
                      : "#2B4663"
            );
            setAttrIfChanged(
                outlineRecord,
                "visible",
                state === "press" || state === "hover"
            );
            setAttrIfChanged(
                outlineRecord,
                "opacity",
                state === "press" ? 1 : state === "hover" ? 0.95 : 0
            );
            setAttrIfChanged(
                outlineRecord,
                "stroke",
                state === "press" ? "#A4CAFF" : "#7EB2FF"
            );
            setAttrIfChanged(
                outlineRecord,
                "strokeWidth",
                state === "press" ? 2 : 1.5
            );
            setAttrIfChanged(
                labelRecord,
                "fill",
                state === "press"
                    ? "#F3F8FF"
                    : state === "hover"
                      ? "#D6E8FA"
                      : "#BBD0E6"
            );
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
