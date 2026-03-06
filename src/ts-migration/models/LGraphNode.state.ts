import type {
    INodeInputSlot,
    INodeOutputSlot,
    IWidget,
    Vector2,
} from "../types/core-types";
import { createClassHostResolver } from "../core/host-resolver";
import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import type { SerializedLGraphNode } from "../types/serialization";
import type { LGraphPersistence as LGraph } from "./LGraph.persistence";

export interface LGraphNodeGraphLike extends Pick<LGraph, "links"> {
    _version: number;
}

interface LGraphNodeClassMetadata extends Function {
    title?: string;
    type?: string | null;
}

interface LiteGraphNodeStateHost
    extends Pick<LiteGraphConstantsShape, "use_uuids" | "NODE_WIDTH" | "INPUT" | "OUTPUT"> {
    uuidv4: () => string;
    createNode?: (type: string | null) => LGraphNode | null;
    cloneObject: <TSource extends object, TTarget extends object | undefined>(
        obj: TSource | null | undefined,
        target?: TTarget
    ) => TSource | TTarget | null;
}

const defaultLiteGraphNodeHost: LiteGraphNodeStateHost = {
    use_uuids: false,
    uuidv4: () => "",
    NODE_WIDTH: 140,
    INPUT: 1,
    OUTPUT: 2,
    cloneObject: <TSource extends object, TTarget extends object | undefined>(
        obj: TSource | null | undefined,
        target?: TTarget
    ): TSource | TTarget | null => {
        if (obj == null) {
            return null;
        }
        const cloned = JSON.parse(JSON.stringify(obj)) as TSource;
        if (!target) {
            return cloned;
        }
        for (const key in cloned) {
            (target as Record<string, unknown>)[key] = (
                cloned as Record<string, unknown>
            )[key];
        }
        return target;
    },
};

const resolveNodeStateHost = createClassHostResolver(defaultLiteGraphNodeHost, {
    cacheKey: "LGraphNode.state",
    fallbackOwners: [() => LGraphNode],
});

interface NodeInputSlotState extends INodeInputSlot {
    link: number | null;
}

interface NodeOutputSlotState extends INodeOutputSlot {
    links: number[] | null;
    _data?: unknown;
}

type NodePropertyMap = Record<string, unknown>;
type NodeFlagMap = Record<string, unknown>;

export type SerializedLGraphNodeState = Omit<
    Partial<SerializedLGraphNode>,
    "id"
> &
    Record<string, unknown> & {
        id?: number | string;
        type?: string | null;
        pos?: Vector2;
        size?: Vector2;
        flags?: NodeFlagMap;
        order?: number;
        mode?: number;
        inputs?: NodeInputSlotState[];
        outputs?: NodeOutputSlotState[];
        title?: string;
        properties?: NodePropertyMap;
        widgets_values?: unknown[];
        color?: string;
        bgcolor?: string;
        boxcolor?: string;
        shape?: number | string;
    };

/**
 * Base Class for all the node type classes
 * @class LGraphNode
 * @param {String} name a name for the node
 */
export class LGraphNode {
    static title_color: string;
    static title: string;
    static type: string | null;
    static widgets_up: boolean;
    static liteGraph: LiteGraphNodeStateHost = defaultLiteGraphNodeHost;

    title: string;
    type: string | null;
    size: Vector2;
    graph: LGraphNodeGraphLike | null;
    graph_version = 0;
    is_selected = false;
    mouseOver = false;

    id: number | string;

    // inputs available: array of inputs
    inputs: NodeInputSlotState[];
    outputs: NodeOutputSlotState[];
    connections: unknown[];

    // local data
    properties: NodePropertyMap;
    properties_info: unknown[];

    flags: NodeFlagMap;

    color?: string;
    bgcolor?: string;
    boxcolor?: string;
    shape?: number | string;

    serialize_widgets?: boolean;
    skip_list?: boolean;
    mode?: number;
    widgets_up?: boolean;
    widgets_start_y?: number;
    clip_area?: boolean;
    resizable?: boolean;
    horizontal?: boolean;
    has_errors?: boolean;

    order?: number;
    last_serialization?: SerializedLGraphNodeState;

    widgets?: Array<IWidget | null>;

    private _pos: Float32Array;

    onPropertyChanged?: (
        name: string,
        value: unknown,
        prev_value?: unknown
    ) => boolean | void;
    onConnectionsChange?: (
        type: number,
        slot: number,
        connected: boolean,
        link_info: unknown,
        io_slot: NodeInputSlotState | NodeOutputSlotState
    ) => void;
    onInputAdded?: (input: NodeInputSlotState) => void;
    onOutputAdded?: (output: NodeOutputSlotState) => void;
    onConfigure?: (info: SerializedLGraphNodeState) => void;
    onSerialize?: (info: SerializedLGraphNodeState) => unknown;

