(function(global) {
    var LiteGraph = global && global.LiteGraph;
    var ns = LiteGraph && LiteGraph.nodes_leafer;
    if (!LiteGraph || !ns || !Array.isArray(ns.baseModules)) {
        return;
    }

    function registerBaseNodes(host) {
        var installHost = host || LiteGraph;
        if (
            !installHost ||
            typeof installHost.installModernNodeModule !== "function"
        ) {
            return [];
        }

        ns.registeredBaseNodeTypes = ns.registeredBaseNodeTypes || {};
        var registeredTypes = [];

        for (var i = 0; i < ns.baseModules.length; ++i) {
            var moduleDefinition = ns.baseModules[i];
            if (!moduleDefinition || typeof moduleDefinition.define !== "function") {
                continue;
            }

            var moduleTypes =
                installHost.installModernNodeModule(moduleDefinition) || [];
            if (!moduleTypes.length && Array.isArray(moduleDefinition.__registeredTypes)) {
                moduleTypes = moduleDefinition.__registeredTypes.slice();
            } else {
                moduleDefinition.__registeredTypes = moduleTypes.slice();
            }

            for (var j = 0; j < moduleTypes.length; ++j) {
                var type = moduleTypes[j];
                registeredTypes.push(type);
                if (installHost.registered_node_types && installHost.registered_node_types[type]) {
                    ns.registeredBaseNodeTypes[type] =
                        installHost.registered_node_types[type];
                }
            }
        }

        ns.baseNodeTypes = registeredTypes.slice();
        return registeredTypes;
    }

    ns.registerBaseNodes = registerBaseNodes;
    registerBaseNodes(LiteGraph);
})(typeof window !== "undefined" ? window : globalThis);
