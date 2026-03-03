// TODO: Import LGraphNode from its future module
// TODO: Import LiteGraph runtime host from its future module

import type { INodeInputSlot, INodeOutputSlot, Vector2 } from "../types/core-types";

export interface LGraphNodeLike {
    type: string | null;
    title: string;
    category?: string;
    properties: Record<string, unknown>;
    properties_info: unknown[];
    flags: Record<string, unknown>;
    size: Vector2;
    pos: Vector2;
    mode: number;
    inputs?: INodeInputSlot[];
    outputs?: INodeOutputSlot[];
    computeSize?: () => Vector2;
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

export interface LiteGraphRegistryHost {
    debug: boolean;
    catch_exceptions: boolean;
    auto_sort_node_types: boolean;
    auto_load_slot_types: boolean;

    BOX_SHAPE: number;
    ROUND_SHAPE: number;
    CIRCLE_SHAPE: number;
    CARD_SHAPE: number;
    DEFAULT_POSITION: Vector2;
    ALWAYS: number;

    registered_node_types: Record<string, LGraphNodeConstructorLike>;
    node_types_by_file_extension: Record<string, LGraphNodeConstructorLike>;
    Nodes: Record<string, LGraphNodeConstructorLike>;
    searchbox_extras: Record<string, unknown>;

    onNodeTypeRegistered?: (
        type: string,
        baseClass: LGraphNodeConstructorLike
    ) => void;
    onNodeTypeReplaced?: (
        type: string,
        baseClass: LGraphNodeConstructorLike,
        prev: LGraphNodeConstructorLike
    ) => void;
    registerNodeAndSlotType?: (
        node: LGraphNodeLike,
        slotType: string | number,
        out?: boolean
    ) => void;
}

interface ShapeCarrier {
    _shape?: unknown;
}

/**
 * LiteGraph 注册与工厂 API 迁移层（Task 05）。
 * 来源：`registerNodeType`、`unregisterNodeType`、`createNode`、`getNodeType*`、`addNodeMethod`。
 */
export class LiteGraphRegistry {
    private readonly host: LiteGraphRegistryHost;
    private readonly lGraphNodePrototype: Record<string, unknown>;

    constructor(
        host: LiteGraphRegistryHost,
        lGraphNodePrototype: Record<string, unknown>
    ) {
        this.host = host;
        this.lGraphNodePrototype = lGraphNodePrototype;
    }

    /**
     * Register a node class so it can be listed when the user wants to create a new one
     * @method registerNodeType
     * @param {String} type name of the node and path
     * @param {Class} base_class class containing the structure of a node
     */
    registerNodeType(type: string, baseClass: LGraphNodeConstructorLike): void {
        if (!baseClass.prototype) {
            throw "Cannot register a simple object, it must be a class with a prototype";
        }

        baseClass.type = type;

        if (this.host.debug) {
            console.log("Node registered: " + type);
        }

        const className = baseClass.name;
        const pos = type.lastIndexOf("/");
        baseClass.category = type.substring(0, pos);

        if (!baseClass.title) {
            baseClass.title = className;
        }

        // extend class
        for (const i in this.lGraphNodePrototype) {
            const basePrototype = baseClass.prototype;
            if (basePrototype[i] === undefined) {
                basePrototype[i] = this.lGraphNodePrototype[i];
            }
        }

        const prev = this.host.registered_node_types[type];
        if (prev) {
            console.log("replacing node type: " + type);
        }

        const basePrototype = baseClass.prototype;
        const host = this.host;
        if (!Object.prototype.hasOwnProperty.call(basePrototype, "shape")) {
            Object.defineProperty(basePrototype, "shape", {
                set: function(this: ShapeCarrier, v: unknown): void {
                    switch (v) {
                        case "default":
                            delete this._shape;
                            break;
                        case "box":
                            this._shape = host.BOX_SHAPE;
                            break;
                        case "round":
                            this._shape = host.ROUND_SHAPE;
                            break;
                        case "circle":
                            this._shape = host.CIRCLE_SHAPE;
                            break;
                        case "card":
                            this._shape = host.CARD_SHAPE;
                            break;
                        default:
                            this._shape = v;
                    }
                },
                get: function(this: ShapeCarrier): unknown {
                    return this._shape;
                },
                enumerable: true,
                configurable: true,
            });

            // used to know which nodes to create when dragging files to the canvas
            if (baseClass.supported_extensions) {
                for (const ext of baseClass.supported_extensions) {
                    if (ext && typeof ext === "string") {
                        this.host.node_types_by_file_extension[ext.toLowerCase()] =
                            baseClass;
                    }
                }
            }
        }

        this.host.registered_node_types[type] = baseClass;
        if (baseClass.name) {
            this.host.Nodes[className] = baseClass;
        }
        if (this.host.onNodeTypeRegistered) {
            this.host.onNodeTypeRegistered(type, baseClass);
        }
        if (prev && this.host.onNodeTypeReplaced) {
            this.host.onNodeTypeReplaced(type, baseClass, prev);
        }

        // warnings
        if (baseClass.prototype.onPropertyChange) {
            console.warn(
                "LiteGraph node class " +
                    type +
                    " has onPropertyChange method, it must be called onPropertyChanged with d at the end"
            );
        }

        if (this.host.auto_load_slot_types) {
            try {
                const tempNode = new baseClass(baseClass.title || "tmpnode");
                if (tempNode && tempNode.inputs && this.host.registerNodeAndSlotType) {
                    for (let i = 0; i < tempNode.inputs.length; ++i) {
                        this.host.registerNodeAndSlotType(
                            tempNode,
                            tempNode.inputs[i] ? tempNode.inputs[i].type : 0
                        );
                    }
                }
                if (tempNode && tempNode.outputs && this.host.registerNodeAndSlotType) {
                    for (let i = 0; i < tempNode.outputs.length; ++i) {
                        this.host.registerNodeAndSlotType(
                            tempNode,
                            tempNode.outputs[i] ? tempNode.outputs[i].type : 0,
                            true
                        );
                    }
                }
            } catch (err) {
                if (this.host.debug) {
                    console.warn(
                        "Error while probing slots for node type: " + type,
                        err
                    );
                }
            }
        }
    }

