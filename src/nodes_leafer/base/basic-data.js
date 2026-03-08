(function(global) {
    var LiteGraph = global && global.LiteGraph;
    var ns = LiteGraph && LiteGraph.nodes_leafer;
    if (!LiteGraph || !ns || typeof ns.registerBaseModule !== "function") {
        return;
    }

    function setValue(v) {
        this.setProperty("value", v);
    }

    function getJsonStatus(node) {
        if (node.boxcolor === "red") {
            return "ERROR";
        }
        if (node.boxcolor === "#AEA") {
            return "READY";
        }
        return "IDLE";
    }

    function getJsonTone(status) {
        if (status === "ERROR") {
            return {
                bodyColor: "#23171A",
                borderColor: "#743B45",
                boxColor: "#F199A5",
            };
        }
        if (status === "READY") {
            return {
                bodyColor: "#15211C",
                borderColor: "#2C6651",
                boxColor: "#7FD2AB",
            };
        }
        return null;
    }

    ns.registerBaseModule("base/basic-data", function() {
        class ConstantFile extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addInput("url", "string");
                this.addOutput("file", "string");
                this.addProperty("url", "");
                this.addProperty("type", "text");
                this._data = null;
            }

            defineWidgets() {
                return [
                    {
                        id: "url",
                        type: "text",
                        name: "url",
                        label: "URL",
                        value: this.properties.url,
                        property: "url",
                    },
                ];
            }

            onPropertyChanged(name, value) {
                if (name == "url") {
                    if (value == null || value == "") {
                        this._data = null;
                    } else {
                        this.fetchFile(value);
                    }
                } else if (name == "type") {
                    this.requestModernPatch(
                        ns.ModernNodeChangeMask.Layout |
                            ns.ModernNodeChangeMask.Data |
                            ns.ModernNodeChangeMask.Style
                    );
                }
            }

            onExecute() {
                var url = this.getInputData(0) || this.properties.url;
                if (url && (url != this._url || this._type != this.properties.type)) {
                    this.fetchFile(url);
                }
                this.setOutputData(0, this._data);
            }

            setValue(v) {
                setValue.call(this, v);
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                shellState.headerMetaText = ns.describePortType(this.properties.type);
                shellState.minimumWidth = 220;
                var tone = getJsonTone(getJsonStatus(this));
                if (tone) {
                    shellState.bodyColor = tone.bodyColor;
                    shellState.borderColor = tone.borderColor;
                    shellState.boxColor = tone.boxColor;
                }
                return shellState;
            }

            fetchFile(url) {
                var that = this;
                if (!url || url.constructor !== String) {
                    that._data = null;
                    that.boxcolor = null;
                    that.requestModernPatch(
                        ns.ModernNodeChangeMask.Data |
                            ns.ModernNodeChangeMask.Style
                    );
                    return;
                }

                this._url = url;
                this._type = this.properties.type;
                if (url.substr(0, 4) == "http" && LiteGraph.proxy) {
                    url = LiteGraph.proxy + url.substr(url.indexOf(":") + 3);
                }

                fetch(url)
                    .then(function(response) {
                        if (!response.ok) {
                            throw new Error("File not found");
                        }
                        if (that.properties.type == "arraybuffer") {
                            return response.arrayBuffer();
                        }
                        if (that.properties.type == "text") {
                            return response.text();
                        }
                        if (that.properties.type == "json") {
                            return response.json();
                        }
                        if (that.properties.type == "blob") {
                            return response.blob();
                        }
                        return null;
                    })
                    .then(function(data) {
                        that._data = data;
                        that.boxcolor = "#AEA";
                        that.requestModernPatch(
                            ns.ModernNodeChangeMask.Data |
                                ns.ModernNodeChangeMask.Style
                        );
                    })
                    .catch(function() {
                        that._data = null;
                        that.boxcolor = "red";
                        that.requestModernPatch(
                            ns.ModernNodeChangeMask.Data |
                                ns.ModernNodeChangeMask.Style
                        );
                        console.error("error fetching file:", url);
                    });
            }

            onDropFile(file) {
                var that = this;
                this._url = file.name;
                this._type = this.properties.type;
                this.properties.url = file.name;

                var reader = new FileReader();
                reader.onload = function(e) {
                    that.boxcolor = "#AEA";
                    var value = e.target.result;
                    if (that.properties.type == "json") {
                        value = JSON.parse(value);
                    }
                    that._data = value;
                    that.requestModernPatch(
                        ns.ModernNodeChangeMask.Data |
                            ns.ModernNodeChangeMask.Style
                    );
                };

                if (that.properties.type == "arraybuffer") {
                    reader.readAsArrayBuffer(file);
                } else if (
                    that.properties.type == "text" ||
                    that.properties.type == "json"
                ) {
                    reader.readAsText(file);
                } else if (that.properties.type == "blob") {
                    reader.readAsBinaryString(file);
                }
            }
        }

        ConstantFile.type = "basic/file";
        ConstantFile.title = "Const File";
        ConstantFile.desc = "Fetches a file from an url";
        ConstantFile["@type"] = {
            type: "enum",
            values: ["text", "arraybuffer", "blob", "json"],
        };

        class JSONParse extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addInput("parse", LiteGraph.ACTION);
                this.addInput("json", "string");
                this.addOutput("done", LiteGraph.EVENT);
                this.addOutput("object", "object");
                this._str = null;
                this._obj = null;
            }

            defineWidgets() {
                return [
                    {
                        id: "parse",
                        type: "button",
                        name: "parse",
                        label: "Parse",
                        value: null,
                        options: {
                            callback: this.parse.bind(this),
                        },
                    },
                ];
            }

            parse() {
                this._str = this.getInputData(1);
                if (!this._str) {
                    this.boxcolor = null;
                    this.requestModernPatch(
                        ns.ModernNodeChangeMask.Data |
                            ns.ModernNodeChangeMask.Style
                    );
                    return;
                }

                try {
                    this._obj = JSON.parse(this._str);
                    this.boxcolor = "#AEA";
                    this.requestModernPatch(
                        ns.ModernNodeChangeMask.Data |
                            ns.ModernNodeChangeMask.Style
                    );
                    this.triggerSlot(0);
                } catch (err) {
                    this.boxcolor = "red";
                    this.requestModernPatch(
                        ns.ModernNodeChangeMask.Data |
                            ns.ModernNodeChangeMask.Style
                    );
                }
            }

            onExecute() {
                this._str = this.getInputData(1);
                this.setOutputData(1, this._obj);
            }

            onAction(name) {
                if (name == "parse") {
                    this.parse();
                }
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                var status = getJsonStatus(this);
                var tone = getJsonTone(status);
                shellState.title = "JSON Parser";
                shellState.headerMetaText = status;
                shellState.minimumWidth = 208;
                if (tone) {
                    shellState.bodyColor = tone.bodyColor;
                    shellState.borderColor = tone.borderColor;
                    shellState.boxColor = tone.boxColor;
                }
                return shellState;
            }
        }

        JSONParse.type = "basic/jsonparse";
        JSONParse.title = "JSON Parse";
        JSONParse.desc = "Parses JSON String into object";

        class ConstantData extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addOutput("data", "object");
                this.addProperty("value", "");
                this.size = [140, 30];
                this._value = null;
            }

            defineWidgets() {
                return [
                    {
                        id: "value",
                        type: "text",
                        name: "value",
                        label: "JSON",
                        value: this.properties.value,
                        property: "value",
                    },
                ];
            }

            onPropertyChanged(name, value) {
                if (value == null || value == "") {
                    return;
                }

                try {
                    this._value = JSON.parse(value);
                    this.boxcolor = "#AEA";
                } catch (err) {
                    this.boxcolor = "red";
                }
            }

            onExecute() {
                this.setOutputData(0, this._value);
            }

            setValue(v) {
                setValue.call(this, v);
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                var status = getJsonStatus(this);
                var tone = getJsonTone(status);
                shellState.headerMetaText = status;
                shellState.minimumWidth = 180;
                if (tone) {
                    shellState.bodyColor = tone.bodyColor;
                    shellState.borderColor = tone.borderColor;
                    shellState.boxColor = tone.boxColor;
                }
                return shellState;
            }
        }

        ConstantData.type = "basic/data";
        ConstantData.title = "Const Data";
        ConstantData.desc = "Constant Data";

        class ConstantArray extends ns.BaseNode {
            constructor(title) {
                super(title);
                this._value = [];
                this.addInput("json", "");
                this.addOutput("arrayOut", "array");
                this.addOutput("length", "number");
                this.addProperty("value", "[]");
                this.size = [140, 50];
            }

            defineWidgets() {
                return [
                    {
                        id: "value",
                        type: "text",
                        name: "value",
                        label: "Array",
                        value: this.properties.value,
                        property: "value",
                    },
                ];
            }

            onPropertyChanged(name, value) {
                if (value == null || value == "") {
                    return;
                }

                try {
                    if (value[0] != "[") {
                        this._value = JSON.parse("[" + value + "]");
                    } else {
                        this._value = JSON.parse(value);
                    }
                    this.boxcolor = "#AEA";
                } catch (err) {
                    this.boxcolor = "red";
                }
            }

            onExecute() {
                var value = this.getInputData(0);
                if (value && value.length) {
                    if (!this._value) {
                        this._value = [];
                    }
                    this._value.length = value.length;
                    for (var i = 0; i < value.length; ++i) {
                        this._value[i] = value[i];
                    }
                }
                this.setOutputData(0, this._value);
                this.setOutputData(
                    1,
                    this._value ? this._value.length || 0 : 0
                );
            }

            setValue(v) {
                setValue.call(this, v);
            }

            getShellState(context) {
                var shellState = ns.BaseNode.prototype.getShellState.call(
                    this,
                    context
                );
                shellState.headerMetaText = "ARRAY";
                shellState.minimumWidth = 188;
                return shellState;
            }
        }

        ConstantArray.type = "basic/array";
        ConstantArray.title = "Const Array";
        ConstantArray.desc = "Constant Array";

        class SetArray extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addInput("arr", "array");
                this.addInput("value", "");
                this.addOutput("arr", "array");
                this.properties = { index: 0 };
            }

            defineWidgets() {
                return [
                    {
                        id: "index",
                        type: "number",
                        name: "index",
                        label: "Index",
                        value: this.properties.index,
                        property: "index",
                        options: {
                            step: 10,
                            min: 0,
                            precision: 0,
                        },
                    },
                ];
            }

            onExecute() {
                var arr = this.getInputData(0);
                if (!arr) {
                    return;
                }
                var value = this.getInputData(1);
                if (value === undefined) {
                    return;
                }
                if (this.properties.index) {
                    arr[Math.floor(this.properties.index)] = value;
                }
                this.setOutputData(0, arr);
            }
        }

        SetArray.type = "basic/set_array";
        SetArray.title = "Set Array";
        SetArray.desc = "Sets index of array";

        class ArrayElement extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addInput("array", "array,table,string");
                this.addInput("index", "number");
                this.addOutput("value", "");
                this.addProperty("index", 0);
            }

            onExecute() {
                var array = this.getInputData(0);
                var index = this.getInputData(1);
                if (index == null) {
                    index = this.properties.index;
                }
                if (array == null || index == null) {
                    return;
                }
                this.setOutputData(0, array[Math.floor(Number(index))]);
            }
        }

        ArrayElement.type = "basic/array[]";
        ArrayElement.title = "Array[i]";
        ArrayElement.desc = "Returns an element from an array";

        class TableElement extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addInput("table", "table");
                this.addInput("row", "number");
                this.addInput("col", "number");
                this.addOutput("value", "");
                this.addProperty("row", 0);
                this.addProperty("column", 0);
            }

            onExecute() {
                var table = this.getInputData(0);
                var row = this.getInputData(1);
                var col = this.getInputData(2);
                if (row == null) {
                    row = this.properties.row;
                }
                if (col == null) {
                    col = this.properties.column;
                }
                if (table == null || row == null || col == null) {
                    return;
                }
                var targetRow = table[Math.floor(Number(row))];
                if (targetRow) {
                    this.setOutputData(0, targetRow[Math.floor(Number(col))]);
                } else {
                    this.setOutputData(0, null);
                }
            }
        }

        TableElement.type = "basic/table[][]";
        TableElement.title = "Table[row][col]";
        TableElement.desc = "Returns an element from a table";

        class ObjectProperty extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addInput("obj", "object");
                this.addOutput("property", 0);
                this.addProperty("value", 0);
                this.size = [140, 30];
                this._value = null;
            }

            defineWidgets() {
                return [
                    {
                        id: "value",
                        type: "text",
                        name: "value",
                        label: "Prop.",
                        value: this.properties.value,
                        property: "value",
                    },
                ];
            }

            setValue(v) {
                this.properties.value = v;
            }

            getTitle() {
                if (this.flags.collapsed) {
                    return "in." + this.properties.value;
                }
                return this.title;
            }

            onPropertyChanged(name, value) {
                this.properties.value = value;
            }

            onExecute() {
                var data = this.getInputData(0);
                if (data != null) {
                    this.setOutputData(0, data[this.properties.value]);
                }
            }
        }

        ObjectProperty.type = "basic/object_property";
        ObjectProperty.title = "Object property";
        ObjectProperty.desc = "Outputs the property of an object";

        class ObjectKeys extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addInput("obj", "");
                this.addOutput("keys", "array");
                this.size = [140, 30];
            }

            onExecute() {
                var data = this.getInputData(0);
                if (data != null) {
                    this.setOutputData(0, Object.keys(data));
                }
            }
        }

        ObjectKeys.type = "basic/object_keys";
        ObjectKeys.title = "Object keys";
        ObjectKeys.desc = "Outputs an array with the keys of an object";

        class SetObject extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addInput("obj", "");
                this.addInput("value", "");
                this.addOutput("obj", "");
                this.properties = { property: "" };
            }

            defineWidgets() {
                return [
                    {
                        id: "property",
                        type: "text",
                        name: "property",
                        label: "Prop.",
                        value: this.properties.property,
                        property: "property",
                    },
                ];
            }

            onExecute() {
                var obj = this.getInputData(0);
                if (!obj) {
                    return;
                }
                var value = this.getInputData(1);
                if (value === undefined) {
                    return;
                }
                if (this.properties.property) {
                    obj[this.properties.property] = value;
                }
                this.setOutputData(0, obj);
            }
        }

        SetObject.type = "basic/set_object";
        SetObject.title = "Set Object";
        SetObject.desc = "Adds propertiesrty to object";

        class MergeObjects extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.addInput("A", "object");
                this.addInput("B", "object");
                this.addOutput("out", "object");
                this._result = {};
                this.size = this.computeSize();
            }

            defineWidgets() {
                return [
                    {
                        id: "clear",
                        type: "button",
                        name: "clear",
                        label: "Clear",
                        value: null,
                        options: {
                            callback: this.clearResult.bind(this),
                        },
                    },
                ];
            }

            clearResult() {
                this._result = {};
            }

            onExecute() {
                var A = this.getInputData(0);
                var B = this.getInputData(1);
                var result = this._result;
                if (A) {
                    for (var keyA in A) {
                        result[keyA] = A[keyA];
                    }
                }
                if (B) {
                    for (var keyB in B) {
                        result[keyB] = B[keyB];
                    }
                }
                this.setOutputData(0, result);
            }
        }

        MergeObjects.type = "basic/merge_objects";
        MergeObjects.title = "Merge Objects";
        MergeObjects.desc = "Creates an object copying properties from others";

        class Variable extends ns.BaseNode {
            constructor(title) {
                super(title);
                this.size = [60, 30];
                this.addInput("in");
                this.addOutput("out");
                this.properties = {
                    varname: "myname",
                    container: Variable.LITEGRAPH,
                };
                this.value = null;
            }

            onExecute() {
                var container = this.getContainer();
                if (this.isInputConnected(0)) {
                    this.value = this.getInputData(0);
                    container[this.properties.varname] = this.value;
                    this.setOutputData(0, this.value);
                    return;
                }
                this.setOutputData(0, container[this.properties.varname]);
            }

            getContainer() {
                switch (this.properties.container) {
                    case Variable.GRAPH:
                        if (this.graph) {
                            return this.graph.vars;
                        }
                        return {};
                    case Variable.GLOBALSCOPE:
                        return global;
                    case Variable.LITEGRAPH:
                    default:
                        return LiteGraph.Globals;
                }
            }

            getTitle() {
                return this.properties.varname;
            }
        }

        Variable.type = "basic/variable";
        Variable.title = "Variable";
        Variable.desc = "store/read variable value";
        Variable.LITEGRAPH = 0;
        Variable.GRAPH = 1;
        Variable.GLOBALSCOPE = 2;
        Variable["@container"] = {
            type: "enum",
            values: {
                litegraph: Variable.LITEGRAPH,
                graph: Variable.GRAPH,
                global: Variable.GLOBALSCOPE,
            },
        };

        return [
            ConstantFile,
            JSONParse,
            ConstantData,
            ConstantArray,
            SetArray,
            ArrayElement,
            TableElement,
            ObjectProperty,
            ObjectKeys,
            SetObject,
            MergeObjects,
            Variable,
        ];
    });
})(typeof window !== "undefined" ? window : globalThis);
