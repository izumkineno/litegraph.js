import type {
    ModernNodeAuthoringApi,
    ModernNodeModuleDefinition,
} from "../../ts-migration/leafer";

type GraphNodeLike = any;
type GraphLike = any;

interface LiteGraphLike extends Record<string, unknown> {
    LGraph: new () => GraphLike;
    createNode: (type: string) => GraphNodeLike | null;
    uuidv4: () => string;
    cloneObject: <T>(value: T) => T;
    isValidConnection: (left: unknown, right: unknown) => boolean;
    EVENT: number;
    ACTION: number;
    NODE_SLOT_HEIGHT: number;
    NODE_TITLE_HEIGHT: number;
    use_uuids?: boolean;
    Subgraph?: unknown;
    GraphInput?: unknown;
    GraphOutput?: unknown;
    nodes_leafer?: {
        baseModules?: ModernNodeModuleDefinition[];
        baseModuleMap?: Record<string, ModernNodeModuleDefinition>;
    };
    installModernNodeModule?: (
        moduleDefinition: ModernNodeModuleDefinition
    ) => string[];
}

function getGraphInputValueWidget(node: GraphNodeLike): {
    type: "number" | "toggle" | "text";
    value: unknown;
    options?: {
        step?: number;
    };
} {
    const type = node?.properties ? node.properties.type : "";
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
        value: node?.properties?.value != null ? String(node.properties.value) : "",
    };
}

function getGraphInputDefaultValue(type: unknown): unknown {
    if (type === "number") {
        return 0;
    }
    if (type === "boolean") {
        return true;
    }
    return "";
}

