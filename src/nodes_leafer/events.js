(function(global) {
    var LiteGraph = global && global.LiteGraph;
    var ns = LiteGraph && LiteGraph.nodes_leafer;
    if (!LiteGraph || !ns || typeof ns.registerNodeSet !== "function") {
        return;
    }

    ns.registerEventsNodes = ns.registerEventsNodes || function(host) {
        return ns.registerNodeSet("events", host || LiteGraph);
    };

    ns.registerEventsNodes(LiteGraph);
})(typeof window !== "undefined" ? window : globalThis);
