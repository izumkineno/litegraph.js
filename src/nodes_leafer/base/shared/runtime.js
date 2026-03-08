(function(global) {
    var LiteGraph = global && global.LiteGraph;
    if (!LiteGraph) {
        return;
    }

    var ns = LiteGraph.nodes_leafer || (LiteGraph.nodes_leafer = {});
    if (ns.__baseRuntimeReady) {
        return;
    }

    var ModernNodeChangeMask =
        LiteGraph.ModernNodeChangeMask || ns.ModernNodeChangeMask || {};

    var measureCanvas = null;
    var measureContext = null;

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

    function ensureMeasureContext() {
        if (measureContext) {
            return measureContext;
        }
        if (typeof document === "undefined" || !document.createElement) {
            return null;
        }
        measureCanvas = document.createElement("canvas");
        measureContext = measureCanvas.getContext("2d");
        if (measureContext) {
            measureContext.font = "14px Arial";
        }
        return measureContext;
    }

    function measureTitleWidth(text) {
        var value = String(text || "");
        var ctx = ensureMeasureContext();
        if (ctx && typeof ctx.measureText === "function") {
            return ctx.measureText(value).width;
        }
        return value.length * 7.2;
    }

    function getNodeTitle(node) {
        if (node && typeof node.getTitle === "function") {
            return String(node.getTitle() || node.title || node.type || "Node");
        }
        return String((node && (node.title || node.type)) || "Node");
    }

    function getNodeSummary(node) {
        if (!node) {
            return "";
        }

        if (typeof node.getSummaryText === "function") {
            return String(node.getSummaryText() || "");
        }

        if (Array.isArray(node.widgets) && node.widgets.length) {
            return "";
        }

        var inputCount = Array.isArray(node.inputs) ? node.inputs.length : 0;
        var outputCount = Array.isArray(node.outputs) ? node.outputs.length : 0;
        if (!inputCount && !outputCount) {
            return "";
        }
        return inputCount + " in / " + outputCount + " out";
    }

    function resolveModeBoxColor(node) {
        if (node && node.action_triggered) {
            return "#FFFFFF";
        }
        if (node && node.execute_triggered) {
            return "#AAAAAA";
        }
        if (
            node &&
            node.mode != null &&
            Array.isArray(LiteGraph.NODE_MODES_COLORS) &&
            LiteGraph.NODE_MODES_COLORS[node.mode]
        ) {
            return LiteGraph.NODE_MODES_COLORS[node.mode];
        }
        return null;
    }

    function resolveShellState(node) {
        var constructorRef = node && node.constructor ? node.constructor : {};
        return {
            title: getNodeTitle(node),
            titleMode: "default",
            titleColor:
                node.color ||
                constructorRef.title_color ||
                constructorRef.color ||
                LiteGraph.NODE_DEFAULT_COLOR ||
                "#333333",
            titleTextColor:
                node.title_text_color ||
                constructorRef.title_text_color ||
                "#F5F7FA",
            boxColor:
                node.boxcolor ||
                resolveModeBoxColor(node) ||
                LiteGraph.NODE_DEFAULT_BOXCOLOR ||
                "#666666",
            bodyColor:
                node.bgcolor ||
                constructorRef.bgcolor ||
                LiteGraph.NODE_DEFAULT_BGCOLOR ||
                "#353535",
            borderColor:
                node.outlinecolor ||
                constructorRef.outlinecolor ||
                "#1F2D3D",
            showSignalLamp: true,
            collapsible: constructorRef.collapsable !== false,
            resizable: node.resizable !== false,
            showCollapsedSlots: true,
            allowNodeHover: false,
            summaryText: getNodeSummary(node),
        };
    }

    function resolveCollapsedWidth(node) {
        var titleHeight = toFiniteNumber(LiteGraph.NODE_TITLE_HEIGHT, 30);
        var nodeWidth = Math.max(toFiniteNumber(node.size && node.size[0], 140), 80);
        return Math.min(nodeWidth, measureTitleWidth(getNodeTitle(node)) + titleHeight * 2);
    }

    function resolvePortShape(slot) {
        if (!slot) {
            return "circle";
        }
        if (
            slot.shape === LiteGraph.BOX_SHAPE ||
            slot.type === LiteGraph.EVENT ||
            slot.type === LiteGraph.ACTION
        ) {
            return "box";
        }
        if (slot.shape === LiteGraph.ARROW_SHAPE) {
            return "arrow";
        }
        if (slot.shape === LiteGraph.GRID_SHAPE) {
            return "grid";
        }
        return "circle";
    }

    function resolvePortColor(slot) {
        if (!slot) {
            return {
                colorOn: LiteGraph.LINK_COLOR || "#9A9",
                colorOff: "#6E7681",
            };
        }

        var activeColor =
            slot.type === LiteGraph.EVENT || slot.type === LiteGraph.ACTION
                ? LiteGraph.EVENT_LINK_COLOR || "#A86"
                : LiteGraph.LINK_COLOR || "#9A9";

        if (typeof slot.color_on === "string") {
            activeColor = slot.color_on;
        } else if (typeof slot.color === "string") {
            activeColor = slot.color;
        }

        return {
            colorOn: activeColor,
            colorOff: typeof slot.color_off === "string" ? slot.color_off : "#6E7681",
        };
    }

    function resolvePortPresentation(node, kind, slotIndex) {
        var slotList = kind === "input" ? node.inputs : node.outputs;
        var slot = Array.isArray(slotList) ? slotList[slotIndex] : null;
        if (!slot) {
            return null;
        }

        var colors = resolvePortColor(slot);
        return {
            label: slot.label || slot.name || "",
            shape: resolvePortShape(slot),
            dir: slot.dir,
            colorOn: colors.colorOn,
            colorOff: colors.colorOff,
            hideLabelWhenCollapsed: true,
            radius: 10,
        };
    }

    class BaseNode extends LiteGraph.ModernNodeBase {
        definePorts() {
            return buildSlotSchemaFromNode(this);
        }

        getShellState() {
            var shellState = resolveShellState(this);
            if (this.flags && this.flags.collapsed) {
                shellState.summaryText = "";
            }
            shellState.collapsedWidth = resolveCollapsedWidth(this);
            return shellState;
        }

        getPortPresentation(kind, slotIndex) {
            return resolvePortPresentation(this, kind, slotIndex);
        }

        defineActionParts() {
            return [];
        }

        mountContent() {
            return null;
        }

        patchContent() {}

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
    ns.ModernNodeBase = LiteGraph.ModernNodeBase;
    ns.ModernNodeContracts = LiteGraph.ModernNodeContracts;
    ns.ModernNodeChangeMask = ModernNodeChangeMask;
    ns.registerNode = function(nodeClass) {
        return LiteGraph.registerModernNode(nodeClass);
    };
    ns.registerNodes = function(nodeClasses) {
        return LiteGraph.registerModernNodes(nodeClasses);
    };
    ns.BaseNode = BaseNode;
    ns.buildSlotSchemaFromNode = buildSlotSchemaFromNode;
    ns.getNodeSummary = getNodeSummary;
    ns.resolveShellState = resolveShellState;
    ns.resolvePortPresentation = resolvePortPresentation;
    ns.resolveCollapsedWidth = resolveCollapsedWidth;
    ns.registerBaseNodeClass = registerBaseNodeClass;
    ns.baseModules = ns.baseModules || [];
    ns.baseModuleMap = ns.baseModuleMap || {};
    ns.registerBaseModule = registerBaseModule;
})(typeof window !== "undefined" ? window : globalThis);
