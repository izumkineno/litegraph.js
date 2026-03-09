(function(global) {
    var LiteGraph = global && global.LiteGraph;
    var ns = LiteGraph && LiteGraph.nodes_leafer;
    if (!LiteGraph || !ns || typeof ns.registerNodeSet !== "function") {
        return;
    }

    ns.registerLogicNodes = ns.registerLogicNodes || function(host) {
        return ns.registerNodeSet("logic", host || LiteGraph);
    };

    ns.registerLogicNodes(LiteGraph);
})(typeof window !== "undefined" ? window : globalThis);