    /**
     * removes a node type from the system
     * @method unregisterNodeType
     * @param {String|Object} type name of the node or the node constructor itself
     */
    unregisterNodeType(type: string | LGraphNodeConstructorLike): void {
        const baseClass =
            typeof type === "string" ? this.host.registered_node_types[type] : type;
        if (!baseClass) {
            throw "node type not found: " + type;
        }
        if (baseClass.type) {
            delete this.host.registered_node_types[baseClass.type];
        }
        if (baseClass.name) {
            delete this.host.Nodes[baseClass.name];
        }
    }

    /**
     * Removes all previously registered node's types
     */
    clearRegisteredTypes(): void {
        this.host.registered_node_types = {};
        this.host.node_types_by_file_extension = {};
        this.host.Nodes = {};
        this.host.searchbox_extras = {};
    }

    /**
     * Adds this method to all nodetypes, existing and to be created
     * (You can add it to LGraphNode.prototype but then existing node types wont have it)
     * @method addNodeMethod
     * @param {Function} func
     */
    addNodeMethod(name: string, func: (...args: unknown[]) => unknown): void {
        this.lGraphNodePrototype[name] = func;
        for (const i in this.host.registered_node_types) {
            const type = this.host.registered_node_types[i];
            const prototype = type.prototype;
            if (prototype[name]) {
                prototype["_" + name] = prototype[name];
            } // keep old in case of replacing
            prototype[name] = func;
        }
    }

    /**
     * Create a node of a given type with a name. The node is not attached to any graph yet.
     * @method createNode
     * @param {String} type full name of the node class. p.e. "math/sin"
     * @param {String} name a name to distinguish from other nodes
     * @param {Object} options to set options
     */
    createNode<TNode extends LGraphNodeLike = LGraphNodeLike>(
        type: string,
        title?: string,
        options?: Record<string, unknown>
    ): TNode | null {
        const baseClass = this.host.registered_node_types[type];
        if (!baseClass) {
            if (this.host.debug) {
                console.log('GraphNode type "' + type + '" not registered.');
            }
            return null;
        }

        title = title || baseClass.title || type;
        let node: TNode;

        if (this.host.catch_exceptions) {
            try {
                node = new baseClass(title) as TNode;
            } catch (err) {
                console.error(err);
                return null;
            }
        } else {
            node = new baseClass(title) as TNode;
        }

        node.type = type;

        if (!node.title && title) {
            node.title = title;
        }
        if (!node.properties) {
            node.properties = {};
        }
        if (!node.properties_info) {
            node.properties_info = [];
        }
        if (!node.flags) {
            node.flags = {};
        }
        if (!node.size && node.computeSize) {
            node.size = node.computeSize();
            // call onresize?
        }
        if (!node.pos) {
            node.pos = this.host.DEFAULT_POSITION.concat() as Vector2;
        }
        if (!node.mode) {
            node.mode = this.host.ALWAYS;
        }

        // extra options
        if (options) {
            for (const i in options) {
                node[i] = options[i];
            }
        }

        // callback
        if (node.onNodeCreated) {
            node.onNodeCreated();
        }

        return node;
    }

    /**
     * Returns a registered node type with a given name
     * @method getNodeType
     * @param {String} type full name of the node class. p.e. "math/sin"
     * @return {Class} the node class
     */
    getNodeType<TCtor extends LGraphNodeConstructorLike = LGraphNodeConstructorLike>(
        type: string
    ): TCtor | undefined {
        return this.host.registered_node_types[type] as TCtor | undefined;
    }

    /**
     * Returns a list of node types matching one category
     * @method getNodeType
     * @param {String} category category name
     * @return {Array} array with all the node classes
     */
    getNodeTypesInCategory(
        category: string,
        filter: string
    ): LGraphNodeConstructorLike[] {
        const result: LGraphNodeConstructorLike[] = [];
        for (const i in this.host.registered_node_types) {
            const type = this.host.registered_node_types[i];
            if (type.filter !== filter) {
                continue;
            }

            if (category === "") {
                if (type.category == null) {
                    result.push(type);
                }
            } else if (type.category === category) {
                result.push(type);
            }
        }

        if (this.host.auto_sort_node_types) {
            result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        }

        return result;
    }

    /**
     * Returns a list with all the node type categories
     * @method getNodeTypesCategories
     * @param {String} filter only nodes with ctor.filter equal can be shown
     * @return {Array} array with all the names of the categories
     */
    getNodeTypesCategories(filter: string): string[] {
        const categories: Record<string, 1> = { "": 1 };
        for (const i in this.host.registered_node_types) {
            const type = this.host.registered_node_types[i];
            if (type.category && !type.skip_list) {
                if (type.filter !== filter) {
                    continue;
                }
                categories[type.category] = 1;
            }
        }
        const result: string[] = [];
        for (const i in categories) {
            result.push(i);
        }
        return this.host.auto_sort_node_types ? result.sort() : result;
    }
}
