import { DefaultModernNodeBase } from "./DefaultModernNodeBase";
import { ModernNodeBase } from "./ModernNodeBase";
import { ModernNodeAuthoringUtils } from "./ModernNodeAuthoringUtils";
import { getModernWidgetRenderer, type ModernNodeConstructorLike, type ModernNodeRegistryLiteGraphLike } from "./ModernNodeRegistry";
import { ModernNodeChangeMask, ModernNodeContracts } from "./ModernNodeContracts";
declare const PENDING_MODERN_NODE_MODULES_KEY = "__LITEGRAPH_PENDING_MODERN_NODE_MODULES__";
export interface LiteGraphModernInstallHost extends ModernNodeRegistryLiteGraphLike {
    ACTION?: number;
    EVENT?: number;
    ON_TRIGGER?: number;
    ModernNodeBase?: typeof ModernNodeBase;
    DefaultModernNodeBase?: typeof DefaultModernNodeBase;
    ModernNodeContracts?: typeof ModernNodeContracts;
    ModernNodeChangeMask?: typeof ModernNodeChangeMask;
    installModernNodeModule?: (moduleDefinition: ModernNodeModuleDefinition) => string[];
    installModernNodeModules?: (moduleDefinitions: ReadonlyArray<ModernNodeModuleDefinition>) => string[];
    __litegraphInstalledModernNodeModuleIds?: Set<string>;
}
export interface ModernNodeAuthoringApi {
    readonly liteGraph: LiteGraphModernInstallHost;
    readonly ModernNodeBase: typeof ModernNodeBase;
    readonly DefaultModernNodeBase: typeof DefaultModernNodeBase;
    readonly ModernNodeChangeMask: typeof ModernNodeChangeMask;
    readonly ModernNodeContracts: typeof ModernNodeContracts;
    readonly getModernWidgetRenderer: typeof getModernWidgetRenderer;
    readonly utils: typeof ModernNodeAuthoringUtils;
}
export interface ModernNodeModuleDefinition {
    id: string;
    define: (api: ModernNodeAuthoringApi) => ReadonlyArray<ModernNodeConstructorLike>;
    __registeredTypes?: string[];
}
interface ModernNodeModuleScopeLike extends Record<string, unknown> {
    LiteGraph?: LiteGraphModernInstallHost;
    [PENDING_MODERN_NODE_MODULES_KEY]?: ModernNodeModuleDefinition[];
}
export declare function installModernNodeModule(moduleDefinition: ModernNodeModuleDefinition, liteGraph?: LiteGraphModernInstallHost): string[];
export declare function installModernNodeModules(moduleDefinitions: ReadonlyArray<ModernNodeModuleDefinition>, liteGraph?: LiteGraphModernInstallHost): string[];
export declare function queueModernNodeModule(moduleDefinition: ModernNodeModuleDefinition, scope?: ModernNodeModuleScopeLike): void;
export declare function flushPendingModernNodeModules(scope?: ModernNodeModuleScopeLike, liteGraph?: LiteGraphModernInstallHost): string[];
export declare function autoInstallModernNodeModule(moduleDefinition: ModernNodeModuleDefinition, scope?: ModernNodeModuleScopeLike): string[];
export { PENDING_MODERN_NODE_MODULES_KEY };
