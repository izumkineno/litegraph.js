import type { LGraphGroup } from "./LGraphGroup";
import type { LGraphNodeCanvasCollab as LGraphNode } from "./LGraphNode.canvas-collab";
import { LGraphExecution } from "./LGraph.execution";
interface GraphInputSlotStructureLike {
    link: number | null;
}
interface GraphOutputSlotStructureLike {
    links: number[] | null;
}
type GraphNodeId = number | string;
type GraphNodeStructureBase = Pick<LGraphNode, "id" | "type" | "title" | "alignToGrid" | "disconnectInput" | "disconnectOutput" | "serialize" | "configure" | "isPointInside">;
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
/**
 * LGraph structure-management methods.
 * Source: `add/remove/getNodeById/find*()/getNodeOnPos/getGroupOnPos`.
 */
export declare class LGraphStructure extends LGraphExecution {
    onNodeAdded?: (node: GraphNodeStructureLike) => void;
    onNodeRemoved?: (node: GraphNodeStructureLike) => void;
    private getNodesByIdMap;
    private getNodeArray;
    private getGroupArray;
    private isGroupNode;
    /**
     * Adds a new node instance to this graph
     * @method add
     * @param {LGraphNode} node the instance of the node
     */
    add(node: GraphNodeStructureLike | GraphGroupStructureLike | null, skip_compute_order?: boolean): GraphNodeStructureLike | GraphGroupStructureLike | undefined;
    /**
     * Removes a node from the graph
     * @method remove
     * @param {LGraphNode} node the instance of the node
     */
    remove(node: GraphNodeStructureLike | GraphGroupStructureLike): void;
    /**
     * Returns a node by its id.
     * @method getNodeById
     * @param {Number} id
     */
    getNodeById<T extends GraphNodeStructureLike = GraphNodeStructureLike>(id: GraphNodeId | null | undefined): T | null | undefined;
    /**
     * Returns a list of nodes that matches a class
     * @method findNodesByClass
     * @param {Class} classObject the class itself (not an string)
     * @return {Array} a list with all the nodes of this type
     */
    findNodesByClass<T extends GraphNodeStructureLike = GraphNodeStructureLike>(classObject: Function, result?: T[]): T[];
    /**
     * Returns a list of nodes that matches a type
     * @method findNodesByType
     * @param {String} type the name of the node type
     * @return {Array} a list with all the nodes of this type
     */
    findNodesByType<T extends GraphNodeStructureLike = GraphNodeStructureLike>(type: string, result?: T[]): T[];
    /**
     * Returns the first node that matches a name in its title
     * @method findNodeByTitle
     * @param {String} name the name of the node to search
     * @return {Node} the node or null
     */
    findNodeByTitle<T extends GraphNodeStructureLike = GraphNodeStructureLike>(title: string): T | null;
    /**
     * Returns a list of nodes that matches a name
     * @method findNodesByTitle
     * @param {String} name the name of the node to search
     * @return {Array} a list with all the nodes with this name
     */
    findNodesByTitle<T extends GraphNodeStructureLike = GraphNodeStructureLike>(title: string): T[];
    /**
     * Returns the top-most node in this position of the canvas
     * @method getNodeOnPos
     * @param {number} x the x coordinate in canvas space
     * @param {number} y the y coordinate in canvas space
     * @param {Array} nodes_list a list with all the nodes to search from, by default is all the nodes in the graph
     * @return {LGraphNode} the node at this position or null
     */
    getNodeOnPos<T extends GraphNodeStructureLike = GraphNodeStructureLike>(x: number, y: number, nodes_list?: Array<GraphNodeStructureLike | GraphGroupStructureLike>, margin?: number): T | GraphGroupStructureLike | null;
    /**
     * Returns the top-most group in that position
     * @method getGroupOnPos
     * @param {number} x the x coordinate in canvas space
     * @param {number} y the y coordinate in canvas space
     * @return {LGraphGroup} the group or null
     */
    getGroupOnPos(x: number, y: number): GraphGroupStructureLike | null;
    /**
     * Checks that the node type matches the node type registered, used when replacing a nodetype by a newer version during execution
     * this replaces the ones using the old version with the new version
     * @method checkNodeTypes
     */
    checkNodeTypes(): void;
    beforeChange(_info?: GraphNodeStructureLike): void;
    afterChange(_info?: GraphNodeStructureLike): void;
    setDirtyCanvas(_fg: boolean, _bg?: boolean): void;
}
export {};
