import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import type { LGraphGroup } from "./LGraphGroup";
import type { LGraphNodeCanvasCollab as LGraphNode } from "./LGraphNode.canvas-collab";
import { type LiteGraphLifecycleHost } from "./LGraph.lifecycle";
import { LGraphExecution } from "./LGraph.execution";
import { invokeGraphOnNodeAddedCompatHook } from "./LGraph.hooks";

interface LiteGraphStructureHost
    extends LiteGraphLifecycleHost,
        Pick<LiteGraphConstantsShape, "use_uuids" | "MAX_NUMBER_OF_NODES" | "registered_node_types"> {
    uuidv4: () => string;
    LGraphGroup?: new (...args: any[]) => LGraphGroup;
    createNode?: (
        type: string,
        title?: string
    ) => LGraphNode | null;
}

const defaultStructureHost: LiteGraphStructureHost = {
    debug: false,
    getTime: () => Date.now(),
    use_uuids: false,
    uuidv4: () => "",
    MAX_NUMBER_OF_NODES: 1000,
    registered_node_types: {},
};

interface GraphInputSlotStructureLike {
    link: number | null;
}

interface GraphOutputSlotStructureLike {
    links: number[] | null;
}

type GraphNodeId = number | string;

type GraphNodeStructureBase = Pick<
    LGraphNode,
    | "id"
    | "type"
    | "title"
    | "alignToGrid"
    | "disconnectInput"
    | "disconnectOutput"
    | "serialize"
    | "configure"
    | "isPointInside"
>;

interface GraphNodeStructureLike extends GraphNodeStructureBase {
    constructor: Function;
    graph: LGraphStructure | null;
    inputs?: Array<GraphInputSlotStructureLike | null>;
    outputs?: Array<GraphOutputSlotStructureLike | null>;
    ignore_remove?: boolean;
    onAdded?: (graph: LGraphStructure) => void;
    onRemoved?: () => void;
}

type GraphGroupStructureBase = Pick<LGraphGroup, "isPointInside">;

interface GraphGroupStructureLike extends GraphGroupStructureBase {
    constructor: Function;
    graph: LGraphStructure | null;
}

interface GraphCanvasStructureLike {
    selected_nodes?: Record<string, GraphNodeStructureLike>;
    node_dragged?: GraphNodeStructureLike | null;
}

/**
 * LGraph structure-management methods.
 * Source: `add/remove/getNodeById/find*()/getNodeOnPos/getGroupOnPos`.
 */
export class LGraphStructure extends LGraphExecution {
    onNodeAdded?: (node: GraphNodeStructureLike) => void;
    onNodeRemoved?: (node: GraphNodeStructureLike) => void;

    private getStructureHost(): LiteGraphStructureHost {
        const ctor = this.constructor as {
            liteGraph?: Partial<LiteGraphStructureHost>;
        };
        const host =
            (ctor.liteGraph ||
                (LGraphStructure as unknown as {
                    liteGraph?: Partial<LiteGraphStructureHost>;
                }).liteGraph ||
                (LGraphExecution as unknown as {
                    liteGraph?: Partial<LiteGraphStructureHost>;
                }).liteGraph ||
                {}) as Partial<LiteGraphStructureHost>;
        return { ...defaultStructureHost, ...host };
    }

    private getNodesByIdMap(): Record<string, GraphNodeStructureLike> {
        return this._nodes_by_id as unknown as Record<string, GraphNodeStructureLike>;
    }

    private getNodeArray(): GraphNodeStructureLike[] {
        return this._nodes as unknown as GraphNodeStructureLike[];
    }

    private getGroupArray(): GraphGroupStructureLike[] {
        return this._groups as unknown as GraphGroupStructureLike[];
    }

    private isGroupNode(
        node: unknown,
        host: LiteGraphStructureHost
    ): node is GraphGroupStructureLike {
        if (!node || typeof node !== "object") {
            return false;
        }
        const groupNode = node as GraphGroupStructureLike;
        if (host.LGraphGroup && groupNode.constructor === host.LGraphGroup) {
            return true;
        }
        return (
            typeof groupNode.constructor === "function" &&
            groupNode.constructor.name === "LGraphGroup"
        );
    }

