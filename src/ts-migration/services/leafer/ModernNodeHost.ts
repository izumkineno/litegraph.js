import * as leafer from "leafer-ui";
import { Group, Rect, Text, UI } from "leafer-ui";

import {
    MODERN_NODE_STATE_KEY,
    ModernNodeChangeMask,
    type ModernNodeChangeMaskValue,
    type ModernNodeLifecycleContext,
    type ModernNodePortLayout,
} from "../../modern/ModernNodeContracts";
import type {
    ModernWidgetRenderContext,
    ModernWidgetRenderer,
    ModernWidgetSchema,
    ModernWidgetViewHandle,
} from "../../modern";
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
    dir?: number;
    radius?: number;
}

export interface ModernNodeShellLayout {
    width: number;
    height: number;
    body?: ModernNodeRectLike | null;
    header?: ModernNodeRectLike | null;
    collapse?: ModernNodeRectLike | null;
    resize?: ModernNodeRectLike | null;
    widgets?: ModernNodeWidgetLayout[];
    inputPorts?: ModernNodePortVisualLayout[];
    outputPorts?: ModernNodePortVisualLayout[];
}

export interface ModernNodePartHit {
    kind: ModernNodePartKind;
    index?: number;
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

interface ModernNodeShellState {
    layout?: ModernNodeShellLayout;
    widgetRoot?: Group | null;
    applyInteractionState?: (state: ModernNodeInteractionState) => void;
}

interface ModernWidgetEntry {
    schema: ModernWidgetSchema;
    renderer: ModernWidgetRenderer;
    handle: ModernWidgetViewHandle;
    layout: ModernNodeWidgetLayout;
}

export interface ModernNodeBuildContext {
    readonly node: ModernNodeLike;
    readonly host: ModernNodeHost;
    readonly root: Group;
    readonly content: UI | Group | null;
    readonly changeMask: ModernNodeChangeMaskValue;
    readonly interactionState: ModernNodeInteractionState;
    readonly leafer: typeof leafer;
}

export interface ModernNodeLike extends GraphMutationNodeLike {
    pos: [number, number] | Float32Array;
    size: [number, number] | Float32Array;
    title?: string;
    inputs?: Array<unknown> | null;
    outputs?: Array<unknown> | null;
    is_selected?: boolean;
    ensureModernPorts?: () => void;
    defineWidgets?: () => ReadonlyArray<ModernWidgetSchema>;
    consumeModernChangeMask?: () => ModernNodeChangeMaskValue;
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
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toPoint(value: unknown): [number, number] | null {
    if (
        value &&
        typeof value === "object" &&
        ("0" in (value as Record<string, unknown>) ||
            ArrayBuffer.isView(value as ArrayBufferView))
    ) {
        const indexed = value as ArrayLike<unknown>;
        return [toFiniteNumber(indexed[0]), toFiniteNumber(indexed[1])];
    }

    if (
        value &&
        typeof value === "object" &&
        "x" in (value as Record<string, unknown>) &&
        "y" in (value as Record<string, unknown>)
    ) {
        const point = value as { x?: unknown; y?: unknown };
        return [toFiniteNumber(point.x), toFiniteNumber(point.y)];
    }

    return null;
}

function pointInsideRect(
    point: readonly [number, number],
    rect: ModernNodeRectLike | null | undefined
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

function clonePartHit(
    hit: ModernNodePartHit | null | undefined
): ModernNodePartHit | null {
    if (!hit) {
        return null;
    }

    return {
        kind: hit.kind,
        index: hit.index,
        action: hit.action,
        cursor: hit.cursor,
        bounds: hit.bounds || null,
    };
}

function samePart(
    left: ModernNodePartHit | null | undefined,
    right: ModernNodePartHit | null | undefined
): boolean {
    return (
        left?.kind === right?.kind &&
        left?.index === right?.index &&
        left?.action === right?.action
    );
}

function createFallbackContent(node: ModernNodeLike): Group {
    const width = Math.max(toFiniteNumber(node.size?.[0], 160), 120);
    const height = Math.max(toFiniteNumber(node.size?.[1], 80), 60);
    const group = new Group({
        name: `litegraph-modern-node-fallback:${String(node.id)}`,
        hittable: false,
    });
    group.add([
        new Rect({
            x: 0,
            y: 0,
            width,
            height,
            cornerRadius: 14,
            fill: "#1F2733",
            stroke: "#87B6FF",
            strokeWidth: 2,
            hittable: false,
        }),
        new Text({
            x: 14,
            y: 12,
            text: String(node.title || node.id || "Modern Node"),
            fontSize: 16,
            fontWeight: "bold",
            fill: "#F7FAFF",
            hittable: false,
        }),
    ]);
    return group;
}

function toUI(result: unknown, node: ModernNodeLike): UI | Group {
    if (result instanceof UI) {
        return result;
    }

    if (result && typeof result === "object") {
        return new Group(result as Record<string, unknown>);
    }

    return createFallbackContent(node);
}

export class ModernNodeHost implements NodeViewHost {
    readonly runtime = "modern" as const;
    readonly node: ModernNodeLike;
    readonly root: Group;

    private content: UI | Group | null = null;
    private widgetRoot: Group | null = null;
    private widgetEntries: ModernWidgetEntry[] = [];
    private widgetValueSnapshot = new Map<string, unknown>();
    private lastWidgetSignature = "";
    private mounted = false;
    private portLayoutCache = new Map<string, ModernNodePortLayout | null>();
    private lastSlotSignature = "";
    private readonly interactionState: ModernNodeInteractionState = {
        hovered: false,
        pressed: false,
        dragging: false,
        resizing: false,
        hoveredPart: null,
        pressedPart: null,
    };
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

        this.repaint();
    }

    repaint(): void {
        this.node.ensureModernPorts?.();
        const changeMask = this.consumeChangeMask();

        if (!this.mounted) {
            const mountedContent = this.mountContent(changeMask);
            this.content = toUI(mountedContent, this.node);
            this.root.add(this.content);
            this.widgetRoot = this.ensureWidgetRoot();
            this.mounted = true;
            this.invalidatePortLayoutCache();
        } else if (changeMask !== ModernNodeChangeMask.None) {
            this.patchContent(changeMask);
        }

        this.syncWidgets(changeMask);

        if (this.didSlotSignatureChange()) {
            this.invalidatePortLayoutCache();
        }

        if (
            (changeMask & ModernNodeChangeMask.Layout) !== 0 ||
            (changeMask & ModernNodeChangeMask.Ports) !== 0
        ) {
            this.invalidatePortLayoutCache();
        }

        this.root.selected = Boolean((this.node as { is_selected?: boolean }).is_selected);
        this.applyInteractionState();
        this.syncPosition();
    }

    syncPosition(): void {
        this.root.x = toFiniteNumber(this.node.pos?.[0]);
        const collapsed = Boolean(
            (this.node as { flags?: { collapsed?: boolean } }).flags?.collapsed
        );
        const collapsedOffset = collapsed
            ? toFiniteNumber(this.getShellState()?.layout?.height, 30)
            : 0;
        this.root.y = toFiniteNumber(this.node.pos?.[1]) - collapsedOffset;
    }

    destroy(): void {
        this.clearWidgets();
        this.root.destroy();
    }

    getInteractionState(): Readonly<ModernNodeInteractionState> {
        return this.interactionState;
    }

    updateInteractionState(
        patch: Partial<ModernNodeInteractionState>
    ): void {
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
        const layout = this.getShellState()?.layout;
        if (!layout) {
            return this.hitFallbackPart(localPoint);
        }

        if (pointInsideRect(localPoint, layout.resize)) {
            return {
                kind: "resize",
                cursor: "se-resize",
                bounds: layout.resize || null,
            };
        }

        if (pointInsideRect(localPoint, layout.collapse)) {
            return {
                kind: "collapse",
                cursor: "pointer",
                bounds: layout.collapse || null,
            };
        }

        const widgetHit = this.hitWidgetPart(localPoint, layout.widgets);
        if (widgetHit) {
            return widgetHit;
        }

        const inputPortHit = this.hitPortPart(
            localPoint,
            "input-port",
            layout.inputPorts
        );
        if (inputPortHit) {
            return inputPortHit;
        }

        const outputPortHit = this.hitPortPart(
            localPoint,
            "output-port",
            layout.outputPorts
        );
        if (outputPortHit) {
            return outputPortHit;
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

        return this.hitFallbackPart(localPoint);
    }

    beginResize(worldX: number, worldY: number): void {
        this.resizeAnchor = {
            startWorldX: worldX,
            startWorldY: worldY,
            startWidth: Math.max(toFiniteNumber(this.node.size?.[0], 160), 80),
            startHeight: Math.max(toFiniteNumber(this.node.size?.[1], 80), 60),
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
            120,
            Math.round(
                this.resizeAnchor.startWidth +
                    (worldX - this.resizeAnchor.startWorldX)
            )
        );
        const nextHeight = Math.max(
            60,
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

    private ensureWidgetRoot(): Group {
        const shellWidgetRoot = this.getShellState()?.widgetRoot;
        if (shellWidgetRoot) {
            this.widgetRoot = shellWidgetRoot;
            return shellWidgetRoot;
        }

        if (!this.widgetRoot) {
            this.widgetRoot = new Group({
                name: `litegraph-modern-node-widgets:${String(this.node.id)}`,
                hittable: false,
            });
            this.root.add(this.widgetRoot);
        }

        return this.widgetRoot;
    }

    private clearWidgets(): void {
        for (let i = 0; i < this.widgetEntries.length; ++i) {
            const entry = this.widgetEntries[i];
            if (entry.handle.destroy) {
                entry.handle.destroy();
            } else {
                const root = entry.handle.root as { destroy?: () => void } | undefined;
                root?.destroy?.();
            }
        }

        this.widgetEntries = [];
        this.widgetValueSnapshot.clear();
        this.lastWidgetSignature = "";
        this.patchShellWidgetLayout([]);
    }

    private syncWidgets(changeMask: ModernNodeChangeMaskValue): void {
        const collapsed = Boolean(
            (this.node as { flags?: { collapsed?: boolean } }).flags?.collapsed
        );
        const schemas = collapsed
            ? []
            : Array.isArray(this.node.defineWidgets?.())
              ? [...(this.node.defineWidgets?.() || [])]
              : [];
        const widgetRoot = this.ensureWidgetRoot();
        widgetRoot.visible = !collapsed;

        const nextSignature = schemas
            .map((schema) => `${schema.id}:${schema.type}`)
            .join("|");
        const needsRebuild =
            this.widgetEntries.length !== schemas.length ||
            this.lastWidgetSignature !== nextSignature ||
            (changeMask & ModernNodeChangeMask.Layout) !== 0;

        if (!schemas.length) {
            this.clearWidgets();
            return;
        }

        const bodyBounds = this.getWidgetBodyBounds();
        const nextLayout: ModernNodeWidgetLayout[] = [];

        if (needsRebuild) {
            this.clearWidgets();
            for (let index = 0; index < schemas.length; ++index) {
                const schema = schemas[index];
                const renderer = resolveModernWidgetRenderer(schema.type);
                if (!renderer) {
                    continue;
                }

                const bounds = resolveWidgetBounds(bodyBounds, index, schemas.length);
                const context = this.createWidgetContext(schema, bounds);
                const handle = renderer.createView(context);
                this.addWidgetHandle(widgetRoot, handle);

                const layout = this.toWidgetLayout(index, schema, handle);
                this.widgetEntries.push({
                    schema,
                    renderer,
                    handle,
                    layout,
                });
                nextLayout.push(layout);
                this.widgetValueSnapshot.set(schema.id, schema.value);
            }
            this.lastWidgetSignature = nextSignature;
        } else {
            for (let index = 0; index < this.widgetEntries.length; ++index) {
                const entry = this.widgetEntries[index];
                const schema = schemas[index];
                const bounds = resolveWidgetBounds(bodyBounds, index, schemas.length);
                entry.schema = schema;
                const context = this.createWidgetContext(schema, bounds);
                entry.renderer.patchView(context, entry.handle, changeMask);
                entry.layout = this.toWidgetLayout(index, schema, entry.handle);
                nextLayout.push(entry.layout);
                this.widgetValueSnapshot.set(schema.id, schema.value);
            }
        }

        this.patchShellWidgetLayout(nextLayout);
        this.applyWidgetInteractionState();
    }

    private getWidgetBodyBounds(): ModernNodeRectLike {
        const shellLayout = this.getShellState()?.layout;
        if (shellLayout?.body) {
            return {
                x: shellLayout.body.x,
                y: shellLayout.body.y,
                width: shellLayout.body.width,
                height: shellLayout.body.height,
            };
        }

        return {
            x: 0,
            y: 0,
            width: Math.max(toFiniteNumber(this.node.size?.[0], 120), 80),
            height: Math.max(toFiniteNumber(this.node.size?.[1], 60), 24),
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

    private addWidgetHandle(root: Group, handle: ModernWidgetViewHandle): void {
        if (handle.root instanceof UI) {
            root.add(handle.root);
            return;
        }

        const candidate = handle.root as { parent?: unknown } | undefined;
        if (candidate && typeof candidate === "object" && !candidate.parent) {
            root.add(handle.root as Group);
        }
    }

    private toWidgetLayout(
        index: number,
        schema: ModernWidgetSchema,
        handle: ModernWidgetViewHandle
    ): ModernNodeWidgetLayout {
        return {
            index,
            id: schema.id,
            type: schema.type,
            x: handle.bounds.x,
            y: handle.bounds.y,
            width: handle.bounds.width,
            height: handle.bounds.height,
            action: "edit",
            actionZones: handle.actionZones as
                | Record<string, ModernNodeRectLike>
                | undefined,
        };
    }

    private patchShellWidgetLayout(layout: ModernNodeWidgetLayout[]): void {
        const shellState = this.getShellState();
        if (!shellState?.layout) {
            return;
        }
        shellState.layout.widgets = layout;
    }

    private applyWidgetInteractionState(): void {
        const hoveredIndex =
            this.interactionState.hoveredPart?.kind === "widget"
                ? this.interactionState.hoveredPart.index
                : null;
        const pressedIndex =
            this.interactionState.pressedPart?.kind === "widget"
                ? this.interactionState.pressedPart.index
                : null;

        for (let i = 0; i < this.widgetEntries.length; ++i) {
            const entry = this.widgetEntries[i];
            const widgetRoot = entry.handle.root as Record<string, unknown>;
            if (!widgetRoot || typeof widgetRoot !== "object") {
                continue;
            }

            widgetRoot.disabled = Boolean(entry.schema.disabled);
            if (entry.schema.disabled) {
                widgetRoot.state = "";
                continue;
            }

            if (pressedIndex === i) {
                widgetRoot.state = "press";
            } else if (hoveredIndex === i) {
                widgetRoot.state = "hover";
            } else {
                widgetRoot.state = "";
            }
        }
    }

    getLocalPoint(worldX: number, worldY: number): readonly [number, number] {
        const point = this.root.getInnerPoint({
            x: worldX,
            y: worldY,
        });
        return [toFiniteNumber(point.x), toFiniteNumber(point.y)];
    }

    getPortAnchor(
        kind: NodeViewPortKind,
        slotIndex: number
    ): readonly [number, number] | null {
        const layout = this.resolvePortLayout(kind, slotIndex);
        if (layout) {
            if (layout.space === "world") {
                return [layout.x, layout.y];
            }

            return [
                toFiniteNumber(this.root.x) + layout.x,
                toFiniteNumber(this.root.y) + layout.y,
            ];
        }

        const fallbackPoint = toPoint(
            this.node.getConnectionPos?.(kind === "input", slotIndex)
        );
        return fallbackPoint || null;
    }

    getPortDirection(
        kind: NodeViewPortKind,
        slotIndex: number
    ): number | null {
        const layout = this.resolvePortLayout(kind, slotIndex);
        if (layout?.dir != null) {
            return toFiniteNumber(layout.dir);
        }

        return kind === "input" ? PORT_DIRECTION_LEFT : PORT_DIRECTION_RIGHT;
    }

    hitPortAt(worldX: number, worldY: number): NodeViewPortHit | null {
        let bestHit: (NodeViewPortHit & { distance: number }) | null = null;
        const kinds: NodeViewPortKind[] = ["output", "input"];

        for (let kindIndex = 0; kindIndex < kinds.length; ++kindIndex) {
            const kind = kinds[kindIndex];
            const slotCount = this.getSlotCount(kind);
            for (let slotIndex = 0; slotIndex < slotCount; ++slotIndex) {
                const anchor = this.getPortAnchor(kind, slotIndex);
                if (!anchor) {
                    continue;
                }

                const radius =
                    this.resolvePortLayout(kind, slotIndex)?.radius ?? 12;
                const dx = worldX - anchor[0];
                const dy = worldY - anchor[1];
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius) {
                    continue;
                }

                if (!bestHit || dist < bestHit.distance) {
                    bestHit = {
                        kind,
                        slotIndex,
                        anchor,
                        dir: this.getPortDirection(kind, slotIndex) || undefined,
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

    private mountContent(changeMask: ModernNodeChangeMaskValue): unknown {
        const context = this.createContextWithMask(changeMask);

        if (typeof this.node.mountView === "function") {
            return this.node.mountView(context);
        }

        if (typeof this.node.buildUI === "function") {
            return this.node.buildUI(context);
        }

        return null;
    }

    private patchContent(changeMask: ModernNodeChangeMaskValue): void {
        const context = this.createContextWithMask(changeMask);

        if (typeof this.node.patchView === "function") {
            this.node.patchView(context);
            return;
        }

        this.node.updateUI?.(context);
    }

    private consumeChangeMask(): ModernNodeChangeMaskValue {
        const rawMask = this.node.consumeModernChangeMask?.();
        if (rawMask == null) {
            return ModernNodeChangeMask.All;
        }

        const normalizedMask = toFiniteNumber(
            rawMask,
            ModernNodeChangeMask.None
        );
        if (normalizedMask <= ModernNodeChangeMask.None) {
            return ModernNodeChangeMask.None;
        }

        return normalizedMask;
    }

    private didSlotSignatureChange(): boolean {
        const nextSignature = `${this.getSlotCount("input")}:${this.getSlotCount("output")}`;
        if (nextSignature === this.lastSlotSignature) {
            return false;
        }

        this.lastSlotSignature = nextSignature;
        return true;
    }

    private invalidatePortLayoutCache(): void {
        this.portLayoutCache.clear();
    }

    private createContextWithMask(
        changeMask: ModernNodeChangeMaskValue
    ): ModernNodeBuildContext {
        return {
            ...this.createContext(),
            changeMask,
        };
    }

    private createContext(): ModernNodeBuildContext {
        return {
            node: this.node,
            host: this,
            root: this.root,
            content: this.content,
            changeMask: ModernNodeChangeMask.All,
            interactionState: this.interactionState,
            leafer,
        };
    }

    private getSlotCount(kind: NodeViewPortKind): number {
        const list = kind === "input" ? this.node.inputs : this.node.outputs;
        return Array.isArray(list) ? list.length : 0;
    }

    private resolvePortLayout(
        kind: NodeViewPortKind,
        slotIndex: number
    ): ModernNodePortLayout | null {
        const cacheKey = `${kind}:${slotIndex}`;
        if (this.portLayoutCache.has(cacheKey)) {
            return this.portLayoutCache.get(cacheKey) || null;
        }

        const resolvedLayout =
            this.node.getPortLayout?.(
                kind,
                slotIndex,
                this.createContextWithMask(ModernNodeChangeMask.Ports)
            ) || null;
        this.portLayoutCache.set(cacheKey, resolvedLayout);

        return resolvedLayout;
    }

    private getShellState(): ModernNodeShellState | null {
        if (!this.content || typeof this.content !== "object") {
            return null;
        }

        return (
            (this.content as unknown as Record<string, unknown>)[
                MODERN_NODE_STATE_KEY
            ] as ModernNodeShellState | undefined
        ) || null;
    }

    private applyInteractionState(): void {
        this.root.selected = Boolean(
            (this.node as { is_selected?: boolean }).is_selected
        );
        this.getShellState()?.applyInteractionState?.(this.interactionState);
        this.applyWidgetInteractionState();
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
                const zoneEntries = Object.entries(widget.actionZones);
                for (let zoneIndex = 0; zoneIndex < zoneEntries.length; ++zoneIndex) {
                    const [action, rect] = zoneEntries[zoneIndex];
                    if (pointInsideRect(point, rect)) {
                        return {
                            kind: "widget",
                            index: widget.index,
                            action,
                            cursor: "pointer",
                            bounds: rect,
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

    private hitFallbackPart(
        point: readonly [number, number]
    ): ModernNodePartHit | null {
        const width = Math.max(toFiniteNumber(this.node.size?.[0], 120), 120);
        const height = Math.max(toFiniteNumber(this.node.size?.[1], 60), 60);
        if (
            point[0] < 0 ||
            point[1] < 0 ||
            point[0] > width ||
            point[1] > height
        ) {
            return null;
        }

        return {
            kind: point[1] <= 32 ? "header" : "body",
            bounds: {
                x: 0,
                y: 0,
                width,
                height,
            },
        };
    }
}
