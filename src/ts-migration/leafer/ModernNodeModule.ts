import { DefaultModernNodeBase } from "./DefaultModernNodeBase";
import { ModernNodeBase } from "./ModernNodeBase";
import { ModernNodeAuthoringUtils } from "./ModernNodeAuthoringUtils";
import {
    getModernWidgetRenderer,
    registerModernNodes,
    type ModernNodeConstructorLike,
    type ModernNodeRegistryLiteGraphLike,
} from "./ModernNodeRegistry";
import { ModernNodeChangeMask, ModernNodeContracts } from "./ModernNodeContracts";

const PENDING_MODERN_NODE_MODULES_KEY =
    "__LITEGRAPH_PENDING_MODERN_NODE_MODULES__";
const INSTALLED_MODERN_NODE_MODULE_IDS_KEY =
    "__litegraphInstalledModernNodeModuleIds";

export interface LiteGraphModernInstallHost
    extends ModernNodeRegistryLiteGraphLike {
    ACTION?: number;
    EVENT?: number;
    ON_TRIGGER?: number;
    ModernNodeBase?: typeof ModernNodeBase;
    DefaultModernNodeBase?: typeof DefaultModernNodeBase;
    ModernNodeContracts?: typeof ModernNodeContracts;
    ModernNodeChangeMask?: typeof ModernNodeChangeMask;
    installModernNodeModule?: (
        moduleDefinition: ModernNodeModuleDefinition
    ) => string[];
    installModernNodeModules?: (
        moduleDefinitions: ReadonlyArray<ModernNodeModuleDefinition>
    ) => string[];
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
    define: (
        api: ModernNodeAuthoringApi
    ) => ReadonlyArray<ModernNodeConstructorLike>;
    __registeredTypes?: string[];
}

interface ModernNodeModuleScopeLike extends Record<string, unknown> {
    LiteGraph?: LiteGraphModernInstallHost;
    [PENDING_MODERN_NODE_MODULES_KEY]?: ModernNodeModuleDefinition[];
}

function normalizeModuleId(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function resolveLiteGraphHost(
    liteGraph?: LiteGraphModernInstallHost
): LiteGraphModernInstallHost {
    if (liteGraph && typeof liteGraph.registerNodeType === "function") {
        return liteGraph;
    }

    const globalLike = globalThis as ModernNodeModuleScopeLike;
    if (
        globalLike.LiteGraph &&
        typeof globalLike.LiteGraph.registerNodeType === "function"
    ) {
        return globalLike.LiteGraph;
    }

    throw new Error(
        "[litegraph modern] LiteGraph host is unavailable. Pass LiteGraph explicitly to installModernNodeModule()."
    );
}

function getInstalledModuleIds(host: LiteGraphModernInstallHost): Set<string> {
    if (!(host[INSTALLED_MODERN_NODE_MODULE_IDS_KEY] instanceof Set)) {
        host[INSTALLED_MODERN_NODE_MODULE_IDS_KEY] = new Set<string>();
    }
    return host[INSTALLED_MODERN_NODE_MODULE_IDS_KEY] as Set<string>;
}

function createAuthoringApi(
    liteGraph: LiteGraphModernInstallHost
): ModernNodeAuthoringApi {
    return {
        liteGraph,
        ModernNodeBase,
        DefaultModernNodeBase,
        ModernNodeChangeMask,
        ModernNodeContracts,
        getModernWidgetRenderer,
        utils: ModernNodeAuthoringUtils,
    };
}

export function installModernNodeModule(
    moduleDefinition: ModernNodeModuleDefinition,
    liteGraph?: LiteGraphModernInstallHost
): string[] {
    if (
        !moduleDefinition ||
        typeof moduleDefinition !== "object" ||
        typeof moduleDefinition.define !== "function"
    ) {
        throw new Error(
            "[litegraph modern] installModernNodeModule expects a module definition with define()."
        );
    }

    const moduleId = normalizeModuleId(moduleDefinition.id);
    if (!moduleId) {
        throw new Error(
            "[litegraph modern] Modern node module must declare a non-empty id."
        );
    }

    const host = resolveLiteGraphHost(liteGraph);
    const installedModuleIds = getInstalledModuleIds(host);
    if (installedModuleIds.has(moduleId)) {
        return [];
    }

    const nodeClasses = moduleDefinition.define(createAuthoringApi(host));
    const registeredTypes = registerModernNodes(
        Array.isArray(nodeClasses) ? nodeClasses : [],
        host
    );

    installedModuleIds.add(moduleId);
    moduleDefinition.__registeredTypes = registeredTypes.slice();
    return registeredTypes;
}

export function installModernNodeModules(
    moduleDefinitions: ReadonlyArray<ModernNodeModuleDefinition>,
    liteGraph?: LiteGraphModernInstallHost
): string[] {
    const host = resolveLiteGraphHost(liteGraph);
    const installedTypes: string[] = [];

    for (let i = 0; i < moduleDefinitions.length; ++i) {
        installedTypes.push(
            ...installModernNodeModule(moduleDefinitions[i], host)
        );
    }

    return installedTypes;
}

export function queueModernNodeModule(
    moduleDefinition: ModernNodeModuleDefinition,
    scope: ModernNodeModuleScopeLike = globalThis as ModernNodeModuleScopeLike
): void {
    const moduleId = normalizeModuleId(moduleDefinition?.id);
    if (!moduleId) {
        return;
    }

    const queue = Array.isArray(scope[PENDING_MODERN_NODE_MODULES_KEY])
        ? scope[PENDING_MODERN_NODE_MODULES_KEY]
        : [];
    if (!queue.some((entry) => normalizeModuleId(entry?.id) === moduleId)) {
        queue.push(moduleDefinition);
    }
    scope[PENDING_MODERN_NODE_MODULES_KEY] = queue;
}

export function flushPendingModernNodeModules(
    scope: ModernNodeModuleScopeLike = globalThis as ModernNodeModuleScopeLike,
    liteGraph?: LiteGraphModernInstallHost
): string[] {
    const queue = Array.isArray(scope[PENDING_MODERN_NODE_MODULES_KEY])
        ? scope[PENDING_MODERN_NODE_MODULES_KEY]
        : [];
    if (!queue.length) {
        return [];
    }

    const host = resolveLiteGraphHost(liteGraph || scope.LiteGraph);
    scope[PENDING_MODERN_NODE_MODULES_KEY] = [];
    return installModernNodeModules(queue, host);
}

export function autoInstallModernNodeModule(
    moduleDefinition: ModernNodeModuleDefinition,
    scope: ModernNodeModuleScopeLike = globalThis as ModernNodeModuleScopeLike
): string[] {
    if (
        scope.LiteGraph &&
        typeof scope.LiteGraph.installModernNodeModule === "function"
    ) {
        return scope.LiteGraph.installModernNodeModule(moduleDefinition);
    }

    queueModernNodeModule(moduleDefinition, scope);
    return [];
}

export { PENDING_MODERN_NODE_MODULES_KEY };
