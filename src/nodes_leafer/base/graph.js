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
                return [
                    {
                        id: "subgraph-left",
                        action: "subgraph-left",
                        label: "+",
                        placement: "footer-left",
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
                        label: "+",
                        placement: "footer-right",
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
                shellState.summaryText = "Double-click to open";
                return shellState;
            }

            onAction(action, param) {
                this.subgraph.onAction(action, param);
            }

            onExecute() {
                this.enabled = this.getInputOrProperty("enabled");
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

            onDrawBackground(ctx, graphcanvas, canvas, pos) {
                if (this.flags.collapsed) {
                    return;
                }

                var y = this.size[1] - LiteGraph.NODE_TITLE_HEIGHT + 0.5;
                var over = LiteGraph.isInsideRectangle(
                    pos[0],
                    pos[1],
                    this.pos[0],
                    this.pos[1] + y,
                    this.size[0],
                    LiteGraph.NODE_TITLE_HEIGHT
                );
                var overleft = LiteGraph.isInsideRectangle(
                    pos[0],
                    pos[1],
                    this.pos[0],
                    this.pos[1] + y,
                    this.size[0] / 2,
                    LiteGraph.NODE_TITLE_HEIGHT
                );

                ctx.fillStyle = over ? "#555" : "#222";
                ctx.beginPath();
                if (this._shape == LiteGraph.BOX_SHAPE) {
                    if (overleft) {
                        ctx.rect(0, y, this.size[0] / 2 + 1, LiteGraph.NODE_TITLE_HEIGHT);
                    } else {
                        ctx.rect(
                            this.size[0] / 2,
                            y,
                            this.size[0] / 2 + 1,
                            LiteGraph.NODE_TITLE_HEIGHT
                        );
                    }
                } else if (overleft) {
                    ctx.roundRect(
                        0,
                        y,
                        this.size[0] / 2 + 1,
                        LiteGraph.NODE_TITLE_HEIGHT,
                        [0, 0, 8, 8]
                    );
                } else {
                    ctx.roundRect(
                        this.size[0] / 2,
                        y,
                        this.size[0] / 2 + 1,
                        LiteGraph.NODE_TITLE_HEIGHT,
                        [0, 0, 8, 8]
                    );
                }

                if (over) {
                    ctx.fill();
                } else {
                    ctx.fillRect(0, y, this.size[0] + 1, LiteGraph.NODE_TITLE_HEIGHT);
                }

                ctx.textAlign = "center";
                ctx.font = "24px Arial";
                ctx.fillStyle = over ? "#DDD" : "#999";
                ctx.fillText("+", this.size[0] * 0.25, y + 24);
                ctx.fillText("+", this.size[0] * 0.75, y + 24);
            }

            onMouseDown(e, localpos, graphcanvas) {
                var y = this.size[1] - LiteGraph.NODE_TITLE_HEIGHT + 0.5;
                if (localpos[1] > y) {
                    if (localpos[0] < this.size[0] / 2) {
                        graphcanvas.showSubgraphPropertiesDialog(this);
                    } else {
                        graphcanvas.showSubgraphPropertiesDialogRight(this);
                    }
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
                }
            }

            onSubgraphRenamedInput(oldname, name) {
                var slot = this.findInputSlot(oldname);
                if (slot === -1) {
                    return;
                }
                this.getInputInfo(slot).name = name;
                this.syncModernPorts();
            }

            onSubgraphTypeChangeInput(name, type) {
                var slot = this.findInputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.getInputInfo(slot).type = type;
                this.syncModernPorts();
            }

            onSubgraphRemovedInput(name) {
                var slot = this.findInputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.removeInput(slot);
                this.syncModernPorts();
            }

            onSubgraphNewOutput(name, type) {
                var slot = this.findOutputSlot(name);
                if (slot === -1) {
                    this.addOutput(name, type);
                    this.syncModernPorts();
                }
            }

            onSubgraphRenamedOutput(oldname, name) {
                var slot = this.findOutputSlot(oldname);
                if (slot === -1) {
                    return;
                }
                this.getOutputInfo(slot).name = name;
                this.syncModernPorts();
            }

            onSubgraphTypeChangeOutput(name, type) {
                var slot = this.findOutputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.getOutputInfo(slot).type = type;
                this.syncModernPorts();
            }

            onSubgraphRemovedOutput(name) {
                var slot = this.findOutputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.removeOutput(slot);
                this.syncModernPorts();
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
