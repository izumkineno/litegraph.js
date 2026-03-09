import type * as leafer from "leafer-ui";
export interface ModernWidgetRectLike {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface ModernWidgetSchema {
    id: string;
    type: string;
    name: string;
    label?: string;
    value: unknown;
    property?: string;
    disabled?: boolean;
    readonly?: boolean;
    options?: Record<string, unknown>;
}
export interface ModernWidgetHit {
    action?: string;
    cursor?: string;
    bounds?: ModernWidgetRectLike | null;
}
export interface ModernWidgetViewHandle {
    root: unknown;
    bounds: ModernWidgetRectLike;
    actionZones?: Record<string, ModernWidgetRectLike>;
    destroy?(): void;
    [key: string]: unknown;
}
export interface ModernWidgetRenderContext<TNode extends {
    id: number | string;
} = {
    id: number | string;
}, THost = unknown> {
    readonly node: TNode;
    readonly host: THost;
    readonly schema: ModernWidgetSchema;
    readonly bounds: ModernWidgetRectLike;
    readonly leafer: typeof leafer;
}
export interface ModernWidgetActionResult {
    consumed?: boolean;
    nextValue?: unknown;
    openEditor?: boolean;
}
export interface ModernWidgetActionContext<TNode extends {
    id: number | string;
} = {
    id: number | string;
}, THost = unknown> extends ModernWidgetRenderContext<TNode, THost> {
    readonly handle: ModernWidgetViewHandle;
    readonly action: string;
    readonly event: PointerEvent;
}
export interface ModernWidgetRenderer<TNode extends {
    id: number | string;
} = {
    id: number | string;
}, THost = unknown> {
    createView(context: ModernWidgetRenderContext<TNode, THost>): ModernWidgetViewHandle;
    patchView(context: ModernWidgetRenderContext<TNode, THost>, handle: ModernWidgetViewHandle, changeMask: number): void;
    hitTest?(context: ModernWidgetRenderContext<TNode, THost>, handle: ModernWidgetViewHandle, point: readonly [number, number]): ModernWidgetHit | null;
    performAction?(context: ModernWidgetActionContext<TNode, THost>, handle: ModernWidgetViewHandle): ModernWidgetActionResult | void;
}
