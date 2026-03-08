(function(global) {
    var LiteGraph = global && global.LiteGraph;
    var ns = LiteGraph && LiteGraph.nodes_leafer;
    if (!LiteGraph || !ns || typeof ns.registerBaseModule !== "function") {
        return;
    }

    ns.registerBaseModule("base/graph", function() {
        function getGraphInputValueWidget(node) {
            var type = node && node.properties ? node.properties.type : "";
            if (type === "number") {
                return {
                    type: "number",
                    value: Number(node.properties.value) || 0,
                    options: { step: 1 },
                };
            }
            if (type === "boolean") {
                return {
                    type: "toggle",
                    value: Boolean(node.properties.value),
                };
            }
            return {
                type: "text",
                value:
                    node && node.properties && node.properties.value != null
                        ? String(node.properties.value)
                        : "",
            };
        }

        function getGraphInputDefaultValue(type) {
            if (type === "number") {
                return 0;
            }
            if (type === "boolean") {
                return true;
            }
            return "";
        }

        class Subgraph extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.size = [140, 80];
                this.properties = { enabled: true };
                this.enabled = true;
                this.subgraph = new LiteGraph.LGraph();
                this.subgraph._subgraph_node = this;
                this.subgraph._is_subgraph = true;
                this.subgraph.onTrigger = this.onSubgraphTrigger.bind(this);
                this.subgraph.onInputAdded = this.onSubgraphNewInput.bind(this);
                this.subgraph.onInputRenamed = this.onSubgraphRenamedInput.bind(this);
                this.subgraph.onInputTypeChanged = this.onSubgraphTypeChangeInput.bind(this);
                this.subgraph.onInputRemoved = this.onSubgraphRemovedInput.bind(this);
                this.subgraph.onOutputAdded = this.onSubgraphNewOutput.bind(this);
                this.subgraph.onOutputRenamed = this.onSubgraphRenamedOutput.bind(this);
                this.subgraph.onOutputTypeChanged = this.onSubgraphTypeChangeOutput.bind(this);
                this.subgraph.onOutputRemoved = this.onSubgraphRemovedOutput.bind(this);
            }

            onGetInputs() {
                return [["enabled", "boolean"]];
            }

            onDblClick(e, pos, graphcanvas) {
                var that = this;
                setTimeout(function() {
                    graphcanvas.openSubgraph(that.subgraph);
                }, 10);
            }

            defineActionParts() {
                if (this.flags && this.flags.collapsed) {
                    return [];
                }
                var width = Math.max((this.size && this.size[0]) || 0, 216);
                var footerY = Math.max(0, ((this.size && this.size[1]) || 80) - 24);
                var actionWidth = Math.max(72, width / 2 - 10);
                return [
                    {
                        id: "subgraph-left",
                        action: "subgraph-left",
                        label: "Input +",
                        placement: "footer-left",
                        bounds: {
                            x: 6,
                            y: footerY,
                            width: actionWidth,
                            height: 20,
                        },
                        onTrigger: function(context) {
                            if (context.graphcanvas) {
                                context.graphcanvas.showSubgraphPropertiesDialog(
                                    context.node
                                );
                            }
                        },
                    },
                    {
                        id: "subgraph-right",
                        action: "subgraph-right",
                        label: "Output +",
                        placement: "footer-right",
                        bounds: {
                            x: width - actionWidth - 6,
                            y: footerY,
                            width: actionWidth,
                            height: 20,
                        },
                        onTrigger: function(context) {
                            if (context.graphcanvas) {
                                context.graphcanvas.showSubgraphPropertiesDialogRight(
                                    context.node
                                );
                            }
                        },
                    },
                ];
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                var inputCount = this.inputs ? this.inputs.length : 0;
                var outputCount = this.outputs ? this.outputs.length : 0;
                shellState.headerMetaText = this.enabled ? "LIVE" : "OFF";
                shellState.summaryText =
                    inputCount || outputCount
                        ? inputCount + " in / " + outputCount + " out"
                        : "Double-click to open";
                shellState.minimumWidth = 232;
                shellState.minimumHeight = 88;
                if (!this.enabled) {
                    shellState.bodyColor = "#171A1F";
                    shellState.borderColor = "#404754";
                    shellState.boxColor = "#8A93A4";
                }
                return shellState;
            }

            onAction(action, param) {
                this.subgraph.onAction(action, param);
            }

            onExecute() {
                var wasEnabled = this.enabled;
                this.enabled = this.getInputOrProperty("enabled");
                if (wasEnabled !== this.enabled) {
                    this.requestModernPatch(
                        ns.ModernNodeChangeMask.Data |
                            ns.ModernNodeChangeMask.Style
                    );
                }
                if (!this.enabled) {
                    return;
                }

                if (this.inputs) {
                    for (var i = 0; i < this.inputs.length; ++i) {
                        var input = this.inputs[i];
                        this.subgraph.setInputData(input.name, this.getInputData(i));
                    }
                }

                this.subgraph.runStep();

                if (this.outputs) {
                    for (var j = 0; j < this.outputs.length; ++j) {
                        var output = this.outputs[j];
                        this.setOutputData(j, this.subgraph.getOutputData(output.name));
                    }
                }
            }

            sendEventToAllNodes(eventname, param, mode) {
                if (this.enabled) {
                    this.subgraph.sendEventToAllNodes(eventname, param, mode);
                }
            }

            computeSize() {
                var numInputs = this.inputs ? this.inputs.length : 0;
                var numOutputs = this.outputs ? this.outputs.length : 0;
                return [
                    200,
                    Math.max(numInputs, numOutputs) * LiteGraph.NODE_SLOT_HEIGHT +
                        LiteGraph.NODE_TITLE_HEIGHT,
                ];
            }

            onSubgraphTrigger(event, param) {
                var slot = this.findOutputSlot(event);
                if (slot !== -1) {
                    this.triggerSlot(slot, param);
                }
            }

            onSubgraphNewInput(name, type) {
                var slot = this.findInputSlot(name);
                if (slot === -1) {
                    this.addInput(name, type);
                    this.syncModernPorts();
                    this.requestModernPatch(
                        ns.ModernNodeChangeMask.Layout |
                            ns.ModernNodeChangeMask.Data
                    );
                }
            }

            onSubgraphRenamedInput(oldname, name) {
                var slot = this.findInputSlot(oldname);
                if (slot === -1) {
                    return;
                }
                this.getInputInfo(slot).name = name;
                this.syncModernPorts();
                this.requestModernPatch(
                    ns.ModernNodeChangeMask.Layout |
                        ns.ModernNodeChangeMask.Data
                );
            }

            onSubgraphTypeChangeInput(name, type) {
                var slot = this.findInputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.getInputInfo(slot).type = type;
                this.syncModernPorts();
                this.requestModernPatch(
                    ns.ModernNodeChangeMask.Layout |
                        ns.ModernNodeChangeMask.Data
                );
            }

            onSubgraphRemovedInput(name) {
                var slot = this.findInputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.removeInput(slot);
                this.syncModernPorts();
                this.requestModernPatch(
                    ns.ModernNodeChangeMask.Layout |
                        ns.ModernNodeChangeMask.Data
                );
            }

            onSubgraphNewOutput(name, type) {
                var slot = this.findOutputSlot(name);
                if (slot === -1) {
                    this.addOutput(name, type);
                    this.syncModernPorts();
                    this.requestModernPatch(
                        ns.ModernNodeChangeMask.Layout |
                            ns.ModernNodeChangeMask.Data
                    );
                }
            }

            onSubgraphRenamedOutput(oldname, name) {
                var slot = this.findOutputSlot(oldname);
                if (slot === -1) {
                    return;
                }
                this.getOutputInfo(slot).name = name;
                this.syncModernPorts();
                this.requestModernPatch(
                    ns.ModernNodeChangeMask.Layout |
                        ns.ModernNodeChangeMask.Data
                );
            }

            onSubgraphTypeChangeOutput(name, type) {
                var slot = this.findOutputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.getOutputInfo(slot).type = type;
                this.syncModernPorts();
                this.requestModernPatch(
                    ns.ModernNodeChangeMask.Layout |
                        ns.ModernNodeChangeMask.Data
                );
            }

            onSubgraphRemovedOutput(name) {
                var slot = this.findOutputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.removeOutput(slot);
                this.syncModernPorts();
                this.requestModernPatch(
                    ns.ModernNodeChangeMask.Layout |
                        ns.ModernNodeChangeMask.Data
                );
            }

            getExtraMenuOptions(graphcanvas) {
                var that = this;
                return [
                    {
                        content: "Open",
                        callback: function() {
                            graphcanvas.openSubgraph(that.subgraph);
                        },
                    },
                ];
            }

            onResize(size) {
                size[1] += 20;
            }

            serialize() {
                var data = ns.BaseNode.prototype.serialize.call(this);
                data.subgraph = this.subgraph.serialize();
                return data;
            }

            reassignSubgraphUUIDs(graph) {
                var idMap = { nodeIDs: {}, linkIDs: {} };
                for (var i = 0; i < graph.nodes.length; ++i) {
                    var node = graph.nodes[i];
                    var oldID = node.id;
                    var newID = LiteGraph.uuidv4();
                    node.id = newID;
                    idMap.nodeIDs[oldID] = newID;
                    idMap.nodeIDs[newID] = oldID;
                }
                for (var j = 0; j < graph.links.length; ++j) {
                    var link = graph.links[j];
                    var oldLinkID = link[0];
                    var newLinkID = LiteGraph.uuidv4();
                    link[0] = newLinkID;
                    idMap.linkIDs[oldLinkID] = newLinkID;
                    idMap.linkIDs[newLinkID] = oldLinkID;
                    link[1] = idMap.nodeIDs[link[1]];
                    link[3] = idMap.nodeIDs[link[3]];
                }
                for (var k = 0; k < graph.nodes.length; ++k) {
                    var innerNode = graph.nodes[k];
                    if (innerNode.inputs) {
                        for (var a = 0; a < innerNode.inputs.length; ++a) {
                            if (innerNode.inputs[a].link) {
                                innerNode.inputs[a].link =
                                    idMap.linkIDs[innerNode.inputs[a].link];
                            }
                        }
                    }
                    if (innerNode.outputs) {
                        for (var b = 0; b < innerNode.outputs.length; ++b) {
                            if (innerNode.outputs[b].links) {
                                innerNode.outputs[b].links =
                                    innerNode.outputs[b].links.map(function(linkId) {
                                        return idMap.linkIDs[linkId];
                                    });
                            }
                        }
                    }
                }
            }

            clone() {
                var node = LiteGraph.createNode(this.type);
                var data = this.serialize();
                if (LiteGraph.use_uuids) {
                    var subgraph = LiteGraph.cloneObject(data.subgraph);
                    this.reassignSubgraphUUIDs(subgraph);
                    data.subgraph = subgraph;
                }
                delete data.id;
                delete data.inputs;
                delete data.outputs;
                node.configure(data);
                return node;
            }
        }

        Subgraph.type = "graph/subgraph";
        Subgraph.title = "Subgraph";
        Subgraph.desc = "Graph inside a node";
        Subgraph.title_color = "#334";

        class GraphInput extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addOutput("", "number");
                this.name_in_graph = "";
                this.properties = { name: "", type: "number", value: 0 };
                this.widgets_up = true;
                this.size = [180, 90];
            }

            defineWidgets() {
                var valueWidget = getGraphInputValueWidget(this);
                return [
                    {
                        id: "name",
                        type: "text",
                        name: "name",
                        label: "Name",
                        value: this.properties.name,
                        property: "name",
                    },
                    {
                        id: "type",
                        type: "text",
                        name: "type",
                        label: "Type",
                        value: this.properties.type,
                        property: "type",
                    },
                    {
                        id: "value",
                        type: valueWidget.type,
                        name: "value",
                        label: "Value",
                        value: valueWidget.value,
                        property: "value",
                        options: valueWidget.options,
                    },
                ];
            }

            onConfigure() {
                this.updateType();
            }

            updateType() {
                var type = this.properties.type;
                if (this.outputs[0].type != type) {
                    if (!LiteGraph.isValidConnection(this.outputs[0].type, type)) {
                        this.disconnectOutput(0);
                    }
                    this.outputs[0].type = type;
                }

                this.properties.value = getGraphInputDefaultValue(type);
                if (this.graph && this.name_in_graph) {
                    this.graph.changeInputType(this.name_in_graph, type);
                }
                this.requestModernPatch(
                    ns.ModernNodeChangeMask.Layout |
                        ns.ModernNodeChangeMask.Data |
                        ns.ModernNodeChangeMask.Ports
                );
            }

            onPropertyChanged(name, v) {
                if (name == "name") {
                    if (v == "" || v == this.name_in_graph || v == "enabled") {
                        return false;
                    }
                    if (this.graph) {
                        if (this.name_in_graph) {
                            this.graph.renameInput(this.name_in_graph, v);
                        } else {
                            this.graph.addInput(v, this.properties.type);
                        }
                    }
                    this.name_in_graph = v;
                    this.requestModernPatch(
                        ns.ModernNodeChangeMask.Layout |
                            ns.ModernNodeChangeMask.Data
                    );
                } else if (name == "type") {
                    this.updateType();
                }
            }

            getTitle() {
                if (this.flags.collapsed) {
                    return this.properties.name;
                }
                return this.title;
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                shellState.title = this.properties.name || this.title;
                shellState.headerMetaText = ns.describePortType(this.properties.type);
                shellState.minimumWidth = 220;
                return shellState;
            }

            getPortPresentation(kind, slotIndex, context) {
                var portPresentation = ns.BaseNode.prototype.getPortPresentation.call(
                    this,
                    kind,
                    slotIndex,
                    context
                );
                if (kind === "output" && slotIndex === 0) {
                    portPresentation.label = this.properties.name || "";
                }
                return portPresentation;
            }

            onAction(action, param) {
                if (this.properties.type == LiteGraph.EVENT) {
                    this.triggerSlot(0, param);
                }
            }

            onExecute() {
                var name = this.properties.name;
                var data = this.graph.inputs[name];
                if (!data) {
                    this.setOutputData(0, this.properties.value);
                    return;
                }
                this.setOutputData(
                    0,
                    data.value !== undefined ? data.value : this.properties.value
                );
            }

            onRemoved() {
                if (this.name_in_graph) {
                    this.graph.removeInput(this.name_in_graph);
                }
            }
        }

        GraphInput.type = "graph/input";
        GraphInput.title = "Input";
        GraphInput.desc = "Input of the graph";

        class GraphOutput extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addInput("", "");
                this.name_in_graph = "";
                this.properties = { name: "", type: "" };
                this.widgets_up = true;
                this.size = [180, 60];
            }

            defineWidgets() {
                return [
                    {
                        id: "name",
                        type: "text",
                        name: "name",
                        label: "Name",
                        value: this.properties.name,
                        property: "name",
                    },
                    {
                        id: "type",
                        type: "text",
                        name: "type",
                        label: "Type",
                        value: this.properties.type,
                        property: "type",
                    },
                ];
            }

            onPropertyChanged(name, v) {
                if (name == "name") {
                    if (v == "" || v == this.name_in_graph || v == "enabled") {
                        return false;
                    }
                    if (this.graph) {
                        if (this.name_in_graph) {
                            this.graph.renameOutput(this.name_in_graph, v);
                        } else {
                            this.graph.addOutput(v, this.properties.type);
                        }
                    }
                    this.name_in_graph = v;
                    this.requestModernPatch(
                        ns.ModernNodeChangeMask.Layout |
                            ns.ModernNodeChangeMask.Data
                    );
                } else if (name == "type") {
                    this.updateType();
                }
            }

            onConfigure() {
                this.updateType();
            }

            updateType() {
                var type = this.properties.type;
                if (this.inputs[0].type != type) {
                    if (type == "action" || type == "event") {
                        type = LiteGraph.EVENT;
                    }
                    if (!LiteGraph.isValidConnection(this.inputs[0].type, type)) {
                        this.disconnectInput(0);
                    }
                    this.inputs[0].type = type;
                }
                if (this.graph && this.name_in_graph) {
                    this.graph.changeOutputType(this.name_in_graph, type);
                }
                this.requestModernPatch(
                    ns.ModernNodeChangeMask.Data |
                        ns.ModernNodeChangeMask.Ports
                );
            }

            onExecute() {
                this._value = this.getInputData(0);
                this.graph.setOutputData(this.properties.name, this._value);
            }

            onAction(action, param) {
                if (this.properties.type == LiteGraph.ACTION) {
                    this.graph.trigger(this.properties.name, param);
                }
            }

            onRemoved() {
                if (this.name_in_graph) {
                    this.graph.removeOutput(this.name_in_graph);
                }
            }

            getTitle() {
                if (this.flags.collapsed) {
                    return this.properties.name;
                }
                return this.title;
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                shellState.title = this.properties.name || this.title;
                shellState.headerMetaText = ns.describePortType(this.properties.type);
                shellState.minimumWidth = 214;
                return shellState;
            }

            getPortPresentation(kind, slotIndex, context) {
                var portPresentation = ns.BaseNode.prototype.getPortPresentation.call(
                    this,
                    kind,
                    slotIndex,
                    context
                );
                if (kind === "input" && slotIndex === 0) {
                    portPresentation.label = this.properties.name || "";
                }
                return portPresentation;
            }
        }

        GraphOutput.type = "graph/output";
        GraphOutput.title = "Output";
        GraphOutput.desc = "Output of the graph";

        LiteGraph.Subgraph = Subgraph;
        LiteGraph.GraphInput = GraphInput;
        LiteGraph.GraphOutput = GraphOutput;

        return [Subgraph, GraphInput, GraphOutput];
    });
})(typeof window !== "undefined" ? window : globalThis);
