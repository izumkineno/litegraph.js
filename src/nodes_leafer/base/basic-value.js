(function(global) {
    var LiteGraph = global && global.LiteGraph;
    var ns = LiteGraph && LiteGraph.nodes_leafer;
    if (!LiteGraph || !ns || typeof ns.registerBaseModule !== "function") {
        return;
    }

    function setNodeValue(v) {
        this.setProperty("value", v);
    }

    ns.registerBaseModule("base/basic-value", function() {
        class Time extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addOutput("in ms", "number");
                this.addOutput("in sec", "number");
            }

            onExecute() {
                this.setOutputData(0, this.graph.globaltime * 1000);
                this.setOutputData(1, this.graph.globaltime);
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

            onDrawBackground() {
                this.outputs[0].label = this.properties.value.toFixed(3);
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
