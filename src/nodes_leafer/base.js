// Leafer-native mirrors for src/nodes/base.js.
// These nodes keep the legacy execution logic by inheriting the original base.js
// constructors, but render through a pure retained-mode Leafer shell.
(function(global) {
    var LiteGraph = global.LiteGraph;

    if (!LiteGraph || !LiteGraph.registerNodeType || !LiteGraph.registered_node_types) {
        return;
    }

    var SOURCE_TYPES = [
        "basic/time",
        "graph/subgraph",
        "graph/input",
        "graph/output",
        "basic/const",
        "basic/boolean",
        "basic/string",
        "basic/object",
        "basic/file",
        "basic/jsonparse",
        "basic/data",
        "basic/array",
        "basic/set_array",
        "basic/array[]",
        "basic/table[][]",
        "basic/object_property",
        "basic/object_keys",
        "basic/set_object",
        "basic/merge_objects",
        "basic/variable",
        "basic/length",
        "basic/not",
        "basic/download",
        "basic/watch",
        "basic/cast",
        "basic/console",
        "basic/alert",
        "basic/script",
        "basic/CompareValues"
    ];

    var AUTO_DIRTY_ON_EXECUTE = {
        "basic/time": true,
        "basic/watch": true,
        "basic/variable": true,
        "graph/input": true,
        "graph/output": true,
        "basic/jsonparse": true
    };

    var AUTO_DIRTY_ON_ACTION = {
        "basic/jsonparse": true,
        "basic/alert": true
    };

    var AUTO_DIRTY_ON_METHOD = {
        "basic/jsonparse": ["parse"],
        "basic/file": ["onDropFile"],
        "basic/string": ["onDropFile"]
    };

    var CATEGORY_ACCENTS = {
        graph: "#8B5CF6",
        basic: "#37A8FF"
    };

    var TYPE_ACCENTS = {
        "basic/time": "#30C6B1",
        "basic/watch": "#6EE7A8",
        "basic/const": "#4D8DFF",
        "basic/boolean": "#53D1B4",
        "basic/string": "#FFB86B",
        "basic/object": "#68B2E3",
        "basic/file": "#B695E0",
        "basic/jsonparse": "#F9C74F",
        "basic/data": "#F7A072",
        "basic/array": "#8F67FF",
        "basic/set_array": "#8F67FF",
        "basic/array[]": "#8F67FF",
        "basic/table[][]": "#8F67FF",
        "basic/object_property": "#5A9BFF",
        "basic/object_keys": "#5A9BFF",
        "basic/set_object": "#5A9BFF",
        "basic/merge_objects": "#5A9BFF",
        "basic/variable": "#4ADE80",
        "basic/download": "#FB923C",
        "basic/console": "#FB923C",
        "basic/alert": "#F97373",
        "basic/script": "#F43F5E",
        "basic/CompareValues": "#A3E635",
        "graph/subgraph": "#A855F7",
        "graph/input": "#A855F7",
        "graph/output": "#A855F7"
    };

    var UI_THEME = {
        surface: "#0B1017",
        surfaceRaised: "#101823",
        surfaceMuted: "#121C29",
        surfacePanel: "#0F1621",
        border: "#263448",
        borderSoft: "#1A2533",
        text: "#F5F8FC",
        textMuted: "#9FB0C4",
        textSoft: "#6F829A",
        textDim: "#54667D",
        success: "#59E3A7",
        warning: "#FFC857",
        danger: "#F87171"
    };

    function toFiniteNumber(value, fallback) {
        var numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : (fallback == null ? 0 : fallback);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalizeHexColor(color) {
        if (typeof color !== "string" || !color) {
            return "#000000";
        }
        if (color.charAt(0) !== "#") {
            return "#000000";
        }
        if (color.length === 4) {
            return (
                "#" +
                color.charAt(1) + color.charAt(1) +
                color.charAt(2) + color.charAt(2) +
                color.charAt(3) + color.charAt(3)
            ).toUpperCase();
        }
        return color.slice(0, 7).toUpperCase();
    }

    function hexToRgb(color) {
        var normalized = normalizeHexColor(color);
        return {
            r: parseInt(normalized.slice(1, 3), 16) || 0,
            g: parseInt(normalized.slice(3, 5), 16) || 0,
            b: parseInt(normalized.slice(5, 7), 16) || 0
        };
    }

    function rgba(color, alpha) {
        var rgb = hexToRgb(color);
        return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + clamp(alpha, 0, 1) + ")";
    }

    function mixColor(from, to, amount) {
        var source = hexToRgb(from);
        var target = hexToRgb(to);
        var t = clamp(amount, 0, 1);
        var r = Math.round(source.r + (target.r - source.r) * t);
        var g = Math.round(source.g + (target.g - source.g) * t);
        var b = Math.round(source.b + (target.b - source.b) * t);
        return (
            "#" +
            r.toString(16).padStart(2, "0") +
            g.toString(16).padStart(2, "0") +
            b.toString(16).padStart(2, "0")
        ).toUpperCase();
    }

    function darken(color, amount) {
        return mixColor(color, "#02060B", amount);
    }

    function lighten(color, amount) {
        return mixColor(color, "#FFFFFF", amount);
    }

    function cloneStaticProperties(target, source) {
        Object.getOwnPropertyNames(source).forEach(function(name) {
            if (name === "length" || name === "name" || name === "prototype") {
                return;
            }
            var descriptor = Object.getOwnPropertyDescriptor(source, name);
            if (descriptor) {
                Object.defineProperty(target, name, descriptor);
            }
        });
    }

    function toCtorName(type) {
        return String(type || "leafer_node").replace(/[^a-zA-Z0-9_$]+/g, "_");
    }

    function getTargetType(sourceType) {
        return "leafer/" + sourceType;
    }

    function getNodeType(node) {
        return String(
            node && (
                node._leaferSourceType ||
                node.sourceType ||
                node.type ||
                (node.constructor && (node.constructor.leaferSourceType || node.constructor.type))
            ) ||
            ""
        );
    }

    function getSourceType(node) {
        return getNodeType(node).replace(/^leafer\//, "") || node._leaferSourceType || "basic/node";
    }

    function markNodeDirty(node) {
        if (node && typeof node.setDirtyCanvas === "function") {
            node.setDirtyCanvas(true, true);
        }
    }

    function wrapMethodWithDirty(prototype, methodName) {
        var original = prototype[methodName];
        if (typeof original !== "function") {
            return;
        }
        prototype[methodName] = function() {
            var result = original.apply(this, arguments);
            markNodeDirty(this);
            return result;
        };
    }

    function truncateText(value, maxLength) {
        var text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
        if (!maxLength || text.length <= maxLength) {
            return text;
        }
        return text.slice(0, Math.max(0, maxLength - 3)) + "...";
    }

    function previewValue(value, depth) {
        var level = depth == null ? 0 : depth;
        if (value == null) {
            return "null";
        }
        if (typeof value === "number") {
            return Number.isInteger(value) ? String(value) : value.toFixed(3);
        }
        if (typeof value === "boolean") {
            return value ? "true" : "false";
        }
        if (typeof value === "string") {
            return truncateText(value, 44);
        }
        if (Array.isArray(value)) {
            if (!value.length) {
                return "[]";
            }
            if (level > 1) {
                return "[...]";
            }
            return "[" + value.slice(0, 4).map(function(item) {
                return previewValue(item, level + 1);
            }).join(", ") + (value.length > 4 ? ", ..." : "") + "]";
        }
        if (typeof value === "object") {
            var keys = Object.keys(value);
            if (!keys.length) {
                return "{}";
            }
            if (level > 1) {
                return "{...}";
            }
            return "{" + keys.slice(0, 3).map(function(key) {
                return key + ": " + previewValue(value[key], level + 1);
            }).join(", ") + (keys.length > 3 ? ", ..." : "") + "}";
        }
        return truncateText(String(value), 44);
    }

    function composePropertySummary(properties) {
        if (!properties) {
            return "";
        }
        var summary = [];
        Object.keys(properties).forEach(function(key) {
            var value = properties[key];
            if (value == null || value === "" || typeof value === "function") {
                return;
            }
            summary.push(key + ": " + previewValue(value, 0));
        });
        return truncateText(summary.slice(0, 2).join(" | "), 72);
    }

    function getVariableContainerName(container) {
        switch (container) {
            case 1: return "graph";
            case 2: return "global";
            default: return "litegraph";
        }
    }

    function describeSubgraph(node) {
        var subgraph = node && node.subgraph;
        var nodeCount = subgraph && Array.isArray(subgraph._nodes) ? subgraph._nodes.length : 0;
        var inputCount = node && Array.isArray(node.inputs) ? node.inputs.length : 0;
        var outputCount = node && Array.isArray(node.outputs) ? node.outputs.length : 0;
        return nodeCount + " nodes | " + inputCount + " in | " + outputCount + " out";
    }

    function describeNode(node, sourceType) {
        var properties = node && node.properties ? node.properties : null;
        switch (sourceType) {
            case "basic/time":
                return ((node && node.graph && node.graph.globaltime) || 0).toFixed(3) + " s";
            case "basic/const":
            case "basic/boolean":
            case "basic/string":
            case "basic/data":
                return previewValue(properties && properties.value, 0);
            case "basic/object":
                return previewValue(node && node._object, 0);
            case "basic/file":
                return properties && properties.url ? truncateText(properties.url, 48) : "url or dropped file";
            case "basic/jsonparse":
                return node && node._obj != null ? previewValue(node._obj, 0) : "waiting for parse()";
            case "basic/array":
                return previewValue(node && node._value, 0);
            case "basic/set_array":
            case "basic/array[]":
                return "index " + previewValue(properties && properties.index, 0);
            case "basic/table[][]":
                return "row " + previewValue(properties && properties.row, 0) + " | col " + previewValue(properties && properties.column, 0);
            case "basic/object_property":
                return "." + truncateText(properties && properties.value, 40);
            case "basic/object_keys":
                return "Object.keys(obj)";
            case "basic/set_object":
                return truncateText(properties && properties.property, 44) || "(property)";
            case "basic/merge_objects":
                return "Merge A + B";
            case "basic/variable":
                return getVariableContainerName(properties && properties.container) + "." + ((properties && properties.varname) || "value");
            case "basic/length":
                return "length(value)";
            case "basic/not":
                return "!value";
            case "basic/download":
                return (properties && properties.filename) || "data.json";
            case "basic/watch":
                return previewValue(node && node.value, 0);
            case "basic/cast":
                return "Pass-through";
            case "basic/console":
            case "basic/alert":
                return truncateText(properties && properties.msg, 48) || "message";
            case "basic/script":
                return truncateText(properties && properties.onExecute, 52);
            case "basic/CompareValues":
                return composePropertySummary(properties) || "Compare values";
            case "graph/input":
            case "graph/output":
                return ((properties && properties.name) || "(unnamed)") + " : " + ((properties && properties.type) || "*");
            case "graph/subgraph":
                return describeSubgraph(node);
            default:
                return composePropertySummary(properties) || truncateText(sourceType, 52);
        }
    }

    function describeFooter(node, sourceType) {
        if (sourceType === "graph/subgraph") {
            return "Double click to inspect subgraph";
        }
        var inputs = node && Array.isArray(node.inputs) ? node.inputs.length : 0;
        var outputs = node && Array.isArray(node.outputs) ? node.outputs.length : 0;
        var widgets = node && Array.isArray(node.widgets) ? node.widgets.length : 0;
        var footer = [inputs + " in", outputs + " out"];
        if (widgets) {
            footer.push(widgets + " widgets");
        }
        return footer.join(" | ");
    }

    function resolveAccentColor(node, sourceType) {
        if (node && typeof node.boxcolor === "string" && node.boxcolor) {
            return normalizeHexColor(node.boxcolor);
        }
        if (TYPE_ACCENTS[sourceType]) {
            return TYPE_ACCENTS[sourceType];
        }
        var category = String(sourceType).split("/")[0];
        return CATEGORY_ACCENTS[category] || "#37A8FF";
    }

    function resolveSlotColor(slot, isInput) {
        var slotType = slot && slot.type;
        if (slotType === LiteGraph.EVENT || slotType === LiteGraph.ACTION || slotType === "_event_") {
            return "#FFC857";
        }
        if (slotType === "number") {
            return "#5AA2FF";
        }
        if (slotType === "boolean") {
            return "#59E3A7";
        }
        if (slotType === "string") {
            return "#FFB86B";
        }
        if (slotType === "array" || slotType === "table") {
            return "#A855F7";
        }
        if (slotType === "object") {
            return "#68B2E3";
        }
        return isInput ? "#71839A" : "#D2E3FF";
    }

    function getNodeCategoryLabel(sourceType) {
        var parts = String(sourceType || "").split("/");
        var category = parts[0] || "node";
        if (parts[1]) {
            return category.toUpperCase() + " / " + parts[1].toUpperCase();
        }
        return category.toUpperCase();
    }

    function getWidgetRowHeight(widget) {
        switch (widget && widget.type) {
            case "button":
                return 30;
            case "toggle":
                return 30;
            case "number":
            case "combo":
            case "string":
            case "text":
                return 32;
            default:
                return 28;
        }
    }

    function setNodeSize(node, width, height) {
        if (!node.size || (!Array.isArray(node.size) && !ArrayBuffer.isView(node.size))) {
            node.size = [width, height];
            return;
        }
        node.size[0] = width;
        node.size[1] = height;
    }

    function computeNodeVisualSize(node) {
        var computed = null;
        if (node && typeof node.computeSize === "function" && !(node.flags && node.flags.collapsed)) {
            try {
                computed = node.computeSize();
            } catch (_error) {
                computed = null;
            }
        }

        var currentWidth = toFiniteNumber(node && node.size && node.size[0], 0);
        var currentHeight = toFiniteNumber(node && node.size && node.size[1], 0);
        var computedWidth = toFiniteNumber(computed && computed[0], 0);
        var computedHeight = toFiniteNumber(computed && computed[1], 0);
        var slotCount = Math.max(
            node && Array.isArray(node.inputs) ? node.inputs.length : 0,
            node && Array.isArray(node.outputs) ? node.outputs.length : 0,
            1
        );
        var widgetList = Array.isArray(node && node.widgets) ? node.widgets : [];
        var widgetHeight = widgetList.reduce(function(total, widget, index) {
            return total + getWidgetRowHeight(widget) + (index ? 8 : 0);
        }, 0);
        var collapsed = !!(node && node.flags && node.flags.collapsed);
        var minWidth = Math.max(210, computedWidth, currentWidth);
        var minHeight = collapsed
            ? Math.max(46, currentHeight, computedHeight)
            : Math.max(
                122 + slotCount * 22 + widgetHeight,
                currentHeight,
                computedHeight,
                136
            );

        setNodeSize(node, minWidth, minHeight);
        return {
            width: minWidth,
            height: minHeight
        };
    }

    function buildPortLayouts(node, kind, layout) {
        var isInput = kind === "input";
        var slots = Array.isArray(isInput ? node.inputs : node.outputs) ? (isInput ? node.inputs : node.outputs) : [];
        var count = slots.length;
        var result = [];
        if (!count) {
            return result;
        }

        var labelWidth = Math.max(64, Math.floor(layout.width * 0.36));
        var y = layout.header.height + 18;
        var step = 22;

        for (var i = 0; i < count; ++i) {
            var centerY = y + i * step;
            var centerX = isInput ? 12 : layout.width - 12;
            result.push({
                index: i,
                x: centerX - 10,
                y: centerY - 10,
                width: 20,
                height: 20,
                radius: 12,
                dir: isInput ? 4 : 2,
                labelX: isInput ? 28 : layout.width - labelWidth - 28,
                labelY: centerY - 7,
                labelWidth: labelWidth,
                labelAlign: isInput ? "left" : "right"
            });
        }

        return result;
    }

    function buildWidgetLayouts(node, layout) {
        var widgets = Array.isArray(node && node.widgets) ? node.widgets : [];
        var result = [];
        if (!widgets.length || (node.flags && node.flags.collapsed)) {
            return result;
        }

        var width = layout.width - 28;
        var x = 14;
        var top = layout.header.height + 22 + Math.max(layout.inputPorts.length, layout.outputPorts.length) * 22 + 18;

        for (var i = 0; i < widgets.length; ++i) {
            var widget = widgets[i] || {};
            var rowHeight = getWidgetRowHeight(widget);
            var row = {
                index: i,
                x: x,
                y: top,
                width: width,
                height: rowHeight,
                action: "activate",
                actionZones: {}
            };
            var valueWidth = Math.min(112, Math.max(84, Math.floor(width * 0.42)));
            var rightInset = row.x + row.width - 12;

            switch (widget.type) {
                case "toggle":
                    row.action = "toggle";
                    row.actionZones.toggle = {
                        x: rightInset - 50,
                        y: row.y + 6,
                        width: 42,
                        height: 18
                    };
                    break;
                case "number":
                case "combo":
                    row.action = "edit";
                    row.actionZones.decrement = {
                        x: rightInset - valueWidth,
                        y: row.y + 5,
                        width: 24,
                        height: row.height - 10
                    };
                    row.actionZones.edit = {
                        x: rightInset - valueWidth + 24,
                        y: row.y + 5,
                        width: valueWidth - 48,
                        height: row.height - 10
                    };
                    row.actionZones.increment = {
                        x: rightInset - 24,
                        y: row.y + 5,
                        width: 24,
                        height: row.height - 10
                    };
                    break;
                case "string":
                case "text":
                    row.action = "edit";
                    row.actionZones.edit = {
                        x: rightInset - valueWidth,
                        y: row.y + 5,
                        width: valueWidth,
                        height: row.height - 10
                    };
                    break;
                case "button":
                    row.action = "activate";
                    row.actionZones.activate = {
                        x: row.x,
                        y: row.y,
                        width: row.width,
                        height: row.height
                    };
                    break;
                default:
                    row.action = widget.options && widget.options.property ? "edit" : "activate";
                    row.actionZones[row.action] = {
                        x: rightInset - valueWidth,
                        y: row.y + 5,
                        width: valueWidth,
                        height: row.height - 10
                    };
                    break;
            }

            result.push(row);
            top += rowHeight + 8;
        }

        return result;
    }

    function buildShellLayout(node, sourceType) {
        var size = computeNodeVisualSize(node);
        var collapsed = !!(node && node.flags && node.flags.collapsed);
        var headerHeight = collapsed ? 46 : 54;
        var footerHeight = collapsed ? 0 : 24;
        var layout = {
            width: size.width,
            height: size.height,
            header: {
                x: 0,
                y: 0,
                width: size.width,
                height: headerHeight
            },
            body: collapsed ? null : {
                x: 0,
                y: headerHeight,
                width: size.width,
                height: Math.max(0, size.height - headerHeight - footerHeight)
            },
            collapse: {
                x: size.width - 32,
                y: 12,
                width: 20,
                height: 20
            },
            resize: {
                x: size.width - 18,
                y: size.height - 18,
                width: 14,
                height: 14
            },
            sourceType: sourceType
        };

        layout.inputPorts = buildPortLayouts(node, "input", layout);
        layout.outputPorts = buildPortLayouts(node, "output", layout);
        layout.widgets = buildWidgetLayouts(node, layout);

        return layout;
    }

    function createText(leafer, config) {
        return new leafer.Text(Object.assign({
            hittable: false
        }, config));
    }

    function createRect(leafer, config) {
        return new leafer.Rect(Object.assign({
            hittable: false
        }, config));
    }

    function createPortView(leafer) {
        var group = new leafer.Group({ hittable: false });
        var glow = createRect(leafer, {
            x: 0,
            y: 0,
            width: 20,
            height: 20,
            cornerRadius: 10,
            fill: "#FFFFFF",
            opacity: 0
        });
        var pin = new leafer.Ellipse({
            x: 5,
            y: 5,
            width: 10,
            height: 10,
            fill: "#8FA6C3",
            stroke: "#0A0F15",
            strokeWidth: 1,
            hittable: false
        });
        var label = createText(leafer, {
            x: 0,
            y: 0,
            width: 80,
            fontSize: 11,
            fontFamily: "IBM Plex Sans, Arial",
            fill: UI_THEME.textMuted
        });
        var badge = createText(leafer, {
            x: 0,
            y: 0,
            width: 54,
            fontSize: 9,
            fontFamily: "JetBrains Mono, monospace",
            fill: UI_THEME.textDim
        });
        group.add([glow, pin, label, badge]);
        return {
            root: group,
            glow: glow,
            pin: pin,
            label: label,
            badge: badge
        };
    }

    function createWidgetView(leafer) {
        var group = new leafer.Group({ hittable: false });
        var chrome = createRect(leafer, {
            x: 0,
            y: 0,
            width: 100,
            height: 30,
            cornerRadius: 10,
            fill: UI_THEME.surfaceMuted,
            stroke: UI_THEME.borderSoft,
            strokeWidth: 1
        });
        var accent = createRect(leafer, {
            x: 0,
            y: 0,
            width: 3,
            height: 30,
            cornerRadius: 10,
            fill: "#37A8FF",
            opacity: 0.8
        });
        var label = createText(leafer, {
            x: 12,
            y: 8,
            width: 112,
            fontSize: 11,
            fontWeight: "600",
            fontFamily: "IBM Plex Sans, Arial",
            fill: UI_THEME.text
        });
        var meta = createText(leafer, {
            x: 12,
            y: 18,
            width: 120,
            fontSize: 9,
            fontFamily: "JetBrains Mono, monospace",
            fill: UI_THEME.textDim
        });
        var valueBox = createRect(leafer, {
            x: 120,
            y: 5,
            width: 88,
            height: 20,
            cornerRadius: 8,
            fill: UI_THEME.surface,
            stroke: UI_THEME.border,
            strokeWidth: 1
        });
        var valueText = createText(leafer, {
            x: 126,
            y: 10,
            width: 76,
            fontSize: 11,
            textAlign: "center",
            fontFamily: "JetBrains Mono, monospace",
            fill: UI_THEME.textMuted
        });
        var leftBox = createRect(leafer, {
            x: 120,
            y: 5,
            width: 22,
            height: 20,
            cornerRadius: 8,
            fill: UI_THEME.surface,
            stroke: UI_THEME.border,
            strokeWidth: 1,
            visible: false
        });
        var leftText = createText(leafer, {
            x: 126,
            y: 9,
            width: 10,
            fontSize: 12,
            textAlign: "center",
            fontFamily: "JetBrains Mono, monospace",
            fill: UI_THEME.textMuted,
            visible: false
        });
        var rightBox = createRect(leafer, {
            x: 186,
            y: 5,
            width: 22,
            height: 20,
            cornerRadius: 8,
            fill: UI_THEME.surface,
            stroke: UI_THEME.border,
            strokeWidth: 1,
            visible: false
        });
        var rightText = createText(leafer, {
            x: 192,
            y: 9,
            width: 10,
            fontSize: 12,
            textAlign: "center",
            fontFamily: "JetBrains Mono, monospace",
            fill: UI_THEME.textMuted,
            visible: false
        });
        var track = createRect(leafer, {
            x: 164,
            y: 7,
            width: 42,
            height: 16,
            cornerRadius: 8,
            fill: UI_THEME.surface,
            stroke: UI_THEME.border,
            strokeWidth: 1,
            visible: false
        });
        var knob = new leafer.Ellipse({
            x: 166,
            y: 8,
            width: 14,
            height: 14,
            fill: UI_THEME.textMuted,
            hittable: false,
            visible: false
        });
        group.add([
            chrome,
            accent,
            label,
            meta,
            valueBox,
            valueText,
            leftBox,
            leftText,
            rightBox,
            rightText,
            track,
            knob
        ]);
        return {
            root: group,
            chrome: chrome,
            accent: accent,
            label: label,
            meta: meta,
            valueBox: valueBox,
            valueText: valueText,
            leftBox: leftBox,
            leftText: leftText,
            rightBox: rightBox,
            rightText: rightText,
            track: track,
            knob: knob
        };
    }

    function ensureShell(context, node, sourceType) {
        var content = context.content;
        if (content && content.__litegraphModernState) {
            return content;
        }

        var leafer = context.leafer;
        var shell = new leafer.Group({
            name: "litegraph.modern.shell:" + sourceType,
            hittable: false
        });
        var state = {
            accent: resolveAccentColor(node, sourceType),
            frame: createRect(leafer, {
                x: 0,
                y: 0,
                width: 220,
                height: 140,
                cornerRadius: 16,
                fill: UI_THEME.surface,
                stroke: UI_THEME.border,
                strokeWidth: 1.5
            }),
            frameOutline: createRect(leafer, {
                x: 1,
                y: 1,
                width: 218,
                height: 138,
                cornerRadius: 15,
                fill: "transparent",
                stroke: rgba("#FFFFFF", 0.02),
                strokeWidth: 1
            }),
            header: createRect(leafer, {
                x: 0,
                y: 0,
                width: 220,
                height: 54,
                cornerRadius: 16,
                fill: UI_THEME.surfaceRaised
            }),
            headerDivider: createRect(leafer, {
                x: 0,
                y: 53,
                width: 220,
                height: 1,
                fill: UI_THEME.borderSoft
            }),
            accentRail: createRect(leafer, {
                x: 0,
                y: 0,
                width: 5,
                height: 140,
                cornerRadius: 16,
                fill: "#37A8FF"
            }),
            title: createText(leafer, {
                x: 18,
                y: 10,
                width: 160,
                fontSize: 16,
                fontWeight: "700",
                fontFamily: "IBM Plex Sans, Arial",
                fill: UI_THEME.text
            }),
            subtitle: createText(leafer, {
                x: 18,
                y: 30,
                width: 156,
                fontSize: 10,
                fontFamily: "JetBrains Mono, monospace",
                fill: UI_THEME.textSoft
            }),
            categoryChip: createRect(leafer, {
                x: 18,
                y: 58,
                width: 96,
                height: 18,
                cornerRadius: 9,
                fill: rgba("#37A8FF", 0.12),
                stroke: rgba("#37A8FF", 0.22),
                strokeWidth: 1
            }),
            categoryText: createText(leafer, {
                x: 26,
                y: 63,
                width: 84,
                fontSize: 9,
                fontFamily: "JetBrains Mono, monospace",
                fill: UI_THEME.textMuted
            }),
            summary: createText(leafer, {
                x: 18,
                y: 86,
                width: 184,
                fontSize: 12,
                fontFamily: "IBM Plex Sans, Arial",
                fill: UI_THEME.textMuted
            }),
            footer: createText(leafer, {
                x: 18,
                y: 0,
                width: 184,
                fontSize: 10,
                fontFamily: "JetBrains Mono, monospace",
                fill: UI_THEME.textDim
            }),
            collapseBg: createRect(leafer, {
                x: 188,
                y: 12,
                width: 20,
                height: 20,
                cornerRadius: 6,
                fill: UI_THEME.surfacePanel,
                stroke: UI_THEME.border,
                strokeWidth: 1
            }),
            collapseGlyph: createText(leafer, {
                x: 193,
                y: 16,
                width: 10,
                fontSize: 12,
                textAlign: "center",
                fontFamily: "JetBrains Mono, monospace",
                fill: UI_THEME.textMuted
            }),
            resizeLineA: createRect(leafer, {
                x: 0,
                y: 0,
                width: 8,
                height: 1.5,
                cornerRadius: 1,
                fill: UI_THEME.textDim
            }),
            resizeLineB: createRect(leafer, {
                x: 0,
                y: 0,
                width: 5,
                height: 1.5,
                cornerRadius: 1,
                fill: UI_THEME.textDim
            }),
            portLayer: new leafer.Group({ hittable: false }),
            widgetLayer: new leafer.Group({ hittable: false }),
            inputPortViews: [],
            outputPortViews: [],
            widgetViews: [],
            layout: null,
            applyInteractionState: function(interaction) {
                applyInteractionState(node, state, interaction);
            }
        };

        shell.add([
            state.frame,
            state.frameOutline,
            state.header,
            state.headerDivider,
            state.accentRail,
            state.title,
            state.subtitle,
            state.categoryChip,
            state.categoryText,
            state.summary,
            state.footer,
            state.portLayer,
            state.widgetLayer,
            state.collapseBg,
            state.collapseGlyph,
            state.resizeLineA,
            state.resizeLineB
        ]);

        shell.__litegraphModernState = state;
        return shell;
    }

    function matchPart(part, kind, index, action) {
        return !!(
            part &&
            part.kind === kind &&
            (index == null || part.index === index) &&
            (action == null || part.action === action)
        );
    }

    function setControlState(rect, hover, press) {
        rect.state = press ? "press" : (hover ? "hover" : "");
    }

    function syncPortLayer(leafer, layer, views, layouts, slots, isInput) {
        while (views.length < layouts.length) {
            var nextView = createPortView(leafer);
            layer.add(nextView.root);
            views.push(nextView);
        }

        while (views.length > layouts.length) {
            views.pop().root.destroy();
        }

        for (var i = 0; i < layouts.length; ++i) {
            var layout = layouts[i];
            var slot = slots[i] || {};
            var view = views[i];
            view.root.x = layout.x;
            view.root.y = layout.y;
            view.glow.width = layout.width;
            view.glow.height = layout.height;
            view.glow.cornerRadius = layout.height * 0.5;
            view.pin.x = layout.width * 0.5 - 5;
            view.pin.y = layout.height * 0.5 - 5;
            view.pin.fill = resolveSlotColor(slot, isInput);
            view.label.x = layout.labelX - layout.x;
            view.label.y = layout.labelY - layout.y;
            view.label.width = layout.labelWidth;
            view.label.textAlign = layout.labelAlign;
            view.label.text = truncateText(slot.label || slot.name || ((isInput ? "input " : "output ") + i), 24);
            view.badge.x = layout.labelX - layout.x;
            view.badge.y = layout.labelY - layout.y + 11;
            view.badge.width = layout.labelWidth;
            view.badge.textAlign = layout.labelAlign;
            view.badge.text = truncateText(slot.type == null ? "*" : slot.type, 10).toUpperCase();
        }
    }

    function syncWidgetLayer(leafer, layer, views, layouts, widgets, accent) {
        while (views.length < layouts.length) {
            var nextView = createWidgetView(leafer);
            layer.add(nextView.root);
            views.push(nextView);
        }

        while (views.length > layouts.length) {
            views.pop().root.destroy();
        }

        for (var i = 0; i < layouts.length; ++i) {
            var layout = layouts[i];
            var widget = widgets[i] || {};
            var view = views[i];
            var widgetType = widget.type || "value";
            var value = widget.type === "button"
                ? "RUN"
                : widget.type === "toggle"
                    ? (widget.value ? "ON" : "OFF")
                    : previewValue(widget.value, 0);
            var editZone = layout.actionZones.edit;
            var decrementZone = layout.actionZones.decrement;
            var incrementZone = layout.actionZones.increment;
            var toggleZone = layout.actionZones.toggle;

            view.root.x = layout.x;
            view.root.y = layout.y;
            view.chrome.width = layout.width;
            view.chrome.height = layout.height;
            view.accent.height = layout.height;
            view.accent.fill = accent;
            view.label.text = truncateText(widget.name || widgetType, 20);
            view.meta.text = truncateText(widgetType.toUpperCase(), 14);
            view.valueText.text = truncateText(value, widget.type === "button" ? 10 : 18);
            view.valueText.visible = Boolean(editZone || widget.type === "button");

            view.valueBox.visible = Boolean(editZone || widget.type === "button");
            view.leftBox.visible = Boolean(decrementZone);
            view.leftText.visible = Boolean(decrementZone);
            view.rightBox.visible = Boolean(incrementZone);
            view.rightText.visible = Boolean(incrementZone);
            view.track.visible = Boolean(toggleZone);
            view.knob.visible = Boolean(toggleZone);

            if (widget.type === "button") {
                view.chrome.fill = accent;
                view.chrome.stroke = lighten(accent, 0.18);
                view.label.fill = "#07101A";
                view.meta.fill = rgba("#07101A", 0.72);
                view.valueBox.x = layout.width - 74;
                view.valueBox.y = 5;
                view.valueBox.width = 60;
                view.valueBox.height = layout.height - 10;
                view.valueBox.fill = rgba("#07101A", 0.14);
                view.valueBox.stroke = rgba("#07101A", 0.18);
                view.valueText.x = layout.width - 68;
                view.valueText.y = 9;
                view.valueText.width = 48;
                view.valueText.fill = "#07101A";
            } else if (widget.type === "toggle") {
                view.chrome.fill = UI_THEME.surfaceMuted;
                view.chrome.stroke = UI_THEME.borderSoft;
                view.label.fill = UI_THEME.text;
                view.meta.fill = UI_THEME.textDim;
                view.valueText.visible = false;
                view.track.x = toggleZone.x - layout.x;
                view.track.y = toggleZone.y - layout.y;
                view.track.width = toggleZone.width;
                view.track.height = toggleZone.height;
                view.track.fill = widget.value ? rgba(accent, 0.26) : UI_THEME.surface;
                view.track.stroke = widget.value ? rgba(accent, 0.5) : UI_THEME.border;
                view.knob.x = widget.value
                    ? view.track.x + view.track.width - 16
                    : view.track.x + 2;
                view.knob.y = view.track.y + 2;
                view.knob.fill = widget.value ? lighten(accent, 0.22) : UI_THEME.textSoft;
            } else {
                view.chrome.fill = UI_THEME.surfaceMuted;
                view.chrome.stroke = UI_THEME.borderSoft;
                view.label.fill = UI_THEME.text;
                view.meta.fill = UI_THEME.textDim;

                if (editZone) {
                    view.valueBox.x = editZone.x - layout.x;
                    view.valueBox.y = editZone.y - layout.y;
                    view.valueBox.width = editZone.width;
                    view.valueBox.height = editZone.height;
                    view.valueBox.fill = UI_THEME.surface;
                    view.valueBox.stroke = UI_THEME.border;
                    view.valueText.x = view.valueBox.x + 6;
                    view.valueText.y = view.valueBox.y + 5;
                    view.valueText.width = view.valueBox.width - 12;
                    view.valueText.fill = UI_THEME.textMuted;
                }
                if (decrementZone) {
                    view.leftBox.x = decrementZone.x - layout.x;
                    view.leftBox.y = decrementZone.y - layout.y;
                    view.leftBox.width = decrementZone.width;
                    view.leftBox.height = decrementZone.height;
                    view.leftText.x = view.leftBox.x + 6;
                    view.leftText.y = view.leftBox.y + 5;
                    view.leftText.text = "-";
                }
                if (incrementZone) {
                    view.rightBox.x = incrementZone.x - layout.x;
                    view.rightBox.y = incrementZone.y - layout.y;
                    view.rightBox.width = incrementZone.width;
                    view.rightBox.height = incrementZone.height;
                    view.rightText.x = view.rightBox.x + 6;
                    view.rightText.y = view.rightBox.y + 5;
                    view.rightText.text = widget.type === "combo" ? "v" : "+";
                }
            }
        }
    }

    function updateShell(context, shell, node, sourceType) {
        var state = shell.__litegraphModernState;
        var leafer = context.leafer;
        var accent = resolveAccentColor(node, sourceType);
        var layout = buildShellLayout(node, sourceType);
        var collapsed = !!(node && node.flags && node.flags.collapsed);
        var inputs = Array.isArray(node && node.inputs) ? node.inputs : [];
        var outputs = Array.isArray(node && node.outputs) ? node.outputs : [];
        var widgets = Array.isArray(node && node.widgets) ? node.widgets : [];
        var title = typeof node.getTitle === "function" ? node.getTitle() : (node.title || sourceType);

        state.accent = accent;
        state.layout = layout;

        state.frame.width = layout.width;
        state.frame.height = layout.height;
        state.frameOutline.width = Math.max(1, layout.width - 2);
        state.frameOutline.height = Math.max(1, layout.height - 2);
        state.header.width = layout.header.width;
        state.header.height = layout.header.height;
        state.headerDivider.y = layout.header.height - 1;
        state.headerDivider.width = layout.width;
        state.accentRail.height = layout.height;
        state.accentRail.fill = accent;
        state.title.text = truncateText(title || sourceType, 28);
        state.subtitle.text = truncateText(sourceType, 28).toUpperCase();
        state.categoryChip.width = Math.max(72, Math.min(118, getNodeCategoryLabel(sourceType).length * 7 + 16));
        state.categoryChip.fill = rgba(accent, 0.12);
        state.categoryChip.stroke = rgba(accent, 0.26);
        state.categoryText.width = state.categoryChip.width - 10;
        state.categoryText.text = getNodeCategoryLabel(sourceType);
        state.summary.text = truncateText(describeNode(node, sourceType), collapsed ? 36 : 84);
        state.summary.visible = !collapsed;
        state.footer.text = describeFooter(node, sourceType);
        state.footer.y = layout.height - 16;
        state.footer.visible = !collapsed;
        state.collapseBg.x = layout.collapse.x;
        state.collapseBg.y = layout.collapse.y;
        state.collapseGlyph.x = layout.collapse.x + 5;
        state.collapseGlyph.y = layout.collapse.y + 4;
        state.collapseGlyph.text = collapsed ? "+" : "-";
        state.resizeLineA.x = layout.resize.x + 2;
        state.resizeLineA.y = layout.resize.y + 9;
        state.resizeLineB.x = layout.resize.x + 5;
        state.resizeLineB.y = layout.resize.y + 4;
        state.resizeLineA.visible = !collapsed;
        state.resizeLineB.visible = !collapsed;

        syncPortLayer(leafer, state.portLayer, state.inputPortViews, layout.inputPorts, inputs, true);
        syncPortLayer(leafer, state.portLayer, state.outputPortViews, layout.outputPorts, outputs, false);
        syncWidgetLayer(leafer, state.widgetLayer, state.widgetViews, layout.widgets, widgets, accent);
        state.widgetLayer.visible = !collapsed && layout.widgets.length > 0;

        state.applyInteractionState(context.interactionState);
    }

    function applyInteractionState(node, state, interaction) {
        var accent = state.accent || "#37A8FF";
        var isSelected = !!(node && node.is_selected);
        var hoveredPart = interaction && interaction.hoveredPart;
        var pressedPart = interaction && interaction.pressedPart;
        var hovered = !!(interaction && interaction.hovered);
        var pressed = !!(interaction && interaction.pressed);
        var dragging = !!(interaction && interaction.dragging);
        var resizing = !!(interaction && interaction.resizing);

        state.frame.fill = hovered ? darken(accent, 0.88) : UI_THEME.surface;
        state.frame.stroke = isSelected
            ? lighten(accent, 0.18)
            : hovered
                ? rgba(accent, 0.5)
                : UI_THEME.border;
        state.frameOutline.stroke = isSelected ? rgba("#FFFFFF", 0.08) : rgba("#FFFFFF", 0.02);
        state.header.fill = dragging || resizing
            ? darken(accent, 0.78)
            : hovered
                ? darken(accent, 0.84)
                : UI_THEME.surfaceRaised;
        state.headerDivider.fill = hovered ? rgba(accent, 0.24) : UI_THEME.borderSoft;
        state.title.fill = isSelected ? "#FFFFFF" : UI_THEME.text;
        state.subtitle.fill = hovered ? lighten(accent, 0.36) : UI_THEME.textSoft;
        state.summary.fill = hovered ? "#D8E4F5" : UI_THEME.textMuted;
        state.footer.fill = isSelected ? "#B7CAE4" : UI_THEME.textDim;

        setControlState(
            state.collapseBg,
            matchPart(hoveredPart, "collapse"),
            matchPart(pressedPart, "collapse")
        );
        state.collapseBg.fill = matchPart(pressedPart, "collapse")
            ? rgba(accent, 0.32)
            : matchPart(hoveredPart, "collapse")
                ? rgba(accent, 0.18)
                : UI_THEME.surfacePanel;
        state.collapseBg.stroke = matchPart(hoveredPart, "collapse") ? rgba(accent, 0.42) : UI_THEME.border;
        state.collapseGlyph.fill = matchPart(hoveredPart, "collapse") ? lighten(accent, 0.28) : UI_THEME.textMuted;
        state.resizeLineA.fill = resizing || matchPart(hoveredPart, "resize") ? lighten(accent, 0.18) : UI_THEME.textDim;
        state.resizeLineB.fill = resizing || matchPart(hoveredPart, "resize") ? lighten(accent, 0.28) : UI_THEME.textDim;

        state.inputPortViews.forEach(function(view, index) {
            var active = matchPart(hoveredPart, "input-port", index) || matchPart(pressedPart, "input-port", index);
            view.glow.opacity = active ? 0.18 : 0;
            view.glow.fill = accent;
            view.label.fill = active ? "#FFFFFF" : UI_THEME.textMuted;
            view.badge.fill = active ? lighten(accent, 0.28) : UI_THEME.textDim;
            view.pin.stroke = active ? lighten(accent, 0.24) : "#0A0F15";
        });

        state.outputPortViews.forEach(function(view, index) {
            var active = matchPart(hoveredPart, "output-port", index) || matchPart(pressedPart, "output-port", index);
            view.glow.opacity = active ? 0.18 : 0;
            view.glow.fill = accent;
            view.label.fill = active ? "#FFFFFF" : UI_THEME.textMuted;
            view.badge.fill = active ? lighten(accent, 0.28) : UI_THEME.textDim;
            view.pin.stroke = active ? lighten(accent, 0.24) : "#0A0F15";
        });

        state.widgetViews.forEach(function(view, index) {
            var widgetPressed = matchPart(pressedPart, "widget", index);
            var widgetHovered = matchPart(hoveredPart, "widget", index);
            var hoveredAction = widgetHovered ? hoveredPart.action : null;
            var pressedAction = widgetPressed ? pressedPart.action : null;
            var isButton = view.valueText.text === "RUN" || view.chrome.fill === accent;

            if (!isButton) {
                view.chrome.fill = widgetHovered ? UI_THEME.surfaceRaised : UI_THEME.surfaceMuted;
                view.chrome.stroke = widgetPressed ? rgba(accent, 0.56) : (widgetHovered ? rgba(accent, 0.3) : UI_THEME.borderSoft);
                view.label.fill = widgetHovered ? "#FFFFFF" : UI_THEME.text;
            } else {
                view.chrome.fill = widgetPressed ? lighten(accent, 0.08) : accent;
                view.chrome.stroke = widgetHovered ? lighten(accent, 0.2) : lighten(accent, 0.12);
            }

            view.valueBox.stroke = (hoveredAction === "edit" || pressedAction === "edit") ? rgba(accent, 0.5) : UI_THEME.border;
            view.leftBox.stroke = (hoveredAction === "decrement" || pressedAction === "decrement") ? rgba(accent, 0.5) : UI_THEME.border;
            view.rightBox.stroke = (hoveredAction === "increment" || pressedAction === "increment") ? rgba(accent, 0.5) : UI_THEME.border;
            view.track.stroke = (hoveredAction === "toggle" || pressedAction === "toggle") ? rgba(accent, 0.56) : UI_THEME.border;
        });

        if (!pressed && !dragging && !resizing && hoveredPart && (hoveredPart.kind === "body" || hoveredPart.kind === "header")) {
            state.frame.stroke = isSelected ? lighten(accent, 0.18) : rgba(accent, 0.5);
        }
    }

    function buildUI(context) {
        var sourceType = getSourceType(this);
        var shell = ensureShell(context, this, sourceType);
        updateShell(context, shell, this, sourceType);
        return shell;
    }

    function updateUI(context) {
        var sourceType = getSourceType(this);
        var shell = ensureShell(context, this, sourceType);
        updateShell(context, shell, this, sourceType);
    }

    function getPortLayout(kind, slotIndex, context) {
        var sourceType = getSourceType(this);
        var state = context && context.content && context.content.__litegraphModernState;
        var layout = state && state.layout ? state.layout : buildShellLayout(this, sourceType);
        var ports = kind === "input" ? layout.inputPorts : layout.outputPorts;
        var portLayout = ports && ports[slotIndex];
        if (!portLayout) {
            return null;
        }

        return {
            x: portLayout.x + portLayout.width * 0.5,
            y: portLayout.y + portLayout.height * 0.5,
            dir: portLayout.dir,
            radius: portLayout.radius || 12
        };
    }

    function createLeaferNodeType(sourceType) {
        var BaseCtor = LiteGraph.registered_node_types[sourceType];
        if (!BaseCtor) {
            console.warn("nodes_leafer/base.js: source node type not found:", sourceType);
            return null;
        }

        var ctorName = toCtorName(getTargetType(sourceType));
        var LeaferNode = new Function(
            "BaseCtor",
            "sourceType",
            "return function " + ctorName + "(){" +
                "BaseCtor.apply(this, arguments);" +
                "this.renderRuntime='modern';" +
                "this._leaferSourceType=sourceType;" +
            "};"
        )(BaseCtor, sourceType);

        cloneStaticProperties(LeaferNode, BaseCtor);
        LeaferNode.leaferSourceType = sourceType;
        LeaferNode.leaferTargetType = getTargetType(sourceType);
        LeaferNode.title = BaseCtor.title;
        LeaferNode.desc = (BaseCtor.desc || BaseCtor.title || sourceType) + " (Leafer native)";
        LeaferNode.prototype = Object.create(BaseCtor.prototype);
        LeaferNode.prototype.constructor = LeaferNode;
        LeaferNode.prototype.renderRuntime = "modern";
        LeaferNode.prototype.buildUI = buildUI;
        LeaferNode.prototype.updateUI = updateUI;
        LeaferNode.prototype.getPortLayout = getPortLayout;
        LeaferNode.prototype.setProperty = function(name, value) {
            var result;
            if (typeof BaseCtor.prototype.setProperty === "function") {
                result = BaseCtor.prototype.setProperty.call(this, name, value);
            } else {
                this.properties = this.properties || {};
                this.properties[name] = value;
            }
            markNodeDirty(this);
            return result;
        };

        if (AUTO_DIRTY_ON_EXECUTE[sourceType]) {
            wrapMethodWithDirty(LeaferNode.prototype, "onExecute");
        }
        if (AUTO_DIRTY_ON_ACTION[sourceType]) {
            wrapMethodWithDirty(LeaferNode.prototype, "onAction");
        }
        if (AUTO_DIRTY_ON_METHOD[sourceType]) {
            AUTO_DIRTY_ON_METHOD[sourceType].forEach(function(methodName) {
                wrapMethodWithDirty(LeaferNode.prototype, methodName);
            });
        }

        LiteGraph.registerNodeType(getTargetType(sourceType), LeaferNode);
        return LeaferNode;
    }

    function registerLeaferBaseNodes() {
        var mapping = {};
        SOURCE_TYPES.forEach(function(sourceType) {
            var targetType = getTargetType(sourceType);
            if (!LiteGraph.registered_node_types[targetType]) {
                createLeaferNodeType(sourceType);
            }
            mapping[sourceType] = targetType;
        });
        LiteGraph.LeaferBaseNodeTypes = mapping;
        return mapping;
    }

    LiteGraph.registerLeaferBaseNodes = registerLeaferBaseNodes;
    registerLeaferBaseNodes();
})(typeof window !== "undefined" ? window : globalThis);