export const graphBaseModuleDefinition: ModernNodeModuleDefinition = {
    id: "base/graph",
    define(api: ModernNodeAuthoringApi) {
        const liteGraph = api.liteGraph as unknown as LiteGraphLike;
        const BaseNode = api.DefaultModernNodeBase as new (
            title?: string
        ) => GraphNodeLike;
        const ModernNodeChangeMask = api.ModernNodeChangeMask;
        const describePortType = api.utils.describePortType;
        const baseNodePrototype = BaseNode.prototype as {
            getShellState?: (context?: unknown) => Record<string, unknown>;
            getPortPresentation?: (
                kind: string,
                slotIndex: number,
                context?: unknown
            ) => Record<string, unknown> | null;
            serialize?: () => Record<string, unknown>;
        };
        class Subgraph extends BaseNode {
            static type = "graph/subgraph";
            static title = "Subgraph";
            static desc = "Graph inside a node";
            static title_color = "#334";

            enabled: boolean;
            subgraph: GraphLike;

            constructor(title?: string) {
                super(title);
                this.size = [140, 80];
                this.properties = { enabled: true };
                this.enabled = true;
                this.subgraph = new liteGraph.LGraph();
                this.subgraph._subgraph_node = this;
                this.subgraph._is_subgraph = true;
                this.subgraph.onTrigger = this.onSubgraphTrigger.bind(this);
                this.subgraph.onInputAdded = this.onSubgraphNewInput.bind(this);
                this.subgraph.onInputRenamed = this.onSubgraphRenamedInput.bind(this);
                this.subgraph.onInputTypeChanged =
                    this.onSubgraphTypeChangeInput.bind(this);
                this.subgraph.onInputRemoved = this.onSubgraphRemovedInput.bind(this);
                this.subgraph.onOutputAdded = this.onSubgraphNewOutput.bind(this);
                this.subgraph.onOutputRenamed =
                    this.onSubgraphRenamedOutput.bind(this);
                this.subgraph.onOutputTypeChanged =
                    this.onSubgraphTypeChangeOutput.bind(this);
                this.subgraph.onOutputRemoved = this.onSubgraphRemovedOutput.bind(this);
            }

            onGetInputs(): [string, string][] {
                return [["enabled", "boolean"]];
            }

            onDblClick(
                _event: unknown,
                _pos: unknown,
                graphcanvas: { openSubgraph: (graph: GraphLike) => void }
            ): void {
                const { subgraph } = this;
                setTimeout(() => {
                    graphcanvas.openSubgraph(subgraph);
                }, 10);
            }

            requestSubgraphPortPatch(): void {
                this.requestModernPatch(
                    ModernNodeChangeMask.Layout |
                        ModernNodeChangeMask.Ports |
                        ModernNodeChangeMask.Data
                );
            }

            defineActionParts(): Array<Record<string, unknown>> {
                if (this.flags?.collapsed) {
                    return [];
                }
                const width = Math.max(0, Math.round(this.size?.[0] || 0));
                const bodyHeight = Math.max(0, Math.round(this.size?.[1] || 0));
                const sideInset = 12;
                const buttonHeight = 20;
                const bottomInset = 18;
                const gap = 12;
                const usableWidth = Math.max(96, width - sideInset * 2);
                const buttonWidth = Math.max(
                    44,
                    Math.min(56, Math.floor((usableWidth - gap) / 2))
                );
                const pairWidth = buttonWidth * 2 + gap;
                const footerY = Math.max(
                    0,
                    Math.round(bodyHeight - bottomInset - buttonHeight)
                );
                const leftX = Math.max(sideInset, Math.round((width - pairWidth) / 2));
                const rightX = leftX + buttonWidth + gap;

                return [
                    {
                        id: "subgraph-left",
                        action: "subgraph-left",
                        label: "+",
                        placement: "footer-left",
                        bounds: {
                            x: leftX,
                            y: footerY,
                            width: buttonWidth,
                            height: buttonHeight,
                        },
                        onTrigger(context: {
                            graphcanvas?: {
                                showSubgraphPropertiesDialog?: (
                                    node: GraphNodeLike
                                ) => void;
                            };
                            node: GraphNodeLike;
                        }): void {
                            context.graphcanvas?.showSubgraphPropertiesDialog?.(
                                context.node
                            );
                        },
                    },
                    {
                        id: "subgraph-right",
                        action: "subgraph-right",
                        label: "+",
                        placement: "footer-right",
                        bounds: {
                            x: rightX,
                            y: footerY,
                            width: buttonWidth,
                            height: buttonHeight,
                        },
                        onTrigger(context: {
                            graphcanvas?: {
                                showSubgraphPropertiesDialogRight?: (
                                    node: GraphNodeLike
                                ) => void;
                            };
                            node: GraphNodeLike;
                        }): void {
                            context.graphcanvas?.showSubgraphPropertiesDialogRight?.(
                                context.node
                            );
                        },
                    },
                ];
            }

            getShellState(context?: unknown): Record<string, unknown> {
                const shellState = {
                    ...(baseNodePrototype.getShellState?.call(this, context) || {}),
                };
                delete shellState.headerMetaText;
                delete shellState.summaryText;
                delete shellState.minimumWidth;
                delete shellState.minimumHeight;

                if (!this.enabled) {
                    shellState.bodyColor = "#171A1F";
                    shellState.borderColor = "#404754";
                    shellState.boxColor = "#8A93A4";
                }

                return shellState;
            }

            onAction(action: string, param: unknown): void {
                this.subgraph.onAction(action, param);
            }

            onExecute(): void {
                const wasEnabled = this.enabled;
                this.enabled = this.getInputOrProperty("enabled");
                if (wasEnabled !== this.enabled) {
                    this.requestModernPatch(
                        ModernNodeChangeMask.Data |
                            ModernNodeChangeMask.Style
                    );
                }
                if (!this.enabled) {
                    return;
                }

                if (this.inputs) {
                    for (let index = 0; index < this.inputs.length; ++index) {
                        const input = this.inputs[index];
                        this.subgraph.setInputData(
                            input.name,
                            this.getInputData(index)
                        );
                    }
                }

                this.subgraph.runStep();

                if (this.outputs) {
                    for (let index = 0; index < this.outputs.length; ++index) {
                        const output = this.outputs[index];
                        this.setOutputData(
                            index,
                            this.subgraph.getOutputData(output.name)
                        );
                    }
                }
            }

            sendEventToAllNodes(
                eventname: string,
                param: unknown,
                mode: unknown
            ): void {
                if (this.enabled) {
                    this.subgraph.sendEventToAllNodes(eventname, param, mode);
                }
            }

            computeSize(): [number, number] {
                const inputCount = this.inputs ? this.inputs.length : 0;
                const outputCount = this.outputs ? this.outputs.length : 0;
                return [
                    200,
                    Math.max(inputCount, outputCount) * liteGraph.NODE_SLOT_HEIGHT +
                        liteGraph.NODE_TITLE_HEIGHT,
                ];
            }

            onSubgraphTrigger(event: string, _param: unknown): void {
                const slot = this.findOutputSlot(event);
                if (slot !== -1) {
                    this.triggerSlot(slot);
                }
            }

            onSubgraphNewInput(name: string, type: unknown): void {
                const slot = this.findInputSlot(name);
                if (slot === -1) {
                    this.addInput(name, type);
                    this.requestSubgraphPortPatch();
                }
            }

            onSubgraphRenamedInput(oldname: string, name: string): void {
                const slot = this.findInputSlot(oldname);
                if (slot === -1) {
                    return;
                }
                this.getInputInfo(slot).name = name;
                this.requestSubgraphPortPatch();
            }

            onSubgraphTypeChangeInput(name: string, type: unknown): void {
                const slot = this.findInputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.getInputInfo(slot).type = type;
                this.requestSubgraphPortPatch();
            }

            onSubgraphRemovedInput(name: string): void {
                const slot = this.findInputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.removeInput(slot);
                this.requestSubgraphPortPatch();
            }

            onSubgraphNewOutput(name: string, type: unknown): void {
                const slot = this.findOutputSlot(name);
                if (slot === -1) {
                    this.addOutput(name, type);
                    this.requestSubgraphPortPatch();
                }
            }

            onSubgraphRenamedOutput(oldname: string, name: string): void {
                const slot = this.findOutputSlot(oldname);
                if (slot === -1) {
                    return;
                }
                this.getOutputInfo(slot).name = name;
                this.requestSubgraphPortPatch();
            }

            onSubgraphTypeChangeOutput(name: string, type: unknown): void {
                const slot = this.findOutputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.getOutputInfo(slot).type = type;
                this.requestSubgraphPortPatch();
            }

            onSubgraphRemovedOutput(name: string): void {
                const slot = this.findOutputSlot(name);
                if (slot === -1) {
                    return;
                }
                this.removeOutput(slot);
                this.requestSubgraphPortPatch();
            }

            getExtraMenuOptions(graphcanvas: {
                openSubgraph: (graph: GraphLike) => void;
            }): Array<{ content: string; callback: () => void }> {
                return [
                    {
                        content: "Open",
                        callback: () => {
                            graphcanvas.openSubgraph(this.subgraph);
                        },
                    },
                ];
            }

            onResize(size: [number, number]): void {
                size[1] += 20;
            }

            serialize(): Record<string, unknown> {
                const data = {
                    ...(baseNodePrototype.serialize?.call(this) || {}),
                };
                data.subgraph = this.subgraph.serialize();
                return data;
            }

            reassignSubgraphUUIDs(graph: {
                nodes: GraphNodeLike[];
                links: Array<[string, string, unknown, string, unknown, unknown?]>;
            }): void {
                const idMap: {
                    nodeIDs: Record<string, string>;
                    linkIDs: Record<string, string>;
                } = { nodeIDs: {}, linkIDs: {} };

                for (let index = 0; index < graph.nodes.length; ++index) {
                    const node = graph.nodes[index];
                    const oldId = node.id;
                    const newId = liteGraph.uuidv4();
                    node.id = newId;
                    idMap.nodeIDs[oldId] = newId;
                    idMap.nodeIDs[newId] = oldId;
                }

                for (let index = 0; index < graph.links.length; ++index) {
                    const link = graph.links[index];
                    const oldLinkId = link[0];
                    const newLinkId = liteGraph.uuidv4();
                    link[0] = newLinkId;
                    idMap.linkIDs[oldLinkId] = newLinkId;
                    idMap.linkIDs[newLinkId] = oldLinkId;
                    link[1] = idMap.nodeIDs[link[1]];
                    link[3] = idMap.nodeIDs[link[3]];
                }

                for (let index = 0; index < graph.nodes.length; ++index) {
                    const innerNode = graph.nodes[index];
                    if (innerNode.inputs) {
                        for (let inputIndex = 0; inputIndex < innerNode.inputs.length; ++inputIndex) {
                            if (innerNode.inputs[inputIndex].link) {
                                innerNode.inputs[inputIndex].link =
                                    idMap.linkIDs[innerNode.inputs[inputIndex].link];
                            }
                        }
                    }
                    if (innerNode.outputs) {
                        for (
                            let outputIndex = 0;
                            outputIndex < innerNode.outputs.length;
                            ++outputIndex
                        ) {
                            if (innerNode.outputs[outputIndex].links) {
                                innerNode.outputs[outputIndex].links =
                                    innerNode.outputs[outputIndex].links.map(
                                        (linkId: string) => idMap.linkIDs[linkId]
                                    );
                            }
                        }
                    }
                }
            }

            clone(): GraphNodeLike {
                const node = liteGraph.createNode(this.type);
                const data = this.serialize();
                if (liteGraph.use_uuids) {
                    const subgraph = liteGraph.cloneObject(
                        data.subgraph as {
                            nodes: GraphNodeLike[];
                            links: Array<
                                [string, string, unknown, string, unknown, unknown?]
                            >;
                        }
                    );
                    this.reassignSubgraphUUIDs(subgraph);
                    data.subgraph = subgraph;
                }
                delete data.id;
                delete data.inputs;
                delete data.outputs;
                node?.configure(data);
                return node;
            }
        }

        class GraphInput extends BaseNode {
            static type = "graph/input";
            static title = "Input";
            static desc = "Input of the graph";

            name_in_graph: string;

            constructor(title?: string) {
                super(title);
                this.addOutput("", "number");
                this.name_in_graph = "";
                this.properties = { name: "", type: "number", value: 0 };
                this.widgets_up = true;
                this.size = [180, 90];
            }

            defineWidgets(): Array<Record<string, unknown>> {
                const valueWidget = getGraphInputValueWidget(this);
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

            onConfigure(): void {
                this.updateType();
            }

            updateType(): void {
                const type = this.properties.type;
                if (this.outputs[0].type !== type) {
                    if (!liteGraph.isValidConnection(this.outputs[0].type, type)) {
                        this.disconnectOutput(0);
                    }
                    this.outputs[0].type = type;
                }

                this.properties.value = getGraphInputDefaultValue(type);
                if (this.graph && this.name_in_graph) {
                    this.graph.changeInputType(this.name_in_graph, type);
                }
                this.requestModernPatch(
                    ModernNodeChangeMask.Layout |
                        ModernNodeChangeMask.Data |
                        ModernNodeChangeMask.Ports
                );
            }

            onPropertyChanged(name: string, value: unknown): boolean | void {
                if (name === "name") {
                    if (
                        value === "" ||
                        value === this.name_in_graph ||
                        value === "enabled"
                    ) {
                        return false;
                    }
                    if (this.graph) {
                        if (this.name_in_graph) {
                            this.graph.renameInput(this.name_in_graph, value);
                        } else {
                            this.graph.addInput(value, this.properties.type);
                        }
                    }
                    this.name_in_graph = String(value);
                    this.requestModernPatch(
                        ModernNodeChangeMask.Layout |
                            ModernNodeChangeMask.Data
                    );
                } else if (name === "type") {
                    this.updateType();
                }
            }

            getTitle(): string {
                if (this.flags?.collapsed) {
                    return this.properties.name;
                }
                return this.title;
            }

            getShellState(context?: unknown): Record<string, unknown> {
                const shellState = {
                    ...(baseNodePrototype.getShellState?.call(this, context) || {}),
                };
                shellState.title = this.properties.name || this.title;
                shellState.headerMetaText = describePortType(this.properties.type);
                shellState.minimumWidth = 220;
                return shellState;
            }

            getPortPresentation(
                kind: string,
                slotIndex: number,
                context?: unknown
            ): Record<string, unknown> | null {
                const portPresentation = baseNodePrototype.getPortPresentation?.call(
                    this,
                    kind,
                    slotIndex,
                    context
                );
                if (kind === "output" && slotIndex === 0 && portPresentation) {
                    portPresentation.label = this.properties.name || "";
                }
                return portPresentation || null;
            }

            onAction(_action: string, param: unknown): void {
                if (this.properties.type === liteGraph.EVENT) {
                    this.triggerSlot(0, param);
                }
            }

            onExecute(): void {
                const name = this.properties.name;
                const data = this.graph.inputs[name];
                if (!data) {
                    this.setOutputData(0, this.properties.value);
                    return;
                }
                this.setOutputData(
                    0,
                    data.value !== undefined ? data.value : this.properties.value
                );
            }

            onRemoved(): void {
                if (this.name_in_graph) {
                    this.graph.removeInput(this.name_in_graph);
                }
            }
        }

        class GraphOutput extends BaseNode {
            static type = "graph/output";
            static title = "Output";
            static desc = "Output of the graph";

            name_in_graph: string;
            _value: unknown;

            constructor(title?: string) {
                super(title);
                this.addInput("", "");
                this.name_in_graph = "";
                this.properties = { name: "", type: "" };
                this.widgets_up = true;
                this.size = [180, 60];
            }

            defineWidgets(): Array<Record<string, unknown>> {
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

            onPropertyChanged(name: string, value: unknown): boolean | void {
                if (name === "name") {
                    if (
                        value === "" ||
                        value === this.name_in_graph ||
                        value === "enabled"
                    ) {
                        return false;
                    }
                    if (this.graph) {
                        if (this.name_in_graph) {
                            this.graph.renameOutput(this.name_in_graph, value);
                        } else {
                            this.graph.addOutput(value, this.properties.type);
                        }
                    }
                    this.name_in_graph = String(value);
                    this.requestModernPatch(
                        ModernNodeChangeMask.Layout |
                            ModernNodeChangeMask.Data
                    );
                } else if (name === "type") {
                    this.updateType();
                }
            }

            onConfigure(): void {
                this.updateType();
            }

            updateType(): void {
                let type = this.properties.type;
                if (this.inputs[0].type !== type) {
                    if (type === "action" || type === "event") {
                        type = liteGraph.EVENT;
                    }
                    if (!liteGraph.isValidConnection(this.inputs[0].type, type)) {
                        this.disconnectInput(0);
                    }
                    this.inputs[0].type = type;
                }
                if (this.graph && this.name_in_graph) {
                    this.graph.changeOutputType(this.name_in_graph, type);
                }
                this.requestModernPatch(
                    ModernNodeChangeMask.Data |
                        ModernNodeChangeMask.Ports
                );
            }

            onExecute(): void {
                this._value = this.getInputData(0);
                this.graph.setOutputData(this.properties.name, this._value);
            }

            onAction(_action: string, param: unknown): void {
                if (this.properties.type === liteGraph.ACTION) {
                    this.graph.trigger(this.properties.name, param);
                }
            }

            onRemoved(): void {
                if (this.name_in_graph) {
                    this.graph.removeOutput(this.name_in_graph);
                }
            }

            getTitle(): string {
                if (this.flags?.collapsed) {
                    return this.properties.name;
                }
                return this.title;
            }

            getShellState(context?: unknown): Record<string, unknown> {
                const shellState = {
                    ...(baseNodePrototype.getShellState?.call(this, context) || {}),
                };
                shellState.title = this.properties.name || this.title;
                shellState.headerMetaText = describePortType(this.properties.type);
                shellState.minimumWidth = 214;
                return shellState;
            }

            getPortPresentation(
                kind: string,
                slotIndex: number,
                context?: unknown
            ): Record<string, unknown> | null {
                const portPresentation = baseNodePrototype.getPortPresentation?.call(
                    this,
                    kind,
                    slotIndex,
                    context
                );
                if (kind === "input" && slotIndex === 0 && portPresentation) {
                    portPresentation.label = this.properties.name || "";
                }
                return portPresentation || null;
            }
        }

        liteGraph.Subgraph = Subgraph;
        liteGraph.GraphInput = GraphInput;
        liteGraph.GraphOutput = GraphOutput;

        return [Subgraph, GraphInput, GraphOutput];
    },
};

export function registerLeaferGraphBaseModule(target: unknown = globalThis): boolean {
    const globalLike = target as { LiteGraph?: LiteGraphLike } | null | undefined;
    const liteGraph = globalLike?.LiteGraph;
    if (!liteGraph || typeof liteGraph.installModernNodeModule !== "function") {
        return false;
    }

    const ns = liteGraph.nodes_leafer || (liteGraph.nodes_leafer = {});
    ns.baseModules = ns.baseModules || [];
    ns.baseModuleMap = ns.baseModuleMap || {};
    if (!ns.baseModuleMap[graphBaseModuleDefinition.id]) {
        ns.baseModuleMap[graphBaseModuleDefinition.id] = graphBaseModuleDefinition;
        ns.baseModules.push(graphBaseModuleDefinition);
    }

    const registeredTypes = liteGraph.installModernNodeModule(
        graphBaseModuleDefinition
    );
    (
        graphBaseModuleDefinition as ModernNodeModuleDefinition & {
            __registeredTypes?: string[];
        }
    ).__registeredTypes = registeredTypes.slice();

    return true;
}

void registerLeaferGraphBaseModule(globalThis);