    /**
     * Adds a new node instance to this graph
     * @method add
     * @param {LGraphNode} node the instance of the node
     */
    add(
        node: GraphNodeStructureLike | GraphGroupStructureLike | null,
        skip_compute_order?: boolean
    ): GraphNodeStructureLike | GraphGroupStructureLike | undefined {
        if (!node) {
            return undefined;
        }

        const host = this.getStructureHost();

        // groups
        if (this.isGroupNode(node, host)) {
            this.getGroupArray().push(node);
            this.setDirtyCanvas(true);
            this.change();
            node.graph = this;
            this._version++;
            return node;
        }

        const graphNode = node as GraphNodeStructureLike;
        const nodesById = this.getNodesByIdMap();

        // nodes
        if (graphNode.id != -1 && nodesById[String(graphNode.id)] != null) {
            console.warn(
                "LiteGraph: there is already a node with this ID, changing it"
            );
            if (host.use_uuids) {
                graphNode.id = host.uuidv4();
            } else {
                graphNode.id = ++this.last_node_id;
            }
        }

        if (this.getNodeArray().length >= host.MAX_NUMBER_OF_NODES) {
            throw "LiteGraph: max number of nodes in a graph reached";
        }

        // give him an id
        if (host.use_uuids) {
            if (graphNode.id == null || graphNode.id == -1) {
                graphNode.id = host.uuidv4();
            }
        } else {
            if (
                graphNode.id == null ||
                graphNode.id == -1
            ) {
                graphNode.id = ++this.last_node_id;
            } else if (this.last_node_id < (graphNode.id as number)) {
                this.last_node_id = graphNode.id as number;
            }
        }

        graphNode.graph = this;
        this._version++;

        this.getNodeArray().push(graphNode);
        nodesById[String(graphNode.id)] = graphNode;

        if (graphNode.onAdded) {
            graphNode.onAdded(this);
        }

        if ((this.config as Record<string, unknown>).align_to_grid) {
            graphNode.alignToGrid();
        }

        if (!skip_compute_order) {
            this.updateExecutionOrder();
        }

        invokeGraphOnNodeAddedCompatHook(
            this as unknown as Record<string, unknown> & {
                onNodeAdded?: (node: GraphNodeStructureLike) => void;
            },
            graphNode
        );

        this.setDirtyCanvas(true);
        this.change();

        return graphNode; // to chain actions
    }

    /**
     * Removes a node from the graph
     * @method remove
     * @param {LGraphNode} node the instance of the node
     */
    remove(node: GraphNodeStructureLike | GraphGroupStructureLike): void {
        const host = this.getStructureHost();

        if (this.isGroupNode(node, host)) {
            const groups = this.getGroupArray();
            const index = groups.indexOf(node);
            if (index != -1) {
                groups.splice(index, 1);
            }
            node.graph = null;
            this._version++;
            this.setDirtyCanvas(true, true);
            this.change();
            return;
        }

        const graphNode = node as GraphNodeStructureLike;
        const nodesById = this.getNodesByIdMap();
        if (nodesById[String(graphNode.id)] == null) {
            return;
        } // not found

        if (graphNode.ignore_remove) {
            return;
        } // cannot be removed

        this.beforeChange(); // sure? - almost sure is wrong

        // disconnect inputs
        if (graphNode.inputs) {
            for (let i = 0; i < graphNode.inputs.length; i++) {
                const slot = graphNode.inputs[i];
                if (slot && slot.link != null) {
                    graphNode.disconnectInput(i);
                }
            }
        }

        // disconnect outputs
        if (graphNode.outputs) {
            for (let i = 0; i < graphNode.outputs.length; i++) {
                const slot = graphNode.outputs[i];
                if (
                    slot &&
                    slot.links != null &&
                    slot.links.length
                ) {
                    graphNode.disconnectOutput(i);
                }
            }
        }

        // callback
        if (graphNode.onRemoved) {
            graphNode.onRemoved();
        }

        graphNode.graph = null;
        this._version++;

        // remove from canvas render
        const canvasList = this.list_of_graphcanvas as
            | GraphCanvasStructureLike[]
            | null;
        if (canvasList) {
            for (let i = 0; i < canvasList.length; ++i) {
                const canvas = canvasList[i];
                const selectedNodes = canvas.selected_nodes as
                    | Record<string, GraphNodeStructureLike>
                    | undefined;
                if (selectedNodes && selectedNodes[String(graphNode.id)]) {
                    delete selectedNodes[String(graphNode.id)];
                }
                if (canvas.node_dragged == graphNode) {
                    canvas.node_dragged = null;
                }
            }
        }

        // remove from containers
        const nodes = this.getNodeArray();
        const pos = nodes.indexOf(graphNode);
        if (pos != -1) {
            nodes.splice(pos, 1);
        }
        delete nodesById[String(graphNode.id)];

        if (this.onNodeRemoved) {
            this.onNodeRemoved(graphNode);
        }

        // close panels
        this.sendActionToCanvas("checkPanels");

        this.setDirtyCanvas(true, true);
        this.afterChange(); // sure? - almost sure is wrong
        this.change();

        this.updateExecutionOrder();
    }

    /**
     * Returns a node by its id.
     * @method getNodeById
     * @param {Number} id
     */
    getNodeById<T extends GraphNodeStructureLike = GraphNodeStructureLike>(
        id: GraphNodeId | null | undefined
    ): T | null | undefined {
        if (id == null) {
            return null;
        }
        return this.getNodesByIdMap()[String(id)] as T | undefined;
    }

    /**
     * Returns a list of nodes that matches a class
     * @method findNodesByClass
     * @param {Class} classObject the class itself (not an string)
     * @return {Array} a list with all the nodes of this type
     */
    findNodesByClass<T extends GraphNodeStructureLike = GraphNodeStructureLike>(
        classObject: Function,
        result?: T[]
    ): T[] {
        const output = result || [];
        output.length = 0;
        const nodes = this.getNodeArray();
        for (let i = 0, l = nodes.length; i < l; ++i) {
            if (nodes[i].constructor === classObject) {
                output.push(nodes[i] as T);
            }
        }
        return output;
    }

