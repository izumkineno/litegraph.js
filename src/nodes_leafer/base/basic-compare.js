(function(global) {
    var LiteGraph = global && global.LiteGraph;
    var ns = LiteGraph && LiteGraph.nodes_leafer;
    if (!LiteGraph || !ns || typeof ns.registerBaseModule !== "function") {
        return;
    }

    ns.registerBaseModule("base/basic-compare", function() {
        class GenericCompare extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addInput("A", 0);
                this.addInput("B", 0);
                this.addOutput("true", "boolean");
                this.addOutput("false", "boolean");
                this.addProperty("A", 1);
                this.addProperty("B", 1);
                this.addProperty("OP", "==", "enum", {
                    values: GenericCompare.values,
                });
                this.size = [80, 60];
                this._lastResult = null;
            }

            defineWidgets() {
                return [
                    {
                        id: "operator",
                        type: "combo",
                        name: "OP",
                        label: "Op.",
                        value: this.properties.OP,
                        property: "OP",
                        options: {
                            values: GenericCompare.values,
                        },
                    },
                ];
            }

            getTitle() {
                return "*A " + this.properties.OP + " *B";
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                shellState.title = "Compare";
                shellState.headerMetaText = this.properties.OP;
                shellState.minimumWidth = 232;
                if (this._lastResult === true) {
                    shellState.bodyColor = "#15221C";
                    shellState.borderColor = "#2F6B53";
                    shellState.boxColor = "#8FD9B0";
                } else if (this._lastResult === false) {
                    shellState.bodyColor = "#24181B";
                    shellState.borderColor = "#74404A";
                    shellState.boxColor = "#F2A1AE";
                }
                return shellState;
            }

            onExecute() {
                var A = this.getInputData(0);
                if (A === undefined) {
                    A = this.properties.A;
                } else {
                    this.properties.A = A;
                }

                var B = this.getInputData(1);
                if (B === undefined) {
                    B = this.properties.B;
                } else {
                    this.properties.B = B;
                }

                var result = false;
                if (typeof A == typeof B) {
                    switch (this.properties.OP) {
                        case "==":
                        case "!=":
                            result = true;
                            switch (typeof A) {
                                case "object":
                                    var aProps = Object.getOwnPropertyNames(A);
                                    var bProps = Object.getOwnPropertyNames(B);
                                    if (aProps.length != bProps.length) {
                                        result = false;
                                        break;
                                    }
                                    for (var i = 0; i < aProps.length; ++i) {
                                        var propName = aProps[i];
                                        if (A[propName] !== B[propName]) {
                                            result = false;
                                            break;
                                        }
                                    }
                                    break;
                                default:
                                    result = A == B;
                            }
                            if (this.properties.OP == "!=") {
                                result = !result;
                            }
                            break;
                    }
                }

                this.setOutputData(0, result);
                this.setOutputData(1, !result);
                if (this._lastResult !== result) {
                    this._lastResult = result;
                    this.requestModernPatch(
                        ns.ModernNodeChangeMask.Data |
                            ns.ModernNodeChangeMask.Style
                    );
                }
            }
        }

        GenericCompare.type = "basic/CompareValues";
        GenericCompare.title = "Compare *";
        GenericCompare.desc = "evaluates condition between A and B";
        GenericCompare.values = ["==", "!="];
        GenericCompare["@OP"] = {
            type: "enum",
            title: "operation",
            values: GenericCompare.values,
        };

        return [GenericCompare];
    });
})(typeof window !== "undefined" ? window : globalThis);
