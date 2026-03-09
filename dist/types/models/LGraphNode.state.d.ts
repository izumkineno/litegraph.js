import type { INodeInputSlot, INodeOutputSlot, IWidget, Vector2 } from "../types/core-types";
import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import type { SerializedLGraphNode } from "../types/serialization";
import type { LGraphPersistence as LGraph } from "./LGraph.persistence";
export interface LGraphNodeGraphLike extends Pick<LGraph, "links"> {
    _version: number;
}
interface LiteGraphNodeStateHost extends Pick<LiteGraphConstantsShape, "use_uuids" | "NODE_WIDTH" | "INPUT" | "OUTPUT"> {
    uuidv4: () => string;
    createNode?: (type: string | null) => LGraphNode | null;
    cloneObject: <TSource extends object, TTarget extends object | undefined>(obj: TSource | null | undefined, target?: TTarget) => TSource | TTarget | null;
}
interface NodeInputSlotState extends INodeInputSlot {
    link: number | null;
}
interface NodeOutputSlotState extends INodeOutputSlot {
    links: number[] | null;
    _data?: unknown;
}
type NodePropertyMap = Record<string, unknown>;
type NodeFlagMap = Record<string, unknown>;
export type SerializedLGraphNodeState = Omit<Partial<SerializedLGraphNode>, "id"> & Record<string, unknown> & {
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
export declare class LGraphNode {
    static title_color: string;
    static title: string;
    static type: string | null;
    static widgets_up: boolean;
    static liteGraph: LiteGraphNodeStateHost;
    title: string;
    type: string | null;
    size: Vector2;
    graph: LGraphNodeGraphLike | null;
    graph_version: number;
    is_selected: boolean;
    mouseOver: boolean;
    id: number | string;
    inputs: NodeInputSlotState[];
    outputs: NodeOutputSlotState[];
    connections: unknown[];
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
    private _pos;
    onPropertyChanged?: (name: string, value: unknown, prev_value?: unknown) => boolean | void;
    onConnectionsChange?: (type: number, slot: number, connected: boolean, link_info: unknown, io_slot: NodeInputSlotState | NodeOutputSlotState) => void;
    onInputAdded?: (input: NodeInputSlotState) => void;
    onOutputAdded?: (output: NodeOutputSlotState) => void;
    onConfigure?: (info: SerializedLGraphNodeState) => void;
    onSerialize?: (info: SerializedLGraphNodeState) => unknown;
    constructor(title?: string);
    get pos(): Vector2;
    set pos(v: Vector2);
    private getClassMeta;
    _ctor(title?: string): void;
    /**
     * configure a node from an object containing the serialized info
     * @method configure
     */
    configure(info: SerializedLGraphNodeState): void;
    /**
     * serialize the content
     * @method serialize
     */
    serialize(): SerializedLGraphNodeState;
    clone(): this | null;
    /**
     * serialize and stringify
     * @method toString
     */
    toString(): string;
    /**
     * get the title string
     * @method getTitle
     */
    getTitle(): string;
    /**
     * sets the value of a property
     * @method setProperty
     * @param {String} name
     * @param {*} value
     */
    setProperty(name: string, value: unknown): void;
}
export {};
