(function(global) {
    var MODULE_STORE_KEY = "__litegraphNodesLeaferModules";
    var PENDING_MODERN_NODE_MODULES_KEY =
        "__LITEGRAPH_PENDING_MODERN_NODE_MODULES__";

    function normalizeSetName(value) {
        return typeof value === "string" && value.trim()
            ? value.trim().toLowerCase()
            : "base";
    }

    function capitalizeSetName(value) {
        var setName = normalizeSetName(value);
        return setName.charAt(0).toUpperCase() + setName.slice(1);
    }

    function getSetKeys(setName) {
        var safeSetName = normalizeSetName(setName);
        var capitalized = capitalizeSetName(safeSetName);
        return {
            modulesKey: safeSetName + "Modules",
            mapKey: safeSetName + "ModuleMap",
            nodeTypesKey: safeSetName + "NodeTypes",
            registeredNodeTypesKey: "registered" + capitalized + "NodeTypes",
            registerMethodKey: "register" + capitalized + "Nodes",
        };
    }

    function ensureStore() {
        var store = global[MODULE_STORE_KEY];
        if (!store) {
            store = {
                sets: {},
            };
            global[MODULE_STORE_KEY] = store;
        }
        return store;
    }

    function ensureSetStore(setName) {
        var store = ensureStore();
        var safeSetName = normalizeSetName(setName);
        if (!store.sets[safeSetName]) {
            store.sets[safeSetName] = {
                modules: [],
                moduleMap: {},
            };
        }
        return store.sets[safeSetName];
    }

    function installQueuedModule(moduleDefinition) {
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

    function ensureNodesLeaferNamespace() {
        var liteGraph = global && global.LiteGraph;
        var store = ensureStore();
        if (!liteGraph) {
            return store;
        }

        var ns = liteGraph.nodes_leafer || (liteGraph.nodes_leafer = {});
        ns.defineNodeSetModule = ns.defineNodeSetModule || defineNodeSetModule;
        ns.installNodeSetModule =
            ns.installNodeSetModule || installNodeSetModule;
        ns.registerNodeSet = ns.registerNodeSet || registerNodeSet;
        return ns;
    }

    function ensureNodeSetNamespace(setName) {
        var store = ensureSetStore(setName);
        var ns = ensureNodesLeaferNamespace();
        var keys = getSetKeys(setName);

        ns[keys.modulesKey] = ns[keys.modulesKey] || store.modules;
        ns[keys.mapKey] = ns[keys.mapKey] || store.moduleMap;
        if (typeof ns[keys.registerMethodKey] !== "function") {
            ns[keys.registerMethodKey] = function(host) {
                return registerNodeSet(setName, host);
            };
        }

        return {
            ns: ns,
            keys: keys,
        };
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

    function installNodeSetModule(setName, moduleDefinition) {
        if (
            !moduleDefinition ||
            typeof moduleDefinition.id !== "string" ||
            typeof moduleDefinition.define !== "function"
        ) {
            return [];
        }

        var info = ensureNodeSetNamespace(setName);
        var moduleMap = info.ns[info.keys.mapKey];
        var moduleList = info.ns[info.keys.modulesKey];
        if (moduleMap[moduleDefinition.id]) {
            return moduleDefinition.__registeredTypes || [];
        }

        moduleMap[moduleDefinition.id] = moduleDefinition;
        moduleList.push(moduleDefinition);
        return installQueuedModule(moduleDefinition);
    }

    function defineNodeSetModule(setName, moduleId, define) {
        var moduleDefinition = {
            id: moduleId,
            define: define,
        };
        installNodeSetModule(setName, moduleDefinition);
        return moduleDefinition;
    }

    function registerNodeSet(setName, host) {
        var info = ensureNodeSetNamespace(setName);
        var installHost = host || (global && global.LiteGraph);
        if (
            !installHost ||
            typeof installHost.installModernNodeModule !== "function"
        ) {
            return [];
        }

        info.ns[info.keys.registeredNodeTypesKey] =
            info.ns[info.keys.registeredNodeTypesKey] || {};

        var modules = info.ns[info.keys.modulesKey];
        var registeredTypes = [];
        for (var i = 0; i < modules.length; ++i) {
            var moduleDefinition = modules[i];
            if (!moduleDefinition || typeof moduleDefinition.define !== "function") {
                continue;
            }

            var moduleTypes =
                installHost.installModernNodeModule(moduleDefinition) || [];
            if (
                !moduleTypes.length &&
                Array.isArray(moduleDefinition.__registeredTypes)
            ) {
                moduleTypes = moduleDefinition.__registeredTypes.slice();
            } else {
                moduleDefinition.__registeredTypes = moduleTypes.slice();
            }

            for (var j = 0; j < moduleTypes.length; ++j) {
                var type = moduleTypes[j];
                registeredTypes.push(type);
                if (
                    installHost.registered_node_types &&
                    installHost.registered_node_types[type]
                ) {
                    info.ns[info.keys.registeredNodeTypesKey][type] =
                        installHost.registered_node_types[type];
                }
            }
        }

        info.ns[info.keys.nodeTypesKey] = registeredTypes.slice();
        return registeredTypes;
    }

    function installBaseNodeModule(moduleDefinition) {
        return installNodeSetModule("base", moduleDefinition);
    }

    function defineBaseNodeModule(moduleId, define) {
        return defineNodeSetModule("base", moduleId, define);
    }

    var ns = ensureNodesLeaferNamespace();
    ensureNodeSetNamespace("base");
    ns.defineBaseNodeModule = defineBaseNodeModule;
    ns.installBaseNodeModule = installBaseNodeModule;

    global.__litegraphNodesLeaferModuleSupport = {
        defineNodeSetModule: defineNodeSetModule,
        installNodeSetModule: installNodeSetModule,
        registerNodeSet: registerNodeSet,
        defineBaseNodeModule: defineBaseNodeModule,
        installBaseNodeModule: installBaseNodeModule,
    };
})(typeof window !== "undefined" ? window : globalThis);
