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
    var SOURCE_TYPE_SET = SOURCE_TYPES.reduce(function(map, type) {
        map[type] = true;
        return map;
    }, {});

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
        graph: "#5F8DFF",
        basic: "#5F8DFF"
    };

    // Keep a small explicit map only for nodes that benefit from semantic color.
    // The baseline style remains unified through the shared default accent.
    var TYPE_ACCENTS = {
        "basic/alert": "#F97373",
        "basic/script": "#F43F5E"
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

    var FONT_FAMILY_SANS = "\"Noto Sans SC\", \"Microsoft YaHei\", \"PingFang SC\", \"Helvetica Neue\", Arial, sans-serif";
    var FONT_FAMILY_META = "\"Noto Sans SC\", \"Microsoft YaHei\", \"PingFang SC\", Arial, sans-serif";
    var FONT_FAMILY_MONO = "\"JetBrains Mono\", \"Cascadia Mono\", \"SFMono-Regular\", \"Microsoft YaHei UI\", monospace";

    var FLOW_LAYOUT = {
        minWidth: 256,
        maxWidth: 376,
        headerHeight: 58,
        collapsedHeight: 42,
        bodyPaddingX: 16,
        bodyPaddingY: 12,
        sectionGap: 10,
        summaryHeight: 52,
        sectionInsetX: 12,
        sectionInsetY: 10,
        collapsedPaddingX: 14,
        collapsedContentGap: 8,
        collapsedPreviewPaddingX: 8,
        portHeaderHeight: 18,
        widgetHeaderHeight: 18,
        portRowHeight: 22,
        widgetGap: 8,
        footerHeight: 16
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

    function tryNormalizeHexColor(color) {
        if (typeof color !== "string") {
            return null;
        }
        var trimmed = color.trim();
        if (!/^#[0-9a-fA-F]{3}$/.test(trimmed) && !/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
            return null;
        }
        return normalizeHexColor(trimmed);
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
        return String(sourceType || "");
    }

    function isLeaferModernNodeType(ctor) {
        return !!(ctor && ctor.__litegraphLeaferModernWrapper);
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
        return getNodeType(node) || node._leaferSourceType || "basic/node";
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
        if (inputs <= 1 && outputs <= 1 && widgets <= 1) {
            return "";
        }
        var footer = [inputs + " in", outputs + " out"];
        if (widgets) {
            footer.push(widgets + " widgets");
        }
        return footer.join(" | ");
    }

    function resolveAccentColor(node, sourceType) {
        var explicitColor = tryNormalizeHexColor(node && node.color);
        if (explicitColor) {
            return explicitColor;
        }
        var nodeBoxColor = tryNormalizeHexColor(node && node.boxcolor);
        if (nodeBoxColor) {
            return nodeBoxColor;
        }
        var ctorColor = tryNormalizeHexColor(node && node.constructor && node.constructor.color);
        if (ctorColor) {
            return ctorColor;
        }
        if (TYPE_ACCENTS[sourceType]) {
            return TYPE_ACCENTS[sourceType];
        }
        var category = String(sourceType).split("/")[0];
        return (
            tryNormalizeHexColor(LiteGraph.NODE_DEFAULT_COLOR) ||
            CATEGORY_ACCENTS[category] ||
            "#5F8DFF"
        );
    }

    function resolveSurfaceColor(node, accent) {
        var explicitBg = tryNormalizeHexColor(node && node.bgcolor);
        if (explicitBg) {
            return explicitBg;
        }
        var ctorBg = tryNormalizeHexColor(node && node.constructor && node.constructor.bgcolor);
        if (ctorBg) {
            return ctorBg;
        }
        var defaultBg = tryNormalizeHexColor(LiteGraph.NODE_DEFAULT_BGCOLOR);
        if (defaultBg) {
            return defaultBg;
        }
        return darken(accent, 0.78);
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

    function getNodeTitle(node, sourceType) {
        return typeof node.getTitle === "function" ? node.getTitle() : (node.title || sourceType);
    }

    function getStableNodeTitle(node, sourceType) {
        return (
            (node && node.title) ||
            (node && node.constructor && node.constructor.title) ||
            sourceType
        );
    }

    function getCollapsedPreview(node, sourceType) {
        var preview = truncateText(describeNode(node, sourceType), 28);
        var stableTitle = String(getStableNodeTitle(node, sourceType) || "");
        var liveTitle = String(getNodeTitle(node, sourceType) || "");
        var sourceLabel = String(sourceType || "").split("/")[1] || sourceType;

        if (!preview || preview === stableTitle || preview === liveTitle) {
            if (liveTitle && liveTitle !== stableTitle) {
                preview = liveTitle;
            } else if (sourceLabel && sourceLabel !== stableTitle) {
                preview = sourceLabel;
            }
        }

        return truncateText(preview, 24);
    }

    function estimateTextWidth(text, fontSize, factor) {
        return Math.ceil(String(text || "").length * fontSize * (factor || 0.58));
    }

    function measureCollapsedWidth(node, sourceType, expandedWidth) {
        var title = getStableNodeTitle(node, sourceType);
        var preview = getCollapsedPreview(node, sourceType);
        var titleWidth = estimateTextWidth(title || sourceType, 13, 0.68) + 12;
        var previewWidth = preview
            ? estimateTextWidth(preview, 10, 0.56) + FLOW_LAYOUT.collapsedPreviewPaddingX * 2 + 6
            : 0;
        var measured = titleWidth + previewWidth + 76;
        var fallbackWidth = Math.max(
            FLOW_LAYOUT.minWidth,
            toFiniteNumber(node && node.size && node.size[0], FLOW_LAYOUT.minWidth),
            toFiniteNumber(expandedWidth, FLOW_LAYOUT.minWidth)
        );
        var collapsedWidth = Math.max(
            124,
            Math.min(Math.min(fallbackWidth, 280), measured)
        );
        node._collapsed_width = collapsedWidth;
        return collapsedWidth;
    }

    function setNodeSize(node, width, height) {
        if (!node.size || (!Array.isArray(node.size) && !ArrayBuffer.isView(node.size))) {
            node.size = [width, height];
            return;
        }
        node.size[0] = width;
        node.size[1] = height;
    }

    function computeNodeVisualSize(node, sourceType) {
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
        var portCount = Math.max(
            node && Array.isArray(node.inputs) ? node.inputs.length : 0,
            node && Array.isArray(node.outputs) ? node.outputs.length : 0,
            0
        );
        var widgetList = Array.isArray(node && node.widgets) ? node.widgets : [];
        var widgetHeight = widgetList.reduce(function(total, widget, index) {
            return total + getWidgetRowHeight(widget) + (index ? FLOW_LAYOUT.widgetGap : 0);
        }, 0);
        var portHeight = portCount
            ? FLOW_LAYOUT.sectionInsetY * 2 + FLOW_LAYOUT.portHeaderHeight + 6 + portCount * FLOW_LAYOUT.portRowHeight
            : 0;
        var widgetSectionHeight = widgetList.length
            ? FLOW_LAYOUT.sectionInsetY * 2 + FLOW_LAYOUT.widgetHeaderHeight + 6 + widgetHeight
            : 0;
        var collapsed = !!(node && node.flags && node.flags.collapsed);
        var minWidth = Math.max(
            FLOW_LAYOUT.minWidth,
            currentWidth,
            Math.min(
                FLOW_LAYOUT.maxWidth,
                Math.max(FLOW_LAYOUT.minWidth, computedWidth)
            )
        );
        var minHeight = Math.max(
            FLOW_LAYOUT.headerHeight +
                FLOW_LAYOUT.bodyPaddingY * 2 +
                FLOW_LAYOUT.summaryHeight +
                portHeight +
                widgetSectionHeight +
                FLOW_LAYOUT.footerHeight +
                FLOW_LAYOUT.sectionGap * 3 +
                12,
            currentHeight,
            computedHeight,
            128
        );

        if (collapsed) {
            return {
                width: measureCollapsedWidth(node, sourceType, minWidth),
                height: FLOW_LAYOUT.collapsedHeight
            };
        }

        node._collapsed_width = Math.min(
            minWidth,
            measureCollapsedWidth(node, sourceType, minWidth)
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

        if (layout.collapsed) {
            result.push({
                index: isInput ? 0 : Math.max(0, count - 1),
                x: isInput ? -10 : layout.width - 10,
                y: layout.height * 0.5 - 10,
                width: 20,
                height: 20,
                radius: 12,
                dir: isInput ? 4 : 2,
                labelX: 0,
                labelY: 0,
                labelWidth: 0,
                labelAlign: isInput ? "left" : "right"
            });
            return result;
        }

        var section = layout.portSection;
        var labelWidth = Math.max(64, Math.floor(section.width * 0.34));
        var y = section.y + FLOW_LAYOUT.sectionInsetY + FLOW_LAYOUT.portHeaderHeight + 10;
        var step = FLOW_LAYOUT.portRowHeight;

        for (var i = 0; i < count; ++i) {
            var centerY = y + i * step;
            var centerX = isInput ? section.x + 10 : section.x + section.width - 10;
            result.push({
                index: i,
                x: centerX - 10,
                y: centerY - 10,
                width: 20,
                height: 20,
                radius: 12,
                dir: isInput ? 4 : 2,
                labelX: isInput ? section.x + 22 : section.x + section.width - labelWidth - 22,
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
        if (!widgets.length || (node.flags && node.flags.collapsed) || !layout.widgetSection) {
            return result;
        }

        var width = layout.widgetSection.width;
        var x = layout.widgetSection.x;
        var top = layout.widgetSection.y + FLOW_LAYOUT.sectionInsetY + FLOW_LAYOUT.widgetHeaderHeight + 6;

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
            top += rowHeight + FLOW_LAYOUT.widgetGap;
        }

        return result;
    }

    function buildShellLayout(node, sourceType) {
        var size = computeNodeVisualSize(node, sourceType);
        var collapsed = !!(node && node.flags && node.flags.collapsed);
        var headerHeight = collapsed ? FLOW_LAYOUT.collapsedHeight : FLOW_LAYOUT.headerHeight;
        var innerX = FLOW_LAYOUT.bodyPaddingX;
        var innerWidth = Math.max(80, size.width - innerX * 2);
        var layout = {
            width: size.width,
            height: size.height,
            collapsed: collapsed,
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
                height: Math.max(0, size.height - headerHeight)
            },
            collapse: {
                x: size.width - (collapsed ? 28 : 30),
                y: collapsed ? 11 : 12,
                width: collapsed ? 18 : 20,
                height: collapsed ? 18 : 20
            },
            resize: {
                x: size.width - 18,
                y: size.height - 18,
                width: 14,
                height: 14
            },
            sourceType: sourceType
        };

        if (collapsed) {
            layout.metaRow = null;
            layout.summaryPanel = null;
            layout.portSection = {
                x: 0,
                y: 0,
                width: size.width,
                height: size.height
            };
            layout.widgetSection = null;
            layout.footer = null;
            layout.inputPorts = buildPortLayouts(node, "input", layout);
            layout.outputPorts = buildPortLayouts(node, "output", layout);
            layout.widgets = [];
            return layout;
        }

        var footerText = describeFooter(node, sourceType);
        var cursorY = headerHeight + FLOW_LAYOUT.bodyPaddingY;
        layout.metaRow = null;

        layout.summaryPanel = {
            x: innerX,
            y: cursorY,
            width: innerWidth,
            height: FLOW_LAYOUT.summaryHeight
        };
        cursorY += layout.summaryPanel.height + FLOW_LAYOUT.sectionGap;

        var portRows = Math.max(
            Array.isArray(node && node.inputs) ? node.inputs.length : 0,
            Array.isArray(node && node.outputs) ? node.outputs.length : 0
        );
        layout.portSection = {
            x: innerX,
            y: cursorY,
            width: innerWidth,
            height: portRows
                ? FLOW_LAYOUT.sectionInsetY * 2 + FLOW_LAYOUT.portHeaderHeight + 6 + portRows * FLOW_LAYOUT.portRowHeight
                : 0
        };
        cursorY += layout.portSection.height;

        var widgets = Array.isArray(node && node.widgets) ? node.widgets : [];
        if (widgets.length) {
            cursorY += FLOW_LAYOUT.sectionGap;
            layout.widgetSection = {
                x: innerX,
                y: cursorY,
                width: innerWidth,
                height: 0
            };
        } else {
            layout.widgetSection = null;
        }

        layout.inputPorts = buildPortLayouts(node, "input", layout);
        layout.outputPorts = buildPortLayouts(node, "output", layout);
        layout.widgets = buildWidgetLayouts(node, layout);

        if (layout.widgetSection) {
            var lastWidget = layout.widgets[layout.widgets.length - 1];
            layout.widgetSection.height = lastWidget
                ? lastWidget.y + lastWidget.height - layout.widgetSection.y + FLOW_LAYOUT.sectionInsetY
                : FLOW_LAYOUT.sectionInsetY * 2 + FLOW_LAYOUT.widgetHeaderHeight;
            cursorY += layout.widgetSection.height;
        }

        if (footerText) {
            cursorY += FLOW_LAYOUT.sectionGap;
            layout.footer = {
                x: innerX,
                y: cursorY,
                width: innerWidth,
                height: FLOW_LAYOUT.footerHeight
            };
            cursorY += FLOW_LAYOUT.footerHeight + FLOW_LAYOUT.bodyPaddingY;
        } else {
            layout.footer = null;
            cursorY += FLOW_LAYOUT.bodyPaddingY;
        }
        layout.height = Math.max(size.height, cursorY);
        layout.body.height = Math.max(0, layout.height - headerHeight);
        layout.resize.y = layout.height - 18;

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

    function getFlowCtor(leafer) {
        return (global.LeaferIN && global.LeaferIN.flow && global.LeaferIN.flow.Flow)
            || leafer.Box
            || leafer.Frame
            || null;
    }

    function createFlowContainer(leafer, config) {
        var FlowCtor = getFlowCtor(leafer) || leafer.Group;
        return new FlowCtor(Object.assign({
            hittable: false
        }, config));
    }

    function setFlowVisible(view, visible) {
        if (!view) {
            return;
        }
        view.visible = !!visible;
        view.inFlow = !!visible;
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
            fontSize: 12,
            fontFamily: FONT_FAMILY_SANS,
            fill: UI_THEME.textMuted
        });
        var badge = createText(leafer, {
            x: 0,
            y: 0,
            width: 54,
            fontSize: 8,
            fontFamily: FONT_FAMILY_META,
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
            fontSize: 12,
            fontWeight: "600",
            fontFamily: FONT_FAMILY_SANS,
            fill: UI_THEME.text
        });
        var meta = createText(leafer, {
            x: 12,
            y: 18,
            width: 120,
            fontSize: 8,
            fontFamily: FONT_FAMILY_META,
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
            fontFamily: FONT_FAMILY_MONO,
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
            fontFamily: FONT_FAMILY_MONO,
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
            fontFamily: FONT_FAMILY_MONO,
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
            surface: UI_THEME.surface,
            surfaceRaised: UI_THEME.surfaceRaised,
            surfacePanel: UI_THEME.surfacePanel,
            surfaceMuted: UI_THEME.surfaceMuted,
            frame: createRect(leafer, {
                x: 0,
                y: 0,
                width: 220,
                height: 140,
                cornerRadius: 18,
                fill: UI_THEME.surface,
                stroke: UI_THEME.border,
                strokeWidth: 1.5
            }),
            frameOutline: createRect(leafer, {
                x: 1,
                y: 1,
                width: 218,
                height: 138,
                cornerRadius: 17,
                fill: "transparent",
                stroke: rgba("#FFFFFF", 0.02),
                strokeWidth: 1
            }),
            header: createRect(leafer, {
                x: 0,
                y: 0,
                width: 220,
                height: 58,
                cornerRadius: 18,
                fill: UI_THEME.surfaceRaised
            }),
            headerDivider: createRect(leafer, {
                x: 0,
                y: 57,
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
            headerFlow: createFlowContainer(leafer, {
                x: 18,
                y: 10,
                width: 152,
                flow: "y",
                gap: 4
            }),
            collapsedFlow: createFlowContainer(leafer, {
                x: FLOW_LAYOUT.collapsedPaddingX,
                y: 9,
                width: 140,
                flow: "x",
                gap: FLOW_LAYOUT.collapsedContentGap,
                flowAlign: { y: "center" },
                visible: false
            }),
            collapsedTitle: createText(leafer, {
                width: 76,
                fontSize: 13,
                fontWeight: "700",
                fontFamily: FONT_FAMILY_SANS,
                fill: UI_THEME.text
            }),
            collapsedPreviewBox: createFlowContainer(leafer, {
                flow: "x",
                padding: [4, FLOW_LAYOUT.collapsedPreviewPaddingX],
                cornerRadius: 10,
                fill: rgba("#37A8FF", 0.12),
                stroke: rgba("#37A8FF", 0.2),
                strokeWidth: 1,
                visible: false
            }),
            collapsedPreview: createText(leafer, {
                width: 44,
                fontSize: 10,
                fontWeight: "600",
                fontFamily: FONT_FAMILY_META,
                fill: UI_THEME.textMuted
            }),
            title: createText(leafer, {
                width: 152,
                fontSize: 16,
                fontWeight: "700",
                fontFamily: FONT_FAMILY_SANS,
                fill: UI_THEME.text
            }),
            metaRow: createFlowContainer(leafer, {
                width: 152,
                flow: "x",
                gap: 8,
                flowAlign: { y: "center" }
            }),
            subtitle: createText(leafer, {
                width: 92,
                autoWidth: 1,
                fontSize: 10,
                fontFamily: FONT_FAMILY_META,
                fill: UI_THEME.textSoft
            }),
            categoryText: createText(leafer, {
                width: 56,
                fontSize: 10,
                fontWeight: "700",
                fontFamily: FONT_FAMILY_META,
                fill: lighten("#37A8FF", 0.2)
            }),
            bodyFlow: createFlowContainer(leafer, {
                x: FLOW_LAYOUT.bodyPaddingX,
                y: FLOW_LAYOUT.headerHeight + FLOW_LAYOUT.bodyPaddingY,
                width: 192,
                flow: "y",
                gap: FLOW_LAYOUT.sectionGap
            }),
            summarySurface: createFlowContainer(leafer, {
                width: 192,
                height: FLOW_LAYOUT.summaryHeight,
                flow: "y",
                gap: 3,
                padding: [10, 12, 10, 12],
                cornerRadius: 16,
                fill: UI_THEME.surfacePanel,
                stroke: UI_THEME.borderSoft,
                strokeWidth: 1
            }),
            summaryLabel: createText(leafer, {
                width: 168,
                fontSize: 9,
                fontWeight: "700",
                fontFamily: FONT_FAMILY_META,
                fill: UI_THEME.textSoft
            }),
            summary: createText(leafer, {
                width: 168,
                fontSize: 13,
                fontWeight: "600",
                fontFamily: FONT_FAMILY_SANS,
                fill: UI_THEME.textMuted
            }),
            portSurface: createFlowContainer(leafer, {
                width: 192,
                height: 48,
                flow: "x",
                gap: 8,
                padding: [10, 12, 0, 12],
                flowAlign: { y: "center" },
                cornerRadius: 16,
                fill: UI_THEME.surfaceMuted,
                stroke: UI_THEME.borderSoft,
                strokeWidth: 1
            }),
            portTitle: createText(leafer, {
                width: 58,
                fontSize: 9,
                fontWeight: "700",
                fontFamily: FONT_FAMILY_META,
                fill: UI_THEME.textSoft
            }),
            portStats: createText(leafer, {
                width: 110,
                autoWidth: 1,
                textAlign: "right",
                fontSize: 10,
                fontFamily: FONT_FAMILY_META,
                fill: UI_THEME.textDim
            }),
            widgetSurface: createFlowContainer(leafer, {
                width: 192,
                height: 36,
                flow: "x",
                gap: 8,
                padding: [10, 12, 0, 12],
                flowAlign: { y: "center" },
                cornerRadius: 16,
                fill: darken(UI_THEME.surfacePanel, 0.08),
                stroke: UI_THEME.borderSoft,
                strokeWidth: 1,
                visible: false,
                inFlow: false
            }),
            widgetTitle: createText(leafer, {
                width: 72,
                fontSize: 9,
                fontWeight: "700",
                fontFamily: FONT_FAMILY_META,
                fill: UI_THEME.textSoft
            }),
            widgetStats: createText(leafer, {
                width: 96,
                autoWidth: 1,
                textAlign: "right",
                fontSize: 10,
                fontFamily: FONT_FAMILY_META,
                fill: UI_THEME.textDim
            }),
            footerFlow: createFlowContainer(leafer, {
                width: 192,
                height: FLOW_LAYOUT.footerHeight,
                flow: "x",
                gap: 6,
                flowAlign: { y: "center" }
            }),
            footerDot: createRect(leafer, {
                width: 6,
                height: 6,
                cornerRadius: 3,
                fill: "#37A8FF"
            }),
            footer: createText(leafer, {
                width: 176,
                autoWidth: 1,
                fontSize: 10,
                fontFamily: FONT_FAMILY_META,
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
                fontFamily: FONT_FAMILY_MONO,
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

        state.collapsedPreviewBox.add(state.collapsedPreview);
        state.collapsedFlow.add([state.collapsedTitle, state.collapsedPreviewBox]);
        state.metaRow.add([state.subtitle, state.categoryText]);
        state.headerFlow.add([state.title, state.metaRow]);
        state.summarySurface.add([state.summaryLabel, state.summary]);
        state.portSurface.add([state.portTitle, state.portStats]);
        state.widgetSurface.add([state.widgetTitle, state.widgetStats]);
        state.footerFlow.add([state.footerDot, state.footer]);
        state.bodyFlow.add([
            state.summarySurface,
            state.portSurface,
            state.widgetSurface,
            state.footerFlow
        ]);

        shell.add([
            state.frame,
            state.frameOutline,
            state.header,
            state.headerDivider,
            state.accentRail,
            state.headerFlow,
            state.collapsedFlow,
            state.bodyFlow,
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
            var hasLabel = layout.labelWidth > 0;
            var slotTypeText = truncateText(slot.type == null ? "*" : slot.type, 10).toUpperCase();
            var showBadge = hasLabel && layouts.length > 1 && slotTypeText && slotTypeText !== "*";
            var badgeWidth = showBadge ? Math.min(52, Math.max(32, Math.floor(layout.labelWidth * 0.34))) : 0;
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
            view.label.visible = hasLabel;
            if (showBadge) {
                if (isInput) {
                    view.badge.x = layout.labelX - layout.x + layout.labelWidth - badgeWidth;
                    view.label.width = Math.max(0, layout.labelWidth - badgeWidth - 8);
                    view.label.textAlign = "left";
                } else {
                    view.badge.x = layout.labelX - layout.x;
                    view.label.x = view.badge.x + badgeWidth + 8;
                    view.label.width = Math.max(0, layout.labelWidth - badgeWidth - 8);
                    view.label.textAlign = "right";
                }
                view.badge.y = layout.labelY - layout.y + 1;
                view.badge.width = badgeWidth;
                view.badge.textAlign = isInput ? "right" : "left";
            } else {
                view.badge.x = layout.labelX - layout.x;
                view.badge.y = layout.labelY - layout.y;
                view.badge.width = 0;
                view.badge.textAlign = layout.labelAlign;
            }
            view.badge.text = slotTypeText;
            view.badge.visible = showBadge;
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
        var surface = resolveSurfaceColor(node, accent);
        var surfaceRaised = mixColor(surface, accent, 0.22);
        var surfacePanel = darken(surface, 0.14);
        var surfaceMuted = darken(surface, 0.08);
        var layout = buildShellLayout(node, sourceType);
        var collapsed = !!(node && node.flags && node.flags.collapsed);
        var frameRadius = collapsed ? 15 : 18;
        var outlineRadius = collapsed ? 14 : 17;
        var inputs = Array.isArray(node && node.inputs) ? node.inputs : [];
        var outputs = Array.isArray(node && node.outputs) ? node.outputs : [];
        var widgets = Array.isArray(node && node.widgets) ? node.widgets : [];
        var title = typeof node.getTitle === "function" ? node.getTitle() : (node.title || sourceType);
        var collapsedTitle = String(getStableNodeTitle(node, sourceType) || title || sourceType);
        var collapsedPreview = getCollapsedPreview(node, sourceType);
        var sourceParts = String(sourceType || "").split("/");
        var subtitleText = sourceParts[1] || sourceType;
        var categoryLabel = (sourceParts[0] || "node").toUpperCase();
        var footerText = describeFooter(node, sourceType);

        state.accent = accent;
        state.surface = surface;
        state.surfaceRaised = surfaceRaised;
        state.surfacePanel = surfacePanel;
        state.surfaceMuted = surfaceMuted;
        state.layout = layout;

        state.frame.width = layout.width;
        state.frame.height = layout.height;
        state.frame.cornerRadius = frameRadius;
        state.frameOutline.width = Math.max(1, layout.width - 2);
        state.frameOutline.height = Math.max(1, layout.height - 2);
        state.frameOutline.cornerRadius = outlineRadius;
        state.header.x = layout.header.x;
        state.header.y = layout.header.y;
        state.header.width = layout.header.width;
        state.header.height = layout.header.height;
        state.header.cornerRadius = frameRadius;
        state.headerDivider.visible = !collapsed;
        state.headerDivider.y = layout.header.height - 1;
        state.headerDivider.width = layout.width;
        state.accentRail.height = layout.height;
        state.accentRail.fill = accent;
        state.headerFlow.visible = !collapsed;
        state.headerFlow.x = 18;
        state.headerFlow.y = collapsed ? 8 : 10;
        state.headerFlow.width = Math.max(78, layout.width - 70);
        state.title.width = state.headerFlow.width;
        state.title.text = truncateText(title || sourceType, collapsed ? 20 : 28);
        state.metaRow.width = state.headerFlow.width;
        state.subtitle.width = Math.max(72, state.headerFlow.width - 68);
        state.subtitle.text = truncateText(subtitleText, 24).toUpperCase();
        state.categoryText.width = Math.max(44, estimateTextWidth(categoryLabel, 10, 0.58) + 2);
        state.categoryText.text = categoryLabel;
        setFlowVisible(state.metaRow, !collapsed);

        state.collapsedFlow.x = FLOW_LAYOUT.collapsedPaddingX;
        state.collapsedFlow.y = 9;
        state.collapsedFlow.width = Math.max(72, layout.width - 58);
        state.collapsedTitle.text = truncateText(collapsedTitle, 22);
        state.collapsedPreview.text = collapsedPreview;
        state.collapsedPreview.width = Math.min(
            126,
            Math.max(36, estimateTextWidth(collapsedPreview, 10, 0.56) + 2)
        );
        setFlowVisible(state.collapsedPreviewBox, collapsed && !!collapsedPreview);
        state.collapsedTitle.width = Math.max(
            48,
            state.collapsedFlow.width -
                (collapsed && collapsedPreview
                    ? state.collapsedPreview.width + FLOW_LAYOUT.collapsedPreviewPaddingX * 2 + FLOW_LAYOUT.collapsedContentGap + 6
                    : 0)
        );
        state.collapsedFlow.visible = collapsed;

        state.bodyFlow.x = FLOW_LAYOUT.bodyPaddingX;
        state.bodyFlow.y = layout.header.height + FLOW_LAYOUT.bodyPaddingY;
        state.bodyFlow.width = Math.max(80, layout.width - FLOW_LAYOUT.bodyPaddingX * 2);
        state.bodyFlow.height = Math.max(0, layout.height - layout.header.height - FLOW_LAYOUT.bodyPaddingY * 2);
        state.bodyFlow.visible = !collapsed;

        state.summarySurface.width = layout.summaryPanel ? layout.summaryPanel.width : 0;
        state.summarySurface.height = layout.summaryPanel ? layout.summaryPanel.height : 0;
        state.summaryLabel.width = layout.summaryPanel ? Math.max(0, layout.summaryPanel.width - 24) : 0;
        state.summary.width = state.summaryLabel.width;
        state.summaryLabel.text = "SNAPSHOT";
        state.summary.text = truncateText(describeNode(node, sourceType), collapsed ? 36 : 96);
        setFlowVisible(state.summarySurface, !collapsed && !!layout.summaryPanel);

        state.portSurface.width = layout.portSection ? layout.portSection.width : 0;
        state.portSurface.height = layout.portSection ? layout.portSection.height : 0;
        state.portTitle.text = "PORT MAP";
        state.portStats.width = Math.max(72, state.portSurface.width - 76);
        state.portStats.text = inputs.length + " in | " + outputs.length + " out";
        setFlowVisible(state.portSurface, !collapsed && !!layout.portSection && layout.portSection.height > 0);

        state.widgetSurface.width = layout.widgetSection ? layout.widgetSection.width : 0;
        state.widgetSurface.height = layout.widgetSection ? layout.widgetSection.height : 0;
        state.widgetTitle.text = "CONTROLS";
        state.widgetStats.width = Math.max(72, state.widgetSurface.width - 88);
        state.widgetStats.text = widgets.length + " widgets";
        setFlowVisible(state.widgetSurface, !collapsed && !!layout.widgetSection && layout.widgetSection.height > 0);

        state.footerFlow.width = layout.footer ? layout.footer.width : Math.max(0, layout.width - 36);
        state.footer.text = footerText;
        state.footer.width = Math.max(0, state.footerFlow.width - 14);
        setFlowVisible(state.footerFlow, !collapsed && !!layout.footer);

        state.collapseBg.x = layout.collapse.x;
        state.collapseBg.y = layout.collapse.y;
        state.collapseBg.width = layout.collapse.width;
        state.collapseBg.height = layout.collapse.height;
        state.collapseGlyph.x = layout.collapse.x;
        state.collapseGlyph.y = layout.collapse.y + (collapsed ? 2 : 4);
        state.collapseGlyph.width = layout.collapse.width;
        state.collapseGlyph.text = collapsed ? "+" : "-";
        state.resizeLineA.x = layout.resize.x + 2;
        state.resizeLineA.y = layout.resize.y + 9;
        state.resizeLineB.x = layout.resize.x + 5;
        state.resizeLineB.y = layout.resize.y + 4;
        state.resizeLineA.visible = !collapsed;
        state.resizeLineB.visible = !collapsed;

        syncPortLayer(leafer, state.portLayer, state.inputPortViews, layout.inputPorts, inputs, true);
        syncPortLayer(leafer, state.portLayer, state.outputPortViews, layout.outputPorts, outputs, false);
        state.portLayer.visible = !!layout.portSection && layout.portSection.height > 0;
        syncWidgetLayer(leafer, state.widgetLayer, state.widgetViews, layout.widgets, widgets, accent);
        state.widgetLayer.visible = !collapsed && layout.widgets.length > 0;

        state.applyInteractionState(context.interactionState);
    }

    function applyInteractionState(node, state, interaction) {
        var accent = state.accent || "#37A8FF";
        var surface = state.surface || UI_THEME.surface;
        var surfaceRaised = state.surfaceRaised || UI_THEME.surfaceRaised;
        var surfacePanel = state.surfacePanel || UI_THEME.surfacePanel;
        var surfaceMuted = state.surfaceMuted || UI_THEME.surfaceMuted;
        var isSelected = !!(node && node.is_selected);
        var hoveredPart = interaction && interaction.hoveredPart;
        var pressedPart = interaction && interaction.pressedPart;
        var hovered = !!(interaction && interaction.hovered);
        var pressed = !!(interaction && interaction.pressed);
        var dragging = !!(interaction && interaction.dragging);
        var resizing = !!(interaction && interaction.resizing);

        state.frame.fill = hovered ? mixColor(surface, accent, 0.12) : surface;
        state.frame.stroke = isSelected
            ? lighten(accent, 0.18)
            : hovered
                ? rgba(accent, 0.5)
                : UI_THEME.border;
        state.frameOutline.stroke = isSelected ? rgba("#FFFFFF", 0.08) : rgba("#FFFFFF", 0.02);
        state.header.fill = dragging || resizing
            ? mixColor(surfaceRaised, accent, 0.32)
            : hovered
                ? mixColor(surfaceRaised, accent, 0.2)
                : surfaceRaised;
        state.headerDivider.fill = hovered ? rgba(accent, 0.24) : UI_THEME.borderSoft;
        state.title.fill = isSelected ? "#FFFFFF" : UI_THEME.text;
        state.subtitle.fill = hovered ? lighten(accent, 0.36) : UI_THEME.textSoft;
        state.categoryText.fill = hovered ? lighten(accent, 0.22) : lighten(accent, 0.14);
        state.collapsedTitle.fill = isSelected ? "#FFFFFF" : UI_THEME.text;
        state.collapsedPreview.fill = hovered ? "#E6F0FF" : UI_THEME.textMuted;
        state.collapsedPreviewBox.fill = hovered ? rgba(accent, 0.18) : rgba(accent, 0.1);
        state.collapsedPreviewBox.stroke = hovered ? rgba(accent, 0.34) : rgba(accent, 0.22);
        state.summaryLabel.fill = hovered ? lighten(accent, 0.18) : UI_THEME.textSoft;
        state.summary.fill = hovered ? "#D8E4F5" : UI_THEME.textMuted;
        state.portTitle.fill = hovered ? lighten(accent, 0.18) : UI_THEME.textSoft;
        state.portStats.fill = hovered ? "#C8D7EA" : UI_THEME.textDim;
        state.widgetTitle.fill = hovered ? lighten(accent, 0.16) : UI_THEME.textSoft;
        state.widgetStats.fill = hovered ? "#C8D7EA" : UI_THEME.textDim;
        state.footer.fill = isSelected ? "#B7CAE4" : UI_THEME.textDim;
        state.footerDot.fill = isSelected
            ? lighten(accent, 0.18)
            : hovered
                ? lighten(accent, 0.08)
                : accent;
        state.summarySurface.fill = hovered ? rgba(accent, 0.09) : surfacePanel;
        state.summarySurface.stroke = hovered ? rgba(accent, 0.22) : UI_THEME.borderSoft;
        state.portSurface.fill = hovered ? rgba(accent, 0.06) : surfaceMuted;
        state.portSurface.stroke = hovered ? rgba(accent, 0.2) : UI_THEME.borderSoft;
        state.widgetSurface.fill = hovered ? rgba(accent, 0.04) : darken(surfacePanel, 0.08);
        state.widgetSurface.stroke = hovered ? rgba(accent, 0.18) : UI_THEME.borderSoft;

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

    function createLeaferNodeType(sourceType, baseCtor, registerNodeTypeFn) {
        var BaseCtor = baseCtor || LiteGraph.registered_node_types[sourceType];
        if (!BaseCtor) {
            return null;
        }
        if (isLeaferModernNodeType(BaseCtor)) {
            return BaseCtor;
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
        LeaferNode.__litegraphLeaferModernWrapper = true;
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

        (registerNodeTypeFn || LiteGraph.registerNodeType)(
            getTargetType(sourceType),
            LeaferNode
        );
        return LeaferNode;
    }

    function ensureLeaferNodeType(sourceType, baseCtor, registerNodeTypeFn) {
        var targetType = getTargetType(sourceType);
        var existingCtor = LiteGraph.registered_node_types[targetType];
        if (isLeaferModernNodeType(existingCtor) && existingCtor.leaferSourceType === sourceType) {
            return existingCtor;
        }
        return createLeaferNodeType(sourceType, baseCtor, registerNodeTypeFn);
    }

    function installLeaferBaseRegistrationHook() {
        if (
            LiteGraph.registerNodeType &&
            LiteGraph.registerNodeType.__litegraphLeaferBaseWrapped
        ) {
            return;
        }

        var originalRegisterNodeType = LiteGraph.registerNodeType.bind(LiteGraph);
        var wrappedRegisterNodeType = function(type, ctor) {
            originalRegisterNodeType(type, ctor);
            if (SOURCE_TYPE_SET[type] && ctor && !isLeaferModernNodeType(ctor)) {
                ensureLeaferNodeType(type, ctor, originalRegisterNodeType);
            }
        };

        wrappedRegisterNodeType.__litegraphLeaferBaseWrapped = true;
        wrappedRegisterNodeType.__litegraphLeaferBaseOriginal = originalRegisterNodeType;
        LiteGraph.registerNodeType = wrappedRegisterNodeType;
    }

    function registerLeaferBaseNodes() {
        var mapping = {};
        SOURCE_TYPES.forEach(function(sourceType) {
            var targetType = getTargetType(sourceType);
            var baseCtor = LiteGraph.registered_node_types[sourceType];
            if (baseCtor && !isLeaferModernNodeType(baseCtor)) {
                ensureLeaferNodeType(sourceType, baseCtor);
            }
            mapping[sourceType] = targetType;
        });
        LiteGraph.LeaferBaseNodeTypes = mapping;
        return mapping;
    }

    installLeaferBaseRegistrationHook();
    LiteGraph.registerLeaferBaseNodes = registerLeaferBaseNodes;
    registerLeaferBaseNodes();
})(typeof window !== "undefined" ? window : globalThis);
