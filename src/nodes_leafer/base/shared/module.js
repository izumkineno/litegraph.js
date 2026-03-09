(function(global) {
    var MODULE_STORE_KEY = "__litegraphNodesLeaferModules";
    var PENDING_MODERN_NODE_MODULES_KEY =
        "__LITEGRAPH_PENDING_MODERN_NODE_MODULES__";

    function ensureStore() {
        var store = global[MODULE_STORE_KEY];
        if (!store) {
            store = {
                baseModules: [],
                baseModuleMap: {},
            };
            global[MODULE_STORE_KEY] = store;
        }
        return store;
    }

    function ensureNodesLeaferNamespace() {
        var liteGraph = global && global.LiteGraph;
        var store = ensureStore();
        if (!liteGraph) {
            return store;
        }

        var ns = liteGraph.nodes_leafer || (liteGraph.nodes_leafer = {});
        ns.baseModules = ns.baseModules || store.baseModules;
        ns.baseModuleMap = ns.baseModuleMap || store.baseModuleMap;
        return ns;
    }

    function queuePendingModule(moduleDefinition) {
        var queue = Array.isArray(global[PENDING_MODERN_NODE_MODULES_KEY])
            ? global[PENDING_MODERN_NODE_MODULES_KEY]
            : [];
        var moduleId = moduleDefinition && moduleDefinition.id;
        var exists = queue.some(function(entry) {
            return entry && entry.id === moduleId;
        });
        if (!exists) {
            queue.push(moduleDefinition);
        }
        global[PENDING_MODERN_NODE_MODULES_KEY] = queue;
    }

    function installBaseNodeModule(moduleDefinition) {
        if (
            !moduleDefinition ||
            typeof moduleDefinition.id !== "string" ||
            typeof moduleDefinition.define !== "function"
        ) {
            return [];
        }

        var ns = ensureNodesLeaferNamespace();
        if (ns.baseModuleMap[moduleDefinition.id]) {
            return moduleDefinition.__registeredTypes || [];
        }

        ns.baseModuleMap[moduleDefinition.id] = moduleDefinition;
        ns.baseModules.push(moduleDefinition);

        var liteGraph = global && global.LiteGraph;
        if (
            liteGraph &&
            typeof liteGraph.installModernNodeModule === "function"
        ) {
            var registeredTypes =
                liteGraph.installModernNodeModule(moduleDefinition) || [];
            moduleDefinition.__registeredTypes = registeredTypes.slice();
            return registeredTypes;
        }

        queuePendingModule(moduleDefinition);
        return [];
    }

    function defineBaseNodeModule(moduleId, define) {
        var moduleDefinition = {
            id: moduleId,
            define: define,
        };
        installBaseNodeModule(moduleDefinition);
        return moduleDefinition;
    }

    var ns = ensureNodesLeaferNamespace();
    ns.defineBaseNodeModule = defineBaseNodeModule;
    ns.installBaseNodeModule = installBaseNodeModule;

    global.__litegraphNodesLeaferModuleSupport = {
        defineBaseNodeModule: defineBaseNodeModule,
        installBaseNodeModule: installBaseNodeModule,
    };
})(typeof window !== "undefined" ? window : globalThis);