    /**
     * Returns a list of nodes that matches a type
     * @method findNodesByType
     * @param {String} type the name of the node type
     * @return {Array} a list with all the nodes of this type
     */
    findNodesByType<T extends GraphNodeStructureLike = GraphNodeStructureLike>(
        type: string,
        result?: T[]
    ): T[] {
        const loweredType = type.toLowerCase();
        const output = result || [];
        output.length = 0;
        const nodes = this.getNodeArray();
        for (let i = 0, l = nodes.length; i < l; ++i) {
            if (nodes[i].type.toLowerCase() == loweredType) {
                output.push(nodes[i] as T);
            }
        }
        return output;
    }

    /**
     * Returns the first node that matches a name in its title
     * @method findNodeByTitle
     * @param {String} name the name of the node to search
     * @return {Node} the node or null
     */
    findNodeByTitle<T extends GraphNodeStructureLike = GraphNodeStructureLike>(
        title: string
    ): T | null {
        const nodes = this.getNodeArray();
        for (let i = 0, l = nodes.length; i < l; ++i) {
            if (nodes[i].title == title) {
                return nodes[i] as T;
            }
        }
        return null;
    }

    /**
     * Returns a list of nodes that matches a name
     * @method findNodesByTitle
     * @param {String} name the name of the node to search
     * @return {Array} a list with all the nodes with this name
     */
    findNodesByTitle<T extends GraphNodeStructureLike = GraphNodeStructureLike>(
        title: string
    ): T[] {
        const result: T[] = [];
        const nodes = this.getNodeArray();
        for (let i = 0, l = nodes.length; i < l; ++i) {
            if (nodes[i].title == title) {
                result.push(nodes[i] as T);
            }
        }
        return result;
    }

    /**
     * Returns the top-most node in this position of the canvas
     * @method getNodeOnPos
     * @param {number} x the x coordinate in canvas space
     * @param {number} y the y coordinate in canvas space
     * @param {Array} nodes_list a list with all the nodes to search from, by default is all the nodes in the graph
     * @return {LGraphNode} the node at this position or null
     */
    getNodeOnPos<T extends GraphNodeStructureLike = GraphNodeStructureLike>(
        x: number,
        y: number,
        nodes_list?: Array<GraphNodeStructureLike | GraphGroupStructureLike>,
        margin?: number
    ): T | GraphGroupStructureLike | null {
        const host = this.getStructureHost();
        const list =
            nodes_list ||
            (this._nodes as unknown as Array<
                GraphNodeStructureLike | GraphGroupStructureLike
            >);
        let nRet: GraphGroupStructureLike | null = null;
        for (let i = list.length - 1; i >= 0; i--) {
            const n = list[i];
            if (n.isPointInside(x, y, margin)) {
                if (this.isGroupNode(n, host)) {
                    if (!nRet) {
                        nRet = n;
                    }
                    continue;
                }
                return n as T;
            }
        }
        return nRet;
    }

    /**
     * Returns the top-most group in that position
     * @method getGroupOnPos
     * @param {number} x the x coordinate in canvas space
     * @param {number} y the y coordinate in canvas space
     * @return {LGraphGroup} the group or null
     */
    getGroupOnPos(x: number, y: number): GraphGroupStructureLike | null {
        const groups = this.getGroupArray();
        for (let i = groups.length - 1; i >= 0; i--) {
            const g = groups[i];
            if (g.isPointInside(x, y, 2, true)) {
                return g;
            }
        }
        return null;
    }

    /**
     * Checks that the node type matches the node type registered, used when replacing a nodetype by a newer version during execution
     * this replaces the ones using the old version with the new version
     * @method checkNodeTypes
     */
    checkNodeTypes(): void {
        const host = this.getStructureHost();
        const nodes = this.getNodeArray();
        const nodesById = this.getNodesByIdMap();
        let changes = false;

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const ctor = host.registered_node_types
                ? host.registered_node_types[node.type]
                : undefined;
            if (node.constructor == ctor) {
                continue;
            }
            console.log("node being replaced by newer version: " + node.type);
            const newnode = (
                host.createNode as unknown as (type: string) => GraphNodeStructureLike
            )(node.type);
            changes = true;
            nodes[i] = newnode;
            newnode.configure(node.serialize());
            newnode.graph = this;
            nodesById[String(newnode.id)] = newnode;
            if (node.inputs) {
                newnode.inputs = node.inputs.concat();
            }
            if (node.outputs) {
                newnode.outputs = node.outputs.concat();
            }
        }
        if (!changes) {
            // preserve original local variable semantics without altering behavior
        }
        this.updateExecutionOrder();
    }

    // placeholders to keep this module self-contained during incremental migration.
    beforeChange(_info?: GraphNodeStructureLike): void {
        // implemented in later tasks
    }

    afterChange(_info?: GraphNodeStructureLike): void {
        // implemented in later tasks
    }

    setDirtyCanvas(_fg: boolean, _bg?: boolean): void {
        // implemented in later tasks
    }
}
