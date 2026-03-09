import type { LGraphNodeConstructorLike } from "../core/litegraph.registry";
import { MODERN_NODE_MARKER_KEY } from "./ModernNodeContracts";
import type { ModernWidgetRenderer } from "./ModernWidgetContracts";

export interface ModernNodeRegistryLiteGraphLike {
    registerNodeType: (
        type: string,
        baseClass: LGraphNodeConstructorLike
    ) => void;
    registered_node_types?: Record<string, unknown>;
    registerModernWidget?: (
        type: string,
        renderer: ModernWidgetRenderer
    ) => string;
    registerModernWidgets?: (
        renderers: Record<string, ModernWidgetRenderer>
    ) => string[];
    getModernWidgetRenderer?: (
        type: string
    ) => ModernWidgetRenderer | undefined;
    debug?: boolean;
    [key: string]: unknown;
}

export interface ModernNodeConstructorLike {
    new (title?: string): unknown;
    prototype: object;
    type?: string;
    title?: string;
    category?: string;
    modernType?: string;
    readonly name: string;
}

function resolveType(nodeClass: ModernNodeConstructorLike): string {
    const type =
        nodeClass.type ||
        nodeClass.modernType ||
        ((nodeClass.prototype as Record<string, unknown>)?.type as string | undefined);
    return typeof type === "string" ? type.trim() : "";
}

function resolveLiteGraphHost(
    liteGraph?: ModernNodeRegistryLiteGraphLike
): ModernNodeRegistryLiteGraphLike {
    if (liteGraph && typeof liteGraph.registerNodeType === "function") {
        return liteGraph;
    }

    const globalLiteGraph = (
        globalThis as typeof globalThis & {
            LiteGraph?: ModernNodeRegistryLiteGraphLike;
        }
    ).LiteGraph;

    if (globalLiteGraph && typeof globalLiteGraph.registerNodeType === "function") {
        return globalLiteGraph;
    }

    throw new Error(
        "[litegraph modern] LiteGraph host is unavailable. Pass LiteGraph explicitly to registerModernNode()."
    );
}

function ensureModernMetadata(
    nodeClass: ModernNodeConstructorLike,
    liteGraph: ModernNodeRegistryLiteGraphLike
): void {
    const prototype = nodeClass.prototype as Record<string, unknown>;
    prototype.renderRuntime = "modern";
    prototype[MODERN_NODE_MARKER_KEY] = true;
    (nodeClass as unknown as { liteGraph?: ModernNodeRegistryLiteGraphLike }).liteGraph =
        liteGraph;
}

const defaultModernWidgetRegistry = new Map<string, ModernWidgetRenderer>();

export function registerModernWidget(
    type: string,
    renderer: ModernWidgetRenderer
): string {
    const normalizedType = typeof type === "string" ? type.trim() : "";
    if (!normalizedType) {
        throw new Error(
            "[litegraph modern] registerModernWidget expects a non-empty widget type."
        );
    }
    if (!renderer || typeof renderer.createView !== "function") {
        throw new Error(
            "[litegraph modern] Modern widget renderer must define createView()."
        );
    }

    defaultModernWidgetRegistry.set(normalizedType, renderer);
    return normalizedType;
}

export function registerModernWidgets(
    renderers: Record<string, ModernWidgetRenderer>
): string[] {
    const registered: string[] = [];
    for (const [type, renderer] of Object.entries(renderers || {})) {
        registered.push(registerModernWidget(type, renderer));
    }
    return registered;
}

export function getModernWidgetRenderer(
    type: string
): ModernWidgetRenderer | undefined {
    const normalizedType = typeof type === "string" ? type.trim() : "";
    return normalizedType
        ? defaultModernWidgetRegistry.get(normalizedType)
        : undefined;
}

export function registerModernNode(
    nodeClass: ModernNodeConstructorLike,
    liteGraph?: ModernNodeRegistryLiteGraphLike
): string {
    if (!nodeClass || typeof nodeClass !== "function" || !nodeClass.prototype) {
        throw new Error(
            "[litegraph modern] registerModernNode expects a class constructor."
        );
    }

    const type = resolveType(nodeClass);
    if (!type) {
        throw new Error(
            "[litegraph modern] Modern node class must declare a static type."
        );
    }

    const host = resolveLiteGraphHost(liteGraph);
    ensureModernMetadata(nodeClass, host);
    host.registerNodeType(type, nodeClass as unknown as LGraphNodeConstructorLike);

    return type;
}

export function registerModernNodes(
    nodeClasses: ReadonlyArray<ModernNodeConstructorLike>,
    liteGraph?: ModernNodeRegistryLiteGraphLike
): string[] {
    const host = resolveLiteGraphHost(liteGraph);
    const registered: string[] = [];

    for (let i = 0; i < nodeClasses.length; ++i) {
        registered.push(registerModernNode(nodeClasses[i], host));
    }

    return registered;
}

export function attachModernNodeRegistryApi(
    liteGraph: ModernNodeRegistryLiteGraphLike
): void {
    const target = liteGraph as Record<string, unknown>;
    target.registerModernNode = (nodeClass: ModernNodeConstructorLike): string =>
        registerModernNode(nodeClass, liteGraph);
    target.registerModernNodes = (
        nodeClasses: ReadonlyArray<ModernNodeConstructorLike>
    ): string[] => registerModernNodes(nodeClasses, liteGraph);
    target.registerModernWidget = (
        type: string,
        renderer: ModernWidgetRenderer
    ): string => registerModernWidget(type, renderer);
    target.registerModernWidgets = (
        renderers: Record<string, ModernWidgetRenderer>
    ): string[] => registerModernWidgets(renderers);
    target.getModernWidgetRenderer = (
        type: string
    ): ModernWidgetRenderer | undefined => getModernWidgetRenderer(type);
}