    constructor(title?: string) {
        this._pos = new Float32Array(10);
        this.title = "Unnamed";
        this.type = null;
        this.size = [140, 60];
        this.graph = null;
        this.id = -1;
        this.inputs = [];
        this.outputs = [];
        this.connections = [];
        this.properties = {};
        this.properties_info = [];
        this.flags = {};

        this._ctor(title);
    }

    get pos(): Vector2 {
        if (!this._pos) {
            this._pos = new Float32Array(10);
        }
        return this._pos as unknown as Vector2;
    }

    set pos(v: Vector2) {
        if (!v || v.length < 2) {
            return;
        }
        if (!this._pos) {
            this._pos = new Float32Array(10);
        }
        this._pos[0] = v[0];
        this._pos[1] = v[1];
    }

    private getClassMeta(): LGraphNodeClassMetadata {
        return this.constructor as LGraphNodeClassMetadata;
    }

    _ctor(title?: string): void {
        const host = resolveNodeStateHost(this);
        this.title = title || "Unnamed";
        this.size = [host.NODE_WIDTH, 60];
        this.graph = null;

        this._pos = new Float32Array(10);
        Object.defineProperty(this, "pos", {
            set: (v: Vector2) => {
                if (!v || v.length < 2) {
                    return;
                }
                this._pos[0] = v[0];
                this._pos[1] = v[1];
            },
            get: () => this._pos as unknown as Vector2,
            enumerable: true,
        });

        if (host.use_uuids) {
            this.id = host.uuidv4();
        } else {
            this.id = -1; // not know till not added
        }
        this.type = null;

        // inputs available: array of inputs
        this.inputs = [];
        this.outputs = [];
        this.connections = [];

        // local data
        this.properties = {}; // for the values
        this.properties_info = []; // for the info

        this.flags = {};
    }

    /**
     * configure a node from an object containing the serialized info
     * @method configure
     */
    configure(info: SerializedLGraphNodeState): void {
        if (this.graph) {
            this.graph._version++;
        }
        const self = this as unknown as Record<string, unknown>;
        const infoRecord = info as Record<string, unknown>;

        for (const j in infoRecord) {
            if (j == "properties") {
                // i don't want to clone properties, I want to reuse the old container
                const properties = info.properties as NodePropertyMap;
                for (const k in properties) {
                    this.properties[k] = properties[k];
                    if (this.onPropertyChanged) {
                        this.onPropertyChanged(k, properties[k]);
                    }
                }
                continue;
            }

            const fieldValue = infoRecord[j];
            if (fieldValue == null) {
                continue;
            } else if (typeof fieldValue == "object") {
                // object
                const selfField = self[j];
                const configuredField = selfField as
                    | { configure?: (value: unknown) => void }
                    | undefined;
                if (configuredField && configuredField.configure) {
                    configuredField.configure(fieldValue);
                } else {
                    self[j] = resolveNodeStateHost(this).cloneObject(
                        fieldValue as object,
                        selfField as object | undefined
                    );
                }
            } // value
            else {
                self[j] = fieldValue;
            }
        }

        if (!info.title) {
            this.title = this.getClassMeta().title as string;
        }

        if (this.inputs) {
            for (let i = 0; i < this.inputs.length; ++i) {
                const input = this.inputs[i];
                const link_info =
                    this.graph && input
                        ? (this.graph.links as Record<string, unknown>)[
                              input.link as unknown as string
                          ]
                        : null;
                if (this.onConnectionsChange) {
                    this.onConnectionsChange(
                        resolveNodeStateHost(this).INPUT,
                        i,
                        true,
                        link_info,
                        input
                    ); // link_info has been created now, so its updated
                }

                if (this.onInputAdded) {
                    this.onInputAdded(input);
                }
            }
        }

        if (this.outputs) {
            for (let i = 0; i < this.outputs.length; ++i) {
                const output = this.outputs[i];
                if (!output.links) {
                    continue;
                }
                for (let j = 0; j < output.links.length; ++j) {
                    const link_info = this.graph
                        ? (this.graph.links as Record<string, unknown>)[
                              output.links[j] as unknown as string
                          ]
                        : null;
                    if (this.onConnectionsChange) {
                        this.onConnectionsChange(
                            resolveNodeStateHost(this).OUTPUT,
                            i,
                            true,
                            link_info,
                            output
                        ); // link_info has been created now, so its updated
                    }
                }

                if (this.onOutputAdded) {
                    this.onOutputAdded(output);
                }
            }
        }

        if (this.widgets) {
            for (let i = 0; i < this.widgets.length; ++i) {
                const widget: IWidget | null = this.widgets[i] || null;
                if (!widget) {
                    continue;
                }
                const propertyName = (widget.options as { property?: string } | undefined)
                    ?.property;
                if (
                    propertyName &&
                    this.properties[propertyName] != undefined
                ) {
                    widget.value = JSON.parse(
                        JSON.stringify(this.properties[propertyName])
                    ) as typeof widget.value;
                }
            }
            if (info.widgets_values) {
                for (let i = 0; i < info.widgets_values.length; ++i) {
                    if (this.widgets[i]) {
                        this.widgets[i]!.value = info.widgets_values[i];
                    }
                }
            }
        }

        if (this.onConfigure) {
            this.onConfigure(info);
        }
    }

