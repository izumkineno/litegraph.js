const fs = require("fs");
const path = require("path");

describe("nodes_leafer base modern nodes", () => {
    const nodeTypes = [
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
        "basic/download",
        "basic/watch",
        "basic/cast",
        "basic/console",
        "basic/alert",
        "basic/script",
        "basic/CompareValues",
    ];

    function loadModernBaseNodes() {
        jest.resetModules();

        const runtime = require("../src/litegraph");
        const LiteGraph = runtime.LiteGraph;

        class TestModernNodeBase extends runtime.LGraphNode {
            constructor(title) {
                super(title);
                this.renderRuntime = "modern";
                this.__litegraphModernNode = true;
            }

            refreshModernPorts() {}

            requestModernPatch() {}

            consumeModernChangeMask() {
                return 0;
            }
        }

        LiteGraph.ModernNodeBase = TestModernNodeBase;
        LiteGraph.ModernNodeContracts = {
            MODERN_NODE_STATE_KEY: "__litegraphModernState",
        };
        LiteGraph.ModernNodeChangeMask = {};
        LiteGraph.registerModernNode = function(NodeClass) {
            this.registerNodeType(NodeClass.type, NodeClass);
            return NodeClass.type;
        };
        LiteGraph.registerModernNodes = function(nodeClasses) {
            return nodeClasses.map((NodeClass) => this.registerModernNode(NodeClass));
        };

        global.LiteGraph = LiteGraph;
        global.LGraph = runtime.LGraph;
        global.alert = jest.fn();
        global.fetch = jest.fn();
        global.FileReader = class FileReader {};
        global.Blob = global.Blob || class Blob {
            constructor(parts) {
                this.parts = parts;
            }
        };
        global.URL = global.URL || {};
        global.URL.createObjectURL = jest.fn(() => "blob:mock");
        global.URL.revokeObjectURL = jest.fn();

        require("../src/nodes_leafer/base/shared/runtime.js");
        require("../src/nodes_leafer/base/graph.js");
        require("../src/nodes_leafer/base/basic-value.js");
        require("../src/nodes_leafer/base/basic-data.js");
        require("../src/nodes_leafer/base/basic-io.js");
        require("../src/nodes_leafer/base/basic-script.js");
        require("../src/nodes_leafer/base/basic-compare.js");
        require("../src/nodes_leafer/base.js");

        return runtime;
    }

    afterEach(() => {
        delete global.LiteGraph;
        delete global.LGraph;
        delete global.alert;
        delete global.fetch;
        delete global.FileReader;
    });

    test("registers all base node types once", () => {
        const runtime = loadModernBaseNodes();
        const LiteGraph = runtime.LiteGraph;

        expect(LiteGraph.nodes_leafer.baseNodeTypes).toHaveLength(27);
        expect(Object.keys(LiteGraph.nodes_leafer.registeredBaseNodeTypes)).toHaveLength(
            27
        );
        for (const type of nodeTypes) {
            expect(LiteGraph.registered_node_types[type]).toBeTruthy();
        }

        LiteGraph.nodes_leafer.registerBaseNodes();
        expect(Object.keys(LiteGraph.nodes_leafer.registeredBaseNodeTypes)).toHaveLength(
            27
        );
    });

    test("nodes_leafer base modules no longer depend on addWidget", () => {
        const baseDir = path.join(__dirname, "../src/nodes_leafer/base");
        const files = fs
            .readdirSync(baseDir)
            .filter((entry) => entry.endsWith(".js"))
            .map((entry) => path.join(baseDir, entry));

        for (const filePath of files) {
            const source = fs.readFileSync(filePath, "utf8");
            expect(source.includes("addWidget(")).toBe(false);
        }
    });

    test("time node keeps legacy output semantics", () => {
        const runtime = loadModernBaseNodes();
        const LiteGraph = runtime.LiteGraph;
        const node = LiteGraph.createNode("basic/time");
        node.graph = { globaltime: 1.5 };

        node.onExecute();

        expect(node.outputs[0]._data).toBe(1500);
        expect(node.outputs[1]._data).toBe(1.5);
    });

    test("graph input and output preserve graph-bound data flow", () => {
        const runtime = loadModernBaseNodes();
        const LiteGraph = runtime.LiteGraph;
        const graph = new runtime.LGraph();

        const inputNode = LiteGraph.createNode("graph/input");
        graph.add(inputNode);
        inputNode.setProperty("name", "tick");
        inputNode.setProperty("type", "number");
        graph.inputs.tick.value = 12;
        inputNode.onExecute();
        expect(inputNode.outputs[0]._data).toBe(12);

        const outputNode = LiteGraph.createNode("graph/output");
        graph.add(outputNode);
        outputNode.setProperty("name", "done");
        outputNode.setProperty("type", "number");
        outputNode.getInputData = jest.fn(() => 99);
        outputNode.onExecute();
        expect(graph.outputs.done.value).toBe(99);
    });

    test("json parse parses and emits object payload", () => {
        const runtime = loadModernBaseNodes();
        const LiteGraph = runtime.LiteGraph;
        const node = LiteGraph.createNode("basic/jsonparse");
        node.getInputData = jest.fn((slot) =>
            slot === 1 ? '{"ok":true,"count":2}' : undefined
        );
        node.triggerSlot = jest.fn();

        node.onExecute();
        node.onAction("parse");
        node.onExecute();

        expect(node._obj).toEqual({ ok: true, count: 2 });
        expect(node.outputs[1]._data).toEqual({ ok: true, count: 2 });
        expect(node.triggerSlot).toHaveBeenCalledWith(0);
    });

    test("script node compiles and executes against legacy IO", () => {
        const runtime = loadModernBaseNodes();
        const LiteGraph = runtime.LiteGraph;
        LiteGraph.allow_scripts = true;
        const node = LiteGraph.createNode("basic/script");
        node.onPropertyChanged("onExecute", "return A + B;");
        node.getInputData = jest.fn((slot) => (slot === 0 ? 4 : slot === 1 ? 6 : 0));

        node.onExecute();

        expect(node.outputs[0]._data).toBe(10);
    });

    test("compare node preserves boolean output contract", () => {
        const runtime = loadModernBaseNodes();
        const LiteGraph = runtime.LiteGraph;
        const node = LiteGraph.createNode("basic/CompareValues");
        node.getInputData = jest.fn((slot) => (slot === 0 ? "x" : "x"));

        node.onExecute();

        expect(node.outputs[0]._data).toBe(true);
        expect(node.outputs[1]._data).toBe(false);
    });
});
