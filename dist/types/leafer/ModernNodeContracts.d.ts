import type * as leafer from "leafer-ui";
import type { Group, UI } from "leafer-ui";
import type { NodeViewPortKind } from "./NodeViewHost";
import type { ModernWidgetSchema } from "./ModernWidgetContracts";
export declare const MODERN_NODE_MARKER_KEY = "__litegraphModernNode";
export declare const MODERN_NODE_STATE_KEY = "__litegraphModernState";
export declare const ModernNodeChangeMask: {
    readonly None: 0;
    readonly Data: number;
    readonly Layout: number;
    readonly Style: number;
    readonly Ports: number;
    readonly Interaction: number;
    readonly All: number;
};
export declare const ModernNodeContracts: {
    readonly MODERN_NODE_MARKER_KEY: "__litegraphModernNode";
    readonly MODERN_NODE_STATE_KEY: "__litegraphModernState";
    readonly ModernNodeChangeMask: {
        readonly None: 0;
        readonly Data: number;
        readonly Layout: number;
        readonly Style: number;
        readonly Ports: number;
        readonly Interaction: number;
        readonly All: number;
    };
};
export type ModernNodeChangeMaskValue = number;
export interface ModernNodePortDefinition {
    name: string;
    type?: string | number;
    extra?: Record<string, unknown>;
}
export interface ModernNodePortSchema {
    inputs?: ReadonlyArray<ModernNodePortDefinition>;
    outputs?: ReadonlyArray<ModernNodePortDefinition>;
}
export interface ModernNodePortLayout {
    x: number;
    y: number;
    dir?: number;
    radius?: number;
    space?: "local" | "world";
}
export type ModernPortShape = "circle" | "box" | "arrow" | "grid";
export interface ModernPortPresentation {
    label?: string;
    shape?: ModernPortShape;
    dir?: number;
    colorOn?: string;
    colorOff?: string;
    hideLabelWhenCollapsed?: boolean;
    radius?: number;
}
export interface ModernActionPartCallbackContext<TNode extends {
    id: number | string;
} = {
    id: number | string;
}, THost = unknown> {
    readonly node: TNode;
    readonly host: THost;
    readonly graphcanvas?: unknown;
    readonly event?: PointerEvent;
}
export interface ModernActionPartSchema<TNode extends {
    id: number | string;
} = {
    id: number | string;
}, THost = unknown> {
    id: string;
    label?: string;
    action?: string;
    cursor?: string;
    placement?: "footer-left" | "footer-right" | "header-right" | "body";
    bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
    visible?: boolean;
    disabled?: boolean;
    onTrigger?: (context: ModernActionPartCallbackContext<TNode, THost>) => void;
}
export interface ModernShellState {
    title?: string;
    titleMode?: "default" | "compact" | "hidden";
    collapsedWidth?: number | null;
    headerMetaText?: string;
    minimumWidth?: number;
    minimumHeight?: number;
    titleColor?: string | null;
    titleTextColor?: string | null;
    boxColor?: string | null;
    bodyColor?: string | null;
    borderColor?: string | null;
    showSignalLamp?: boolean;
    collapsible?: boolean;
    resizable?: boolean;
    showCollapsedSlots?: boolean;
    allowNodeHover?: boolean;
    summaryText?: string;
}
export interface ModernNodeLifecycleContext<TNode extends {
    id: number | string;
} = {
    id: number | string;
}, THost = unknown> {
    readonly node: TNode;
    readonly host: THost;
    readonly root: Group;
    readonly content: UI | Group | null;
    readonly changeMask: ModernNodeChangeMaskValue;
    readonly interactionState?: unknown;
    readonly leafer: typeof leafer;
    readonly shellState?: Readonly<ModernShellState>;
}
export interface ModernNodeRuntimeLike {
    id: number | string;
    renderRuntime?: "legacy" | "modern";
    [MODERN_NODE_MARKER_KEY]?: boolean;
    defineWidgets?: () => ReadonlyArray<ModernWidgetSchema>;
    defineActionParts?: (context: ModernNodeLifecycleContext) => ReadonlyArray<ModernActionPartSchema>;
    getShellState?: (context: ModernNodeLifecycleContext) => ModernShellState | null | undefined;
    getPortPresentation?: (kind: NodeViewPortKind, slotIndex: number, context: ModernNodeLifecycleContext) => ModernPortPresentation | null;
    mountContent?: (context: ModernNodeLifecycleContext) => unknown;
    patchContent?: (context: ModernNodeLifecycleContext) => void;
    mountView?: (context: ModernNodeLifecycleContext) => unknown;
    patchView?: (context: ModernNodeLifecycleContext) => void;
    buildUI?: (context: ModernNodeLifecycleContext) => unknown;
    updateUI?: (context: ModernNodeLifecycleContext) => void;
    getPortLayout?: (kind: NodeViewPortKind, slotIndex: number, context: ModernNodeLifecycleContext) => ModernNodePortLayout | null;
    consumeModernChangeMask?: () => ModernNodeChangeMaskValue;
    requestModernPatch?: (changeMask?: ModernNodeChangeMaskValue, dirtyBackground?: boolean) => void;
    ensureModernPorts?: () => void;
}
export declare function isModernNodeContract(node: unknown): node is ModernNodeRuntimeLike;
