(function(global) {
    var LiteGraph = global && global.LiteGraph;
    if (!LiteGraph) {
        return;
    }

    var ns = LiteGraph.nodes_leafer || (LiteGraph.nodes_leafer = {});
    if (ns.__baseRuntimeReady) {
        return;
    }

    var MODERN_STATE_KEY =
        (LiteGraph.ModernNodeContracts &&
            LiteGraph.ModernNodeContracts.MODERN_NODE_STATE_KEY) ||
        "__litegraphModernState";

    function toFiniteNumber(value, fallback) {
        var numericValue = Number(value);
        return Number.isFinite(numericValue)
            ? numericValue
            : fallback == null
              ? 0
              : fallback;
    }

    function buildSlotSchemaFromNode(node) {
        var inputs = Array.isArray(node.inputs)
            ? node.inputs.map(function(slot) {
                  return {
                      name: String((slot && slot.name) || ""),
                      type:
                          slot && (typeof slot.type === "string" || slot.type === -1)
                              ? slot.type
                              : -1,
                  };
              })
            : [];
        var outputs = Array.isArray(node.outputs)
            ? node.outputs.map(function(slot) {
                  return {
                      name: String((slot && slot.name) || ""),
                      type:
                          slot && (typeof slot.type === "string" || slot.type === -1)
                              ? slot.type
                              : -1,
                  };
              })
            : [];

        return { inputs: inputs, outputs: outputs };
    }

    function createDefaultNodeView(context) {
        var leafer = context.leafer;
        var Group = leafer.Group;
        var Rect = leafer.Rect;
        var Text = leafer.Text;
        var node = context.node;
        var width = Math.max(toFiniteNumber(node.size && node.size[0], 180), 120);
        var height = Math.max(toFiniteNumber(node.size && node.size[1], 60), 28);
        var titleHeight = 18;
        var widgetRoot = new Group({
            name: "litegraph-modern-widget-root",
            hittable: false,
        });

        var root = new Group({
            name: "litegraph-modern-node-shell",
            hittable: false,
        });
        var titleBar = new Rect({
            x: 0,
            y: -titleHeight,
            width: width,
            height: titleHeight,
            cornerRadius: [8, 8, 0, 0],
            fill: "#101A29",
            stroke: "#32475F",
            strokeWidth: 1,
            hittable: false,
        });
        var body = new Rect({
            x: 0,
            y: 0,
            width: width,
            height: height,
            cornerRadius: 10,
            fill: "#0F1621",
            stroke: "#32475F",
            strokeWidth: 1.5,
            hittable: false,
        });
        var title = new Text({
            x: 10,
            y: -titleHeight / 2,
            text: String(node.title || node.type || "Node"),
            fontSize: 11,
            fontWeight: "bold",
            fill: "#E6EEF8",
            hittable: false,
            verticalAlign: "middle",
        });
        var summary = new Text({
            x: 10,
            y: height / 2,
            text: "",
            fontSize: 11,
            fill: "#8FA6BF",
            hittable: false,
            verticalAlign: "middle",
        });

        root.add([titleBar, body, summary, widgetRoot, title]);
        root[MODERN_STATE_KEY] = {
            titleBar: titleBar,
            body: body,
            title: title,
            summary: summary,
            widgetRoot: widgetRoot,
            layout: {
                width: width,
                height: height,
                body: { x: 0, y: 0, width: width, height: height },
                header: { x: 0, y: -titleHeight, width: width, height: titleHeight },
            },
            applyInteractionState: function(state) {
                var pressed = state && state.pressed;
                var hovered = state && state.hovered;
                titleBar.stroke = pressed
                    ? "#76A8FF"
                    : hovered
                      ? "#4E6D94"
                      : "#32475F";
                body.stroke = pressed
                    ? "#76A8FF"
                    : hovered
                      ? "#4E6D94"
                      : "#32475F";
            },
        };

        return root;
    }

    function patchDefaultNodeView(context) {
        var node = context.node;
        var content = context.content;
        var state = content && content[MODERN_STATE_KEY];
        if (!state) {
            return;
        }

        var width = Math.max(toFiniteNumber(node.size && node.size[0], 180), 120);
        var height = Math.max(toFiniteNumber(node.size && node.size[1], 60), 28);
        var hasWidgets =
            typeof node.defineWidgets === "function" &&
            node.defineWidgets().length > 0;
        if (state.titleBar) {
            state.titleBar.width = width;
        }
        state.body.width = width;
        state.body.height = height;
        state.title.text = String(node.title || node.type || "Node");
        state.summary.text = getNodeSummary(node);
        state.summary.visible = !hasWidgets;
        state.summary.y = height / 2;
        state.layout.width = width;
        state.layout.height = height;
        if (state.layout.body) {
            state.layout.body.width = width;
            state.layout.body.height = height;
        }
        if (state.layout.header) {
            state.layout.header.width = width;
        }
    }

    function getNodeSummary(node) {
        if (typeof node.getTitle === "function") {
            return "";
        }
        var inputCount = Array.isArray(node.inputs) ? node.inputs.length : 0;
        var outputCount = Array.isArray(node.outputs) ? node.outputs.length : 0;
        return inputCount + " in / " + outputCount + " out";
    }

    class BaseNode extends LiteGraph.ModernNodeBase {
        definePorts() {
            return buildSlotSchemaFromNode(this);
        }

        mountView(context) {
            return createDefaultNodeView(context);
        }

        patchView(context) {
            patchDefaultNodeView(context);
        }

        syncModernPorts() {
            this.refreshModernPorts();
        }
    }

    function registerBaseNodeClass(NodeClass) {
        if (!NodeClass || !NodeClass.type) {
            return null;
        }

        var current = LiteGraph.registered_node_types
            ? LiteGraph.registered_node_types[NodeClass.type]
            : null;
        if (current === NodeClass) {
            return NodeClass.type;
        }

        return LiteGraph.registerModernNode(NodeClass);
    }

    function registerBaseModule(moduleId, moduleFactory) {
        if (typeof moduleId === "function") {
            moduleFactory = moduleId;
            moduleId = "module:" + ns.baseModules.length;
        }

        if (typeof moduleFactory !== "function") {
            return;
        }

        if (ns.baseModuleMap[moduleId]) {
            return;
        }

        var entry = {
            id: moduleId,
            createClasses: moduleFactory,
            classes: null,
        };
        ns.baseModuleMap[moduleId] = entry;
        ns.baseModules.push(entry);
    }

    ns.__baseRuntimeReady = true;
    ns.MODERN_STATE_KEY = MODERN_STATE_KEY;
    ns.ModernNodeBase = LiteGraph.ModernNodeBase;
    ns.ModernNodeContracts = LiteGraph.ModernNodeContracts;
    ns.ModernNodeChangeMask = LiteGraph.ModernNodeChangeMask;
    ns.registerNode = function(nodeClass) {
        return LiteGraph.registerModernNode(nodeClass);
    };
    ns.registerNodes = function(nodeClasses) {
        return LiteGraph.registerModernNodes(nodeClasses);
    };
    ns.BaseNode = BaseNode;
    ns.buildSlotSchemaFromNode = buildSlotSchemaFromNode;
    ns.createDefaultNodeView = createDefaultNodeView;
    ns.patchDefaultNodeView = patchDefaultNodeView;
    ns.getNodeSummary = getNodeSummary;
    ns.registerBaseNodeClass = registerBaseNodeClass;
    ns.baseModules = ns.baseModules || [];
    ns.baseModuleMap = ns.baseModuleMap || {};
    ns.registerBaseModule = registerBaseModule;
})(typeof window !== "undefined" ? window : globalThis);
