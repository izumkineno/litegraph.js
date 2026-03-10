import { Flow } from "@leafer-in/flow";
import * as leafer from "leafer-ui";
import { Group, Path, Rect, Text, UI } from "leafer-ui";
import type { Vector2 } from "../types/core-types";
import { type ModernActionPartSchema, type ModernNodeChangeMaskValue, type ModernNodeLifecycleContext, type ModernNodePortLayout, type ModernPortPresentation, type ModernShellState } from "./ModernNodeContracts";
import type { ModernWidgetRenderer, ModernWidgetSchema, ModernWidgetViewHandle } from "./index";
import type { GraphMutationNodeLike } from "./GraphMutationBus";
import type { NodeViewHost, NodeViewPortHit, NodeViewPortKind } from "./NodeViewHost";
export type ModernNodePartKind = "body" | "header" | "collapse" | "resize" | "widget" | "action-part" | "input-port" | "output-port";
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
    flags?: {
        collapsed?: boolean;
    } | null;
    ensureModernPorts?: () => void;
    defineWidgets?: () => ReadonlyArray<ModernWidgetSchema>;
    defineActionParts?: (context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>) => ReadonlyArray<ModernActionPartSchema<ModernNodeLike, ModernNodeHost>>;
    getShellState?: (context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>) => ModernShellState | null | undefined;
    getPortPresentation?: (kind: NodeViewPortKind, slotIndex: number, context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>) => ModernPortPresentation | null;
    consumeModernChangeMask?: () => ModernNodeChangeMaskValue;
    peekModernChangeMask?: () => ModernNodeChangeMaskValue;
    mountContent?: (context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>) => unknown;
    patchContent?: (context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>) => void;
    mountView?: (context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>) => unknown;
    patchView?: (context: ModernNodeLifecycleContext<ModernNodeLike, ModernNodeHost>) => void;
    buildUI?: (context: ModernNodeBuildContext) => unknown;
    updateUI?: (context: ModernNodeBuildContext) => void;
    getPortLayout?: (kind: NodeViewPortKind, slotIndex: number, context: ModernNodeBuildContext) => ModernNodePortLayout | null;
    getConnectionPos?: (isInput: boolean, slotIndex: number, out?: [number, number]) => [number, number] | Float32Array;
    getTitle?: () => string;
    onActionPart?: (action: string, part: ModernActionPartSchema<ModernNodeLike, ModernNodeHost>, event?: PointerEvent, graphcanvas?: unknown) => void;
}
export declare class ModernNodeHost implements NodeViewHost {
    readonly runtime: "modern";
    readonly node: ModernNodeLike;
    readonly root: Group;
    private readonly shell;
    private readonly interactionState;
    private shellState;
    private shellLayout;
    private content;
    private widgetEntries;
    private actionPartEntries;
    private portEntries;
    private portPresentationCache;
    private portGeometryCache;
    private portGutterCache;
    private shellTextMetricsCache;
    private contentAreaCache;
    private widgetValueSnapshot;
    private currentWidgetSchemas;
    private currentActionPartSchemas;
    private lastWidgetSignature;
    private lastActionPartSignature;
    private lastActionPartLayoutSignature;
    private lastMeasuredNodeWidth;
    private lastMeasuredNodeHeight;
    private portPresentationCacheVersion;
    private portGeometryCacheVersion;
    private portLifecycleContext;
    private portBuildContext;
    private mounted;
    private shellLayoutInitialized;
    private resizeAnchor;
    constructor(node: ModernNodeLike);
    repaint(): void;
    repaintForegroundState(): boolean;
    private collectWidgetSchemas;
    private collectActionPartSchemas;
    private ensureMinimumNodeSize;
    syncPosition(): void;
    destroy(): void;
    getInteractionState(): Readonly<ModernNodeInteractionState>;
    updateInteractionState(patch: Partial<ModernNodeInteractionState>): void;
    clearPointerState(): void;
    getInteractivePartAt(worldX: number, worldY: number): ModernNodePartHit | null;
    beginResize(worldX: number, worldY: number): void;
    updateResize(worldX: number, worldY: number, clampSize?: (width: number, height: number) => Vector2): boolean;
    endResize(): void;
    getWidgetEntry(index: number): ModernWidgetEntry | null;
    getActionPartEntry(index: number): ModernActionPartEntry | null;
    executeActionPart(part: ModernNodePartHit, event?: PointerEvent, graphcanvas?: unknown): void;
    getLocalPoint(worldX: number, worldY: number): readonly [number, number];
    getPortAnchor(kind: NodeViewPortKind, slotIndex: number): readonly [number, number] | null;
    getPortDirection(kind: NodeViewPortKind, _slotIndex: number): number | null;
    hitPortAt(worldX: number, worldY: number): NodeViewPortHit | null;
    private createShellParts;
    private consumeChangeMask;
    private resolveShellState;
    private computeShellLayout;
    private didMeasuredNodeSizeChange;
    private syncMeasuredNodeSize;
    private applyShellLayout;
    private applyShellVisualState;
    private resolveMinimumBodyHeight;
    private resolveMinimumShellWidth;
    private resolveShellTextMetrics;
    private resolveMinimumContentWidth;
    private resolveHeaderMetaText;
    private resolveTitleStartX;
    private resolvePortGutters;
    private measurePortGutter;
    private syncContentLayout;
    private syncWidgets;
    private syncActionParts;
    private syncPorts;
    private mountContent;
    private patchContent;
    private getContentArea;
    private hasFooterActionParts;
    private patchShellWidgetLayout;
    private computeWidgetLayouts;
    private reuseWidgetLayouts;
    private reuseActionPartLayouts;
    private resolveWidgetArea;
    private addWidgetHandle;
    private computeActionPartLayouts;
    private buildPortLayouts;
    private resolvePortPresentation;
    private resolvePortGeometry;
    private resolveDefaultPortAnchorLocal;
    private isPortActive;
    private syncPortLayer;
    private isSameMarkerShape;
    private resolvePortLayout;
    private resolvePortLabelFrame;
    private storeInspectableState;
    private applyInteractionState;
    private clearWidgets;
    private clearActionParts;
    private createLifecycleContext;
    private refreshPortCacheVersions;
    private getPortLifecycleContext;
    private createContextWithMask;
    private getPortBuildContext;
    private createWidgetContext;
    private applyWidgetInteractionState;
    private applyActionPartInteractionState;
    private applyPortInteractionState;
    private hitWidgetPart;
    private hitActionPart;
    private hitPortPart;
}
export {};
