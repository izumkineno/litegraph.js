const fs = require("fs");
const path = require("path");

describe("nodes_leafer events and logic modern nodes", () => {
    const eventTypes = [
        "events/log",
        "events/trigger",
        "events/sequence",
        "events/waitAll",
        "events/stepper",
        "events/filter",
        "events/branch",
        "events/counter",
        "events/delay",
        "events/timer",
        "events/semaphore",
        "events/once",
        "basic/data_store",
    ];
    const logicTypes = [
        "logic/selector",
        "logic/sequence",
        "logic/AND",
        "logic/OR",
        "logic/NOT",
        "logic/CompareBool",
        "logic/IF",
    ];

    function loadModernEventAndLogicNodes() {
        jest.resetModules();
        delete global.__litegraphNodesLeaferModuleSupport;
        delete global.__litegraphNodesLeaferModules;
        delete global.__LITEGRAPH_PENDING_MODERN_NODE_MODULES__;

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

            getShellState() {
                return {};
            }

            getPortPresentation() {
                return {};
            }
        }

        LiteGraph.ModernNodeBase = TestModernNodeBase;
        LiteGraph.DefaultModernNodeBase = TestModernNodeBase;
        LiteGraph.ModernNodeContracts = {
            MODERN_NODE_STATE_KEY: "__litegraphModernState",
        };
        LiteGraph.ModernNodeChangeMask = {
            None: 0,
            Data: 1 << 0,
            Layout: 1 << 1,
            Style: 1 << 2,
            Ports: 1 << 3,
            Interaction: 1 << 4,
            All: (1 << 5) - 1,
        };
        LiteGraph.registerModernNode = function(NodeClass) {
            this.registerNodeType(NodeClass.type, NodeClass);
            return NodeClass.type;
        };
        LiteGraph.registerModernNodes = function(nodeClasses) {
            return nodeClasses.map((NodeClass) => this.registerModernNode(NodeClass));
        };
        LiteGraph.__installedModernNodeModuleIds = new Set();
        LiteGraph.installModernNodeModule = function(moduleDefinition) {
            if (this.__installedModernNodeModuleIds.has(moduleDefinition.id)) {
                return [];
            }
            const nodeClasses = moduleDefinition.define({
                liteGraph: this,
                ModernNodeBase: this.ModernNodeBase,
                DefaultModernNodeBase: this.DefaultModernNodeBase,
                ModernNodeChangeMask: this.ModernNodeChangeMask,
                ModernNodeContracts: this.ModernNodeContracts,
                getModernWidgetRenderer: function() {
                    return undefined;
                },
                utils: {
                    truncateText(value, maxLength) {
                        const text = String(value == null ? "" : value);
                        return text.length > maxLength
                            ? text.slice(0, maxLength - 3) + "..."
                            : text;
                    },
                    describePortType(type) {
                        if (type === LiteGraph.EVENT || type === LiteGraph.ACTION) {
                            return "EVENT";
                        }
                        if (type == null || type === "" || type === -1 || type === 0) {
                            return "ANY";
                        }
                        return String(type).toUpperCase();
                    },
                },
            });
            const types = this.registerModernNodes(nodeClasses);
            this.__installedModernNodeModuleIds.add(moduleDefinition.id);
            moduleDefinition.__registeredTypes = types.slice();
            return types;
        };
        LiteGraph.installModernNodeModules = function(moduleDefinitions) {
            return moduleDefinitions.flatMap((moduleDefinition) =>
                this.installModernNodeModule(moduleDefinition)
            );
        };

        global.LiteGraph = LiteGraph;
        global.LGraph = runtime.LGraph;

        require("../src/nodes_leafer/base/shared/module.js");
        require("../src/nodes_leafer/events/core.js");
        require("../src/nodes_leafer/logic/core.js");
        require("../src/nodes_leafer/events.js");
        require("../src/nodes_leafer/logic.js");

        return runtime;
    }

    afterEach(() => {
        delete global.LiteGraph;
        delete global.LGraph;
        delete global.__litegraphNodesLeaferModuleSupport;
        delete global.__litegraphNodesLeaferModules;
        delete global.__LITEGRAPH_PENDING_MODERN_NODE_MODULES__;
    });

    test("registers events and logic node sets once", () => {
        const runtime = loadModernEventAndLogicNodes();
        const LiteGraph = runtime.LiteGraph;

        expect(LiteGraph.nodes_leafer.eventsNodeTypes).toHaveLength(13);
        expect(LiteGraph.nodes_leafer.logicNodeTypes).toHaveLength(7);

        for (const type of eventTypes) {
            expect(LiteGraph.registered_node_types[type]).toBeTruthy();
        }
        for (const type of logicTypes) {
            expect(LiteGraph.registered_node_types[type]).toBeTruthy();
        }

        LiteGraph.nodes_leafer.registerEventsNodes();
        LiteGraph.nodes_leafer.registerLogicNodes();

        expect(Object.keys(LiteGraph.nodes_leafer.registeredEventsNodeTypes)).toHaveLength(
            13
        );
        expect(Object.keys(LiteGraph.nodes_leafer.registeredLogicNodeTypes)).toHaveLength(
            7
        );
    });

    test("event and logic modern modules no longer depend on addWidget", () => {
        const directories = [
            path.join(__dirname, "../src/nodes_leafer/events"),
            path.join(__dirname, "../src/nodes_leafer/logic"),
        ];

        for (const directoryPath of directories) {
            const files = fs
                .readdirSync(directoryPath)
                .filter((entry) => entry.endsWith(".js"))
                .map((entry) => path.join(directoryPath, entry));
            for (const filePath of files) {
                const source = fs.readFileSync(filePath, "utf8");
                expect(source.includes("addWidget(")).toBe(false);
            }
        }
    });

    test("trigger event keeps edge and level semantics", () => {
        const runtime = loadModernEventAndLogicNodes();
        const LiteGraph = runtime.LiteGraph;
        const node = LiteGraph.createNode("events/trigger");
        node.triggerSlot = jest.fn();

        node.properties.only_on_change = false;
        node.getInputData = jest.fn(() => true);
        node.onExecute("payload", { id: "first" });

        expect(node.triggerSlot).toHaveBeenCalledWith(
            0,
            "payload",
            null,
            { id: "first" }
        );
    });

    test("waitAll only fires after every input slot becomes ready", () => {
        const runtime = loadModernEventAndLogicNodes();
        const LiteGraph = runtime.LiteGraph;
        const node = LiteGraph.createNode("events/waitAll");
        node.triggerSlot = jest.fn();

        node.onAction("event", null, undefined, 0);
        expect(node.triggerSlot).not.toHaveBeenCalled();

        node.onAction("event", "done", undefined, 1);
        expect(node.triggerSlot).toHaveBeenCalledWith(0, "done", null, undefined);
        expect(node.ready).toEqual([]);
    });

    test("data store captures last input value on assign action", () => {
        const runtime = loadModernEventAndLogicNodes();
        const LiteGraph = runtime.LiteGraph;
        const node = LiteGraph.createNode("basic/data_store");
        node.getInputData = jest.fn(() => 42);

        node.onExecute();
        node.onAction("assign");
        node.onExecute();

        expect(node.properties.data).toBe(42);
        expect(node.outputs[0]._data).toBe(42);
    });

    test("logic sequence and IF preserve output semantics", () => {
        const runtime = loadModernEventAndLogicNodes();
        const LiteGraph = runtime.LiteGraph;

        const sequence = LiteGraph.createNode("logic/sequence");
        sequence.getInputData = jest.fn((slot) => (slot === 0 ? 2 : undefined));
        sequence.onExecute();
        expect(sequence.outputs[0]._data).toBe("C");

        const branch = LiteGraph.createNode("logic/IF");
        branch.getInputData = jest.fn((slot) => (slot === 1 ? true : undefined));
        branch.triggerSlot = jest.fn();
        branch.onExecute();
        expect(branch.triggerSlot).toHaveBeenCalledWith(0);
    });
});
