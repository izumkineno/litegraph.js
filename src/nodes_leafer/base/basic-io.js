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
        id: "base/basic-io",
        define: function(api) {
            var LiteGraph = api.liteGraph;
            var BaseNode = api.DefaultModernNodeBase;
            var ModernNodeChangeMask = api.ModernNodeChangeMask;

            class DownloadData extends BaseNode {
                constructor(title) {
                    super(title);
                    this.size = [60, 30];
                    this.addInput("data", 0);
                    this.addInput("download", LiteGraph.ACTION);
                    this.properties = { filename: "data.json" };
                    this.value = null;
                }

                defineWidgets() {
                    return [
                        {
                            id: "download",
                            type: "button",
                            name: "download",
                            label: "Download",
                            value: null,
                            options: {
                                callback: this.downloadAsFile.bind(this),
                            },
                        },
                    ];
                }

                downloadAsFile() {
                    if (this.value == null) {
                        return;
                    }

                    var str =
                        this.value.constructor === String
                            ? this.value
                            : JSON.stringify(this.value);
                    var file = new Blob([str]);
                    var url = URL.createObjectURL(file);
                    var element = document.createElement("a");
                    element.setAttribute("href", url);
                    element.setAttribute("download", this.properties.filename);
                    element.style.display = "none";
                    document.body.appendChild(element);
                    element.click();
                    document.body.removeChild(element);
                    setTimeout(function() {
                        URL.revokeObjectURL(url);
                    }, 1000 * 60);
                }

                onAction() {
                    var that = this;
                    setTimeout(function() {
                        that.downloadAsFile();
                    }, 100);
                }

                onExecute() {
                    if (this.inputs[0]) {
                        this.value = this.getInputData(0);
                    }
                }

                getTitle() {
                    if (this.flags.collapsed) {
                        return this.properties.filename;
                    }
                    return this.title;
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "FILE";
                    shellState.minimumWidth = 168;
                    return shellState;
                }
            }

            DownloadData.type = "basic/download";
            DownloadData.title = "Download";
            DownloadData.desc = "Download some data";

            class Watch extends BaseNode {
                constructor(title) {
                    super(title);
                    this.size = [60, 30];
                    this.addInput("value", 0, { label: "" });
                    this.value = 0;
                    this._displayValue = Watch.toString(this.value);
                }

                onExecute() {
                    if (this.inputs[0]) {
                        this.value = this.getInputData(0);
                    }
                    this.syncDisplayValue();
                }

                getTitle() {
                    if (this.flags.collapsed) {
                        return this._displayValue;
                    }
                    return this.title;
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "LIVE";
                    shellState.summaryText = this._displayValue || "Waiting for input";
                    shellState.minimumWidth = 220;
                    return shellState;
                }

                getPortPresentation(kind, slotIndex, context) {
                    var portPresentation = BaseNode.prototype.getPortPresentation.call(
                        this,
                        kind,
                        slotIndex,
                        context
                    );
                    if (kind === "input" && slotIndex === 0 && portPresentation) {
                        portPresentation.label = "";
                    }
                    return portPresentation;
                }

                syncDisplayValue() {
                    var nextValue = Watch.toString(this.value);
                    if (nextValue === this._displayValue) {
                        return;
                    }
                    this._displayValue = nextValue;
                    var changeMask = ModernNodeChangeMask.Data;
                    if (this.flags.collapsed) {
                        changeMask |= ModernNodeChangeMask.Layout;
                    }
                    this.requestModernPatch(
                        changeMask
                    );
                }
            }

            Watch.type = "basic/watch";
            Watch.title = "Watch";
            Watch.desc = "Show value of input";
            Watch.toString = function(o) {
                if (o == null) {
                    return "null";
                }
                if (o.constructor === Number) {
                    return o.toFixed(3);
                }
                if (o.constructor === Array) {
                    var str = "[";
                    for (var i = 0; i < o.length; ++i) {
                        str +=
                            Watch.toString(o[i]) + (i + 1 != o.length ? "," : "");
                    }
                    return str + "]";
                }
                return String(o);
            };

            class Cast extends BaseNode {
                constructor(title) {
                    super(title);
                    this.addInput("in", 0);
                    this.addOutput("out", 0);
                    this.size = [40, 30];
                }

                onExecute() {
                    this.setOutputData(0, this.getInputData(0));
                }
            }

            Cast.type = "basic/cast";
            Cast.title = "Cast";
            Cast.desc = "Allows to connect different types";

            class ConsoleNode extends BaseNode {
                constructor(title) {
                    super(title);
                    this.mode = LiteGraph.ON_EVENT;
                    this.size = [80, 30];
                    this.addProperty("msg", "");
                    this.addInput("log", LiteGraph.EVENT);
                    this.addInput("msg", 0);
                }

                onAction(action, param) {
                    var msg = this.getInputData(1);
                    if (!msg) {
                        msg = this.properties.msg;
                    }
                    if (!msg) {
                        msg = "Event: " + param;
                    }
                    if (action == "log") {
                        console.log(msg);
                    } else if (action == "warn") {
                        console.warn(msg);
                    } else if (action == "error") {
                        console.error(msg);
                    }
                }

                onExecute() {
                    var msg = this.getInputData(1);
                    if (!msg) {
                        msg = this.properties.msg;
                    }
                    if (msg != null && typeof msg != "undefined") {
                        this.properties.msg = msg;
                        console.log(msg);
                    }
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "LOG";
                    shellState.minimumWidth = 164;
                    return shellState;
                }

                onGetInputs() {
                    return [
                        ["log", LiteGraph.ACTION],
                        ["warn", LiteGraph.ACTION],
                        ["error", LiteGraph.ACTION],
                    ];
                }
            }

            ConsoleNode.type = "basic/console";
            ConsoleNode.title = "Console";
            ConsoleNode.desc = "Show value inside the console";

            class AlertNode extends BaseNode {
                constructor(title) {
                    super(title);
                    this.mode = LiteGraph.ON_EVENT;
                    this.addProperty("msg", "");
                    this.addInput("", LiteGraph.EVENT);
                    this.size = [200, 30];
                }

                defineWidgets() {
                    return [
                        {
                            id: "msg",
                            type: "text",
                            name: "msg",
                            label: "Text",
                            value: this.properties.msg,
                            property: "msg",
                        },
                    ];
                }

                onConfigure(o) {
                    this.properties.msg = o.properties.msg;
                }

                onAction() {
                    var msg = this.properties.msg;
                    setTimeout(function() {
                        alert(msg);
                    }, 10);
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "EVENT";
                    shellState.minimumWidth = 204;
                    return shellState;
                }
            }

            AlertNode.type = "basic/alert";
            AlertNode.title = "Alert";
            AlertNode.desc = "Show an alert window";
            AlertNode.color = "#510";

            return [DownloadData, Watch, Cast, ConsoleNode, AlertNode];
        },
    };
});