    /**
     * serialize the content
     * @method serialize
     */
    serialize(): SerializedLGraphNodeState {
        // create serialization object
        const host = resolveNodeStateHost(this);
        const o: SerializedLGraphNodeState = {
            id: this.id,
            type: this.type,
            pos: this.pos,
            size: this.size,
            flags: host.cloneObject(this.flags) as NodeFlagMap,
            order: this.order,
            mode: this.mode,
        };

        // special case for when there were errors
        if (this.constructor === LGraphNode && this.last_serialization) {
            return this.last_serialization;
        }

        if (this.inputs) {
            o.inputs = this.inputs;
        }

        if (this.outputs) {
            // clear outputs last data (because data in connections is never serialized but stored inside the outputs info)
            for (let i = 0; i < this.outputs.length; i++) {
                delete this.outputs[i]._data;
            }
            o.outputs = this.outputs;
        }

        if (this.title && this.title != this.getClassMeta().title) {
            o.title = this.title;
        }

        if (this.properties) {
            o.properties = host.cloneObject(this.properties) as NodePropertyMap;
        }

        if (this.widgets && this.serialize_widgets) {
            o.widgets_values = [];
            for (let i = 0; i < this.widgets.length; ++i) {
                if (this.widgets[i]) {
                    o.widgets_values[i] = this.widgets[i]!.value;
                } else {
                    o.widgets_values[i] = null;
                }
            }
        }

        if (!o.type) {
            o.type = this.getClassMeta().type as string | null;
        }

        if (this.color) {
            o.color = this.color;
        }
        if (this.bgcolor) {
            o.bgcolor = this.bgcolor;
        }
        if (this.boxcolor) {
            o.boxcolor = this.boxcolor;
        }
        if (this.shape) {
            o.shape = this.shape;
        }

        if (this.onSerialize) {
            if (this.onSerialize(o)) {
                console.warn(
                    "node onSerialize shouldnt return anything, data should be stored in the object pass in the first parameter"
                );
            }
        }

        return o;
    }

    /* Creates a clone of this node */
    clone(): this | null {
        const createNode = resolveNodeStateHost(this).createNode as (
            type: string | null
        ) => LGraphNode | null;
        const node = createNode(this.type);
        if (!node) {
            return null;
        }

        // we clone it because serialize returns shared containers
        const data = resolveNodeStateHost(this).cloneObject(
            this.serialize()
        ) as SerializedLGraphNodeState;

        // remove links
        if (data.inputs) {
            for (let i = 0; i < data.inputs.length; ++i) {
                data.inputs[i].link = null;
            }
        }

        if (data.outputs) {
            for (let i = 0; i < data.outputs.length; ++i) {
                const outputSlot = data.outputs[i];
                if (!outputSlot) {
                    continue;
                }
                if (outputSlot.links) {
                    outputSlot.links.length = 0;
                }
            }
        }

        delete data.id;

        const host = resolveNodeStateHost(this);
        if (host.use_uuids) {
            data.id = host.uuidv4();
        }

        // remove links
        node.configure(data);

        return node as this;
    }

    /**
     * serialize and stringify
     * @method toString
     */
    toString(): string {
        return JSON.stringify(this.serialize());
    }

    /**
     * get the title string
     * @method getTitle
     */
    getTitle(): string {
        return (this.title || this.getClassMeta().title) as string;
    }

    /**
     * sets the value of a property
     * @method setProperty
     * @param {String} name
     * @param {*} value
     */
    setProperty(name: string, value: unknown): void {
        if (!this.properties) {
            this.properties = {};
        }
        if (value === this.properties[name]) {
            return;
        }
        const prev_value = this.properties[name];
        this.properties[name] = value;
        if (this.onPropertyChanged) {
            if (this.onPropertyChanged(name, value, prev_value) === false) {
                // abort change
                this.properties[name] = prev_value;
            }
        }
        if (this.widgets) {
            // widgets could be linked to properties
            for (let i = 0; i < this.widgets.length; ++i) {
                const widget = this.widgets[i];
                if (!widget) {
                    continue;
                }
                const propertyName = (widget.options as { property?: string } | undefined)
                    ?.property;
                if (propertyName == name) {
                    widget.value = value as typeof widget.value;
                    break;
                }
            }
        }
    }
}
