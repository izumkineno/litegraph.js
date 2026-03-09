import type { LGraphNodeConstructorLike } from "../core/litegraph.registry";
import type { ModernWidgetRenderer } from "./ModernWidgetContracts";
export interface ModernNodeRegistryLiteGraphLike {
    registerNodeType: (type: string, baseClass: LGraphNodeConstructorLike) => void;
    registered_node_types?: Record<string, unknown>;
    registerModernWidget?: (type: string, renderer: ModernWidgetRenderer) => string;
    registerModernWidgets?: (renderers: Record<string, ModernWidgetRenderer>) => string[];
    getModernWidgetRenderer?: (type: string) => ModernWidgetRenderer | undefined;
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
export declare function registerModernWidget(type: string, renderer: ModernWidgetRenderer): string;
export declare function registerModernWidgets(renderers: Record<string, ModernWidgetRenderer>): string[];
export declare function getModernWidgetRenderer(type: string): ModernWidgetRenderer | undefined;
export declare function registerModernNode(nodeClass: ModernNodeConstructorLike, liteGraph?: ModernNodeRegistryLiteGraphLike): string;
export declare function registerModernNodes(nodeClasses: ReadonlyArray<ModernNodeConstructorLike>, liteGraph?: ModernNodeRegistryLiteGraphLike): string[];
export declare function attachModernNodeRegistryApi(liteGraph: ModernNodeRegistryLiteGraphLike): void;
