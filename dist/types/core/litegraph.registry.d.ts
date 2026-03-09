import type { LGraphNodeCanvasCollab as LGraphNode } from "../models/LGraphNode.canvas-collab";
import type { LiteGraphConstantsShape } from "./litegraph.constants";
export interface LGraphNodeLike extends Pick<LGraphNode, "type" | "title" | "properties" | "properties_info" | "flags" | "size" | "pos" | "mode" | "inputs" | "outputs" | "computeSize"> {
    category?: string;
    onNodeCreated?: () => void;
    [key: string]: unknown;
}
export interface LGraphNodeConstructorLike<TNode extends LGraphNodeLike = LGraphNodeLike> {
    new (title?: string): TNode;
    prototype: Record<string, unknown>;
    type?: string;
    title?: string;
    category?: string;
    filter?: string;
    skip_list?: boolean;
    supported_extensions?: string[];
    readonly name: string;
}
export interface LiteGraphRegistryHost extends Pick<LiteGraphConstantsShape, "debug" | "catch_exceptions" | "auto_sort_node_types" | "auto_load_slot_types" | "BOX_SHAPE" | "ROUND_SHAPE" | "CIRCLE_SHAPE" | "CARD_SHAPE" | "DEFAULT_POSITION" | "ALWAYS" | "registered_node_types" | "node_types_by_file_extension" | "Nodes" | "searchbox_extras"> {
    onNodeTypeRegistered?: (type: string, baseClass: LGraphNodeConstructorLike) => void;
    onNodeTypeReplaced?: (type: string, baseClass: LGraphNodeConstructorLike, prev: LGraphNodeConstructorLike) => void;
    registerNodeAndSlotType?: (node: LGraphNodeLike, slotType: string | number, out?: boolean) => void;
}
/**
 * LiteGraph 注册与工厂 API 迁移层（Task 05）。
 * 来源：`registerNodeType`、`unregisterNodeType`、`createNode`、`getNodeType*`、`addNodeMethod`。
 */
export declare class LiteGraphRegistry {
    private readonly host;
    private readonly lGraphNodePrototype;
    constructor(host: LiteGraphRegistryHost, lGraphNodePrototype: Record<string, unknown>);
    /**
     * Register a node class so it can be listed when the user wants to create a new one
     * @method registerNodeType
     * @param {String} type name of the node and path
     * @param {Class} base_class class containing the structure of a node
     */
    registerNodeType(type: string, baseClass: LGraphNodeConstructorLike): void;
    /**
     * removes a node type from the system
     * @method unregisterNodeType
     * @param {String|Object} type name of the node or the node constructor itself
     */
    unregisterNodeType(type: string | LGraphNodeConstructorLike): void;
    /**
     * Removes all previously registered node's types
     */
    clearRegisteredTypes(): void;
    /**
     * Adds this method to all nodetypes, existing and to be created
     * (You can add it to LGraphNode.prototype but then existing node types wont have it)
     * @method addNodeMethod
     * @param {Function} func
     */
    addNodeMethod(name: string, func: (...args: unknown[]) => unknown): void;
    /**
     * Create a node of a given type with a name. The node is not attached to any graph yet.
     * @method createNode
     * @param {String} type full name of the node class. p.e. "math/sin"
     * @param {String} name a name to distinguish from other nodes
     * @param {Object} options to set options
     */
    createNode<TNode extends LGraphNodeLike = LGraphNodeLike>(type: string, title?: string, options?: Record<string, unknown>): TNode | null;
    /**
     * Returns a registered node type with a given name
     * @method getNodeType
     * @param {String} type full name of the node class. p.e. "math/sin"
     * @return {Class} the node class
     */
    getNodeType<TCtor extends LGraphNodeConstructorLike = LGraphNodeConstructorLike>(type: string): TCtor | undefined;
    /**
     * Returns a list of node types matching one category
     * @method getNodeType
     * @param {String} category category name
     * @return {Array} array with all the node classes
     */
    getNodeTypesInCategory(category: string, filter: string): LGraphNodeConstructorLike[];
    /**
     * Returns a list with all the node type categories
     * @method getNodeTypesCategories
     * @param {String} filter only nodes with ctor.filter equal can be shown
     * @return {Array} array with all the names of the categories
     */
    getNodeTypesCategories(filter: string): string[];
}
