(function(global) {
    var LiteGraph = global && global.LiteGraph;
    var ns = LiteGraph && LiteGraph.nodes_leafer;
    if (!LiteGraph || !ns || typeof ns.registerBaseModule !== "function") {
        return;
    }

    function setNodeValue(v) {
        this.setProperty("value", v);
    }

    function formatCompactNumber(value) {
        var numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return "0";
        }
        return numericValue.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    }

    ns.registerBaseModule("base/basic-value", function() {
        class Time extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addOutput("in ms", "number");
                this.addOutput("in sec", "number");
                this.size = [160, 42];
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                shellState.headerMetaText = "CLOCK";
                shellState.summaryText =
                    this.graph && Number.isFinite(this.graph.globaltime)
                        ? formatCompactNumber(this.graph.globaltime) + " s"
                        : "Graph clock";
                shellState.minimumWidth = 156;
                return shellState;
            }

            onExecute() {
                this.setOutputData(0, this.graph.globaltime * 1000);
                this.setOutputData(1, this.graph.globaltime);
                this.requestModernPatch(ns.ModernNodeChangeMask.Data);
            }
        }

        Time.type = "basic/time";
        Time.title = "Time";
        Time.desc = "Time";

        class ConstantNumber extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addOutput("value", "number");
                this.addProperty("value", 1.0);
                this.size = [180, 30];
            }

            defineWidgets() {
                return [
                    {
                        id: "value",
                        type: "number",
                        name: "value",
                        label: "Value",
                        value: this.properties.value,
                        property: "value",
                        options: {
                            step: 1,
                        },
                    },
                ];
            }

            onExecute() {
                this.setOutputData(0, parseFloat(this.properties.value));
            }

            getTitle() {
                if (this.flags.collapsed) {
                    return this.properties.value;
                }
                return this.title;
            }

            setValue(v) {
                setNodeValue.call(this, v);
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                shellState.headerMetaText = formatCompactNumber(
                    this.properties.value
                );
                shellState.minimumWidth = 180;
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
                    portPresentation.label = formatCompactNumber(
                        this.properties.value
                    );
                }
                return portPresentation;
            }
        }

        ConstantNumber.type = "basic/const";
        ConstantNumber.title = "Const Number";
        ConstantNumber.desc = "Constant number";

        class ConstantBoolean extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addOutput("bool", "boolean");
                this.addProperty("value", true);
                this.size = [140, 30];
            }

            defineWidgets() {
                return [
                    {
                        id: "value",
                        type: "toggle",
                        name: "value",
                        label: "Value",
                        value: this.properties.value,
                        property: "value",
                    },
                ];
            }

            getTitle() {
                return ConstantNumber.prototype.getTitle.call(this);
            }

            onExecute() {
                this.setOutputData(0, this.properties.value);
            }

            setValue(v) {
                setNodeValue.call(this, v);
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                shellState.headerMetaText = this.properties.value ? "TRUE" : "FALSE";
                shellState.minimumWidth = 168;
                return shellState;
            }

            onGetInputs() {
                return [["toggle", LiteGraph.ACTION]];
            }

            onAction() {
                this.setValue(!this.properties.value);
            }
        }

        ConstantBoolean.type = "basic/boolean";
        ConstantBoolean.title = "Const Boolean";
        ConstantBoolean.desc = "Constant boolean";

        class ConstantString extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addOutput("string", "string");
                this.addProperty("value", "");
                this.size = [180, 30];
            }

            defineWidgets() {
                return [
                    {
                        id: "value",
                        type: "text",
                        name: "value",
                        label: "Value",
                        value: this.properties.value,
                        property: "value",
                    },
                ];
            }

            getTitle() {
                return ConstantNumber.prototype.getTitle.call(this);
            }

            onExecute() {
                this.setOutputData(0, this.properties.value);
            }

            setValue(v) {
                setNodeValue.call(this, v);
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                shellState.headerMetaText = this.properties.value
                    ? ns.truncateText(this.properties.value, 14)
                    : "EMPTY";
                shellState.minimumWidth = 196;
                return shellState;
            }

            onDropFile(file) {
                var that = this;
                var reader = new FileReader();
                reader.onload = function(e) {
                    that.setProperty("value", e.target.result);
                };
                reader.readAsText(file);
            }
        }

        ConstantString.type = "basic/string";
        ConstantString.title = "Const String";
        ConstantString.desc = "Constant string";

        class ConstantObject extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addOutput("obj", "object");
                this.size = [120, 30];
                this._object = {};
            }

            onExecute() {
                this.setOutputData(0, this._object);
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                shellState.headerMetaText = "OBJECT";
                shellState.minimumWidth = 140;
                return shellState;
            }
        }

        ConstantObject.type = "basic/object";
        ConstantObject.title = "Const Object";
        ConstantObject.desc = "Constant Object";

        return [
            Time,
            ConstantNumber,
            ConstantBoolean,
            ConstantString,
            ConstantObject,
        ];
    });
})(typeof window !== "undefined" ? window : globalThis);
