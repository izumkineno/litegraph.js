(function(global, factory) {
    var moduleDefinition = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = moduleDefinition;
    }

    var support = global && global.__litegraphNodesLeaferModuleSupport;
    if (support) {
        if (typeof support.installNodeSetModule === "function") {
            support.installNodeSetModule("logic", moduleDefinition);
        } else if (typeof support.installBaseNodeModule === "function") {
            support.installBaseNodeModule(moduleDefinition);
        }
    }
})(typeof window !== "undefined" ? window : globalThis, function() {
    function requestPatch(node, ModernNodeChangeMask, mask) {
        if (!node || typeof node.requestModernPatch !== "function") {
            return;
        }
        node.requestModernPatch(
            mask ||
                (ModernNodeChangeMask.Data | ModernNodeChangeMask.Style)
        );
    }

    return {
        id: "logic/core",
        define: function(api) {
            var LiteGraph = api.liteGraph;
            var BaseNode = api.DefaultModernNodeBase;
            var ModernNodeChangeMask = api.ModernNodeChangeMask;
            var truncateText = api.utils.truncateText;

            class Selector extends BaseNode {
                constructor(title) {
                    super(title);
                    this.addInput("sel", "number");
                    this.addInput("A");
                    this.addInput("B");
                    this.addInput("C");
                    this.addInput("D");
                    this.addOutput("out");
                    this.selected = 0;
                    this.size = [150, 90];
                }

                onExecute() {
                    var sel = this.getInputData(0);
                    if (sel == null || sel.constructor !== Number) {
                        sel = 0;
                    }
                    this.selected = sel = Math.round(sel) % (this.inputs.length - 1);
                    var value = this.getInputData(sel + 1);
                    if (value !== undefined) {
                        this.setOutputData(0, value);
                    }
                    requestPatch(this, ModernNodeChangeMask);
                }

                onGetInputs() {
                    return [
                        ["E", 0],
                        ["F", 0],
                        ["G", 0],
                        ["H", 0],
                    ];
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    var labels = this.inputs ? this.inputs.slice(1) : [];
                    var current = labels[this.selected];
                    shellState.headerMetaText = "SELECT";
                    shellState.minimumWidth = 176;
                    shellState.summaryText = current
                        ? "slot " + truncateText(current.name || "", 10)
                        : "slot A";
                    return shellState;
                }
            }

            Selector.type = "logic/selector";
            Selector.title = "Selector";
            Selector.desc = "selects an output";

            class Sequence extends BaseNode {
                constructor(title) {
                    super(title);
                    this.properties = {
                        sequence: "A,B,C",
                    };
                    this.addInput("index", "number");
                    this.addInput("seq");
                    this.addOutput("out");
                    this.index = 0;
                    this.values = this.properties.sequence.split(",");
                    this.size = [170, 74];
                }

                defineWidgets() {
                    return [
                        {
                            id: "sequence",
                            type: "text",
                            name: "sequence",
                            label: "Seq",
                            value: this.properties.sequence,
                            property: "sequence",
                        },
                    ];
                }

                onPropertyChanged(name, value) {
                    if (name == "sequence") {
                        this.values = String(value || "").split(",");
                        requestPatch(this, ModernNodeChangeMask);
                    }
                }

                onExecute() {
                    var seq = this.getInputData(1);
                    if (seq && seq != this.current_sequence) {
                        this.values = String(seq).split(",");
                        this.current_sequence = seq;
                    }
                    var index = this.getInputData(0);
                    if (index == null) {
                        index = 0;
                    }
                    this.index = index = Math.round(index) % this.values.length;
                    this.setOutputData(0, this.values[index]);
                    requestPatch(this, ModernNodeChangeMask);
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "SEQ";
                    shellState.minimumWidth = 188;
                    shellState.summaryText =
                        this.values && this.values.length
                            ? truncateText(this.values[this.index], 18)
                            : "";
                    return shellState;
                }
            }

            Sequence.type = "logic/sequence";
            Sequence.title = "Sequence";
            Sequence.desc = "select one element from a sequence from a string";

            class LogicAnd extends BaseNode {
                constructor(title) {
                    super(title);
                    this.properties = {};
                    this.addInput("a", "boolean");
                    this.addInput("b", "boolean");
                    this.addOutput("out", "boolean");
                    this.size = [140, 60];
                }

                onExecute() {
                    var result = true;
                    for (var inputIndex in this.inputs) {
                        if (!this.getInputData(inputIndex)) {
                            result = false;
                            break;
                        }
                    }
                    this.setOutputData(0, result);
                }

                onGetInputs() {
                    return [["and", "boolean"]];
                }
            }

            LogicAnd.type = "logic/AND";
            LogicAnd.title = "AND";
            LogicAnd.desc = "Return true if all inputs are true";

            class LogicOr extends BaseNode {
                constructor(title) {
                    super(title);
                    this.properties = {};
                    this.addInput("a", "boolean");
                    this.addInput("b", "boolean");
                    this.addOutput("out", "boolean");
                    this.size = [140, 60];
                }

                onExecute() {
                    var result = false;
                    for (var inputIndex in this.inputs) {
                        if (this.getInputData(inputIndex)) {
                            result = true;
                            break;
                        }
                    }
                    this.setOutputData(0, result);
                }

                onGetInputs() {
                    return [["or", "boolean"]];
                }
            }

            LogicOr.type = "logic/OR";
            LogicOr.title = "OR";
            LogicOr.desc = "Return true if at least one input is true";

            class LogicNot extends BaseNode {
                constructor(title) {
                    super(title);
                    this.properties = {};
                    this.addInput("in", "boolean");
                    this.addOutput("out", "boolean");
                    this.size = [120, 52];
                }

                onExecute() {
                    this.setOutputData(0, !this.getInputData(0));
                }
            }

            LogicNot.type = "logic/NOT";
            LogicNot.title = "NOT";
            LogicNot.desc = "Return the logical negation";

            class LogicCompare extends BaseNode {
                constructor(title) {
                    super(title);
                    this.properties = {};
                    this.addInput("a", "boolean");
                    this.addInput("b", "boolean");
                    this.addOutput("out", "boolean");
                    this.size = [148, 60];
                }

                onExecute() {
                    var last = null;
                    var result = true;
                    for (var inputIndex in this.inputs) {
                        if (last === null) {
                            last = this.getInputData(inputIndex);
                        } else if (last != this.getInputData(inputIndex)) {
                            result = false;
                            break;
                        }
                    }
                    this.setOutputData(0, result);
                }

                onGetInputs() {
                    return [["bool", "boolean"]];
                }
            }

            LogicCompare.type = "logic/CompareBool";
            LogicCompare.title = "bool == bool";
            LogicCompare.desc = "Compare for logical equality";

            class LogicBranch extends BaseNode {
                constructor(title) {
                    super(title);
                    this.properties = {};
                    this.addInput("onTrigger", LiteGraph.ACTION);
                    this.addInput("condition", "boolean");
                    this.addOutput("true", LiteGraph.EVENT);
                    this.addOutput("false", LiteGraph.EVENT);
                    this.mode = LiteGraph.ON_TRIGGER;
                    this.size = [144, 58];
                }

                onExecute() {
                    var condition = this.getInputData(1);
                    if (condition) {
                        this.triggerSlot(0);
                    } else {
                        this.triggerSlot(1);
                    }
                }
            }

            LogicBranch.type = "logic/IF";
            LogicBranch.title = "Branch";
            LogicBranch.desc = "Branch execution on condition";

            return [
                Selector,
                Sequence,
                LogicAnd,
                LogicOr,
                LogicNot,
                LogicCompare,
                LogicBranch,
            ];
        },
    };
});
