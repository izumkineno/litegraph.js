(function(global, factory) {
    var moduleDefinition = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = moduleDefinition;
    }

    var support = global && global.__litegraphNodesLeaferModuleSupport;
    if (support && typeof support.installBaseNodeModule === "function") {
        support.installBaseNodeModule(moduleDefinition);
    }
})(typeof window !== "undefined" ? window : globalThis, function() {
    return {
        id: "base/basic-script",
        define: function(api) {
            var LiteGraph = api.liteGraph;
            var BaseNode = api.DefaultModernNodeBase;

            class NodeScript extends BaseNode {
                constructor(title) {
                    super(title);
                    this.size = [60, 30];
                    this.addProperty("onExecute", "return A;");
                    this.addInput("A", 0);
                    this.addInput("B", 0);
                    this.addOutput("out", 0);
                    this._func = null;
                    this.data = {};
                }

                onConfigure(o) {
                    if (o.properties.onExecute && LiteGraph.allow_scripts) {
                        this.compileCode(o.properties.onExecute);
                    } else {
                        console.warn(
                            "Script not compiled, LiteGraph.allow_scripts is false"
                        );
                    }
                }

                onPropertyChanged(name, value) {
                    if (name == "onExecute" && LiteGraph.allow_scripts) {
                        this.compileCode(value);
                    } else {
                        console.warn(
                            "Script not compiled, LiteGraph.allow_scripts is false"
                        );
                    }
                }

                compileCode(code) {
                    this._func = null;
                    if (code.length > 256) {
                        console.warn("Script too long, max 256 chars");
                        return;
                    }

                    var codeLow = code.toLowerCase();
                    var forbiddenWords = [
                        "script",
                        "body",
                        "document",
                        "eval",
                        "nodescript",
                        "function",
                    ];

                    for (var i = 0; i < forbiddenWords.length; ++i) {
                        if (codeLow.indexOf(forbiddenWords[i]) != -1) {
                            console.warn("invalid script");
                            return;
                        }
                    }

                    try {
                        this._func = new Function("A", "B", "C", "DATA", "node", code);
                    } catch (err) {
                        console.error("Error parsing script");
                        console.error(err);
                    }
                }

                onExecute() {
                    if (!this._func) {
                        return;
                    }

                    try {
                        var A = this.getInputData(0);
                        var B = this.getInputData(1);
                        var C = this.getInputData(2);
                        this.setOutputData(0, this._func(A, B, C, this.data, this));
                    } catch (err) {
                        console.error("Error in script");
                        console.error(err);
                    }
                }

                onGetOutputs() {
                    return [["C", ""]];
                }
            }

            NodeScript.type = "basic/script";
            NodeScript.title = "Script";
            NodeScript.desc = "executes a code (max 256 characters)";
            NodeScript.widgets_info = {
                onExecute: { type: "code" },
            };

            return [NodeScript];
        },
    };
});
