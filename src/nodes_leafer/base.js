(function(global) {
    var LiteGraph = global && global.LiteGraph;
    var ns = LiteGraph && LiteGraph.nodes_leafer;
    if (!LiteGraph || !ns || typeof ns.registerBaseNodeClass !== "function") {
        return;
    }

    function materializeModuleClasses(entry) {
        if (!entry) {
            return [];
        }
        if (entry.classes) {
            return entry.classes;
        }
        var classes = entry.createClasses ? entry.createClasses() : [];
        entry.classes = Array.isArray(classes) ? classes : [];
        return entry.classes;
    }

    function registerBaseNodes() {
        ns.registeredBaseNodeTypes = ns.registeredBaseNodeTypes || {};
        var registeredTypes = [];
        var entries = Array.isArray(ns.baseModules) ? ns.baseModules : [];

        for (var i = 0; i < entries.length; ++i) {
            var classes = materializeModuleClasses(entries[i]);
            for (var j = 0; j < classes.length; ++j) {
                var NodeClass = classes[j];
                if (!NodeClass || !NodeClass.type) {
                    continue;
                }
                if (ns.registeredBaseNodeTypes[NodeClass.type]) {
                    registeredTypes.push(NodeClass.type);
                    continue;
                }
                ns.registerBaseNodeClass(NodeClass);
                ns.registeredBaseNodeTypes[NodeClass.type] = NodeClass;
                registeredTypes.push(NodeClass.type);
            }
        }

        ns.baseNodeTypes = registeredTypes.slice();
        return registeredTypes;
    }

    ns.registerBaseNodes = registerBaseNodes;
    registerBaseNodes();
})(typeof window !== "undefined" ? window : globalThis);
