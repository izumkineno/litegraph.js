import type { INodeInputSlot, INodeOutputSlot, IWidget, Vector2, WidgetCallback } from "../types/core-types";
import { LGraphNodeExecution } from "./LGraphNode.execution";
type InputSlot = INodeInputSlot & {
    link: number | null;
};
type OutputSlot = INodeOutputSlot & {
    links: number[] | null;
    link?: number | null;
};
type PropertyInfo = Record<string, unknown> & {
    name?: string;
    type?: string;
    widget?: string;
    default_value?: unknown;
};
/**
 * LGraphNode ports and widgets methods.
 * Source: `addInput/addOutput/addWidget/addCustomWidget/computeSize/getPropertyInfo`.
 */
export declare class LGraphNodePortsWidgets extends LGraphNodeExecution {
    onResize?: (size: Vector2) => void;
    onOutputAdded?: (output: OutputSlot) => void;
    onOutputRemoved?: (slot: number) => void;
    onInputAdded?: (input: InputSlot) => void;
    onInputRemoved?: (slot: number, slot_info: InputSlot) => void;
    onGetPropertyInfo?: (property: string) => PropertyInfo | null;
    private getPortsWidgetsClassMeta;
    private getGraphLinksMap;
    /**
     * changes node size and triggers callback
     * @method setSize
     * @param {vec2} size
     */
    setSize(size: Vector2): void;
    /**
     * add a new property to this node
     * @method addProperty
     * @param {string} name
     * @param {*} default_value
     * @param {string} type string defining the output type ("vec3","number",...)
     * @param {Object} extra_info this can be used to have special properties of the property (like values, etc)
     */
    addProperty<T = unknown>(name: string, default_value: unknown, type: string, extra_info?: object): T;
    /**
     * add a new output slot to use in this node
     * @method addOutput
     * @param {string} name
     * @param {string} type string defining the output type ("vec3","number",...)
     * @param {Object} extra_info this can be used to have special properties of an output (label, special color, position, etc)
     */
    addOutput(name: string, type: string | number, extra_info?: Partial<INodeOutputSlot>): INodeOutputSlot;
    /**
     * add a new output slot to use in this node
     * @method addOutputs
     * @param {Array} array of triplets like [[name,type,extra_info],[...]]
     */
    addOutputs(array: [string, string | number, Partial<INodeOutputSlot> | undefined][]): void;
    /**
     * remove an existing output slot
     * @method removeOutput
     * @param {number} slot
     */
    removeOutput(slot: number): void;
    /**
     * add a new input slot to use in this node
     * @method addInput
     * @param {string} name
     * @param {string} type string defining the input type ("vec3","number",...), it its a generic one use 0
     * @param {Object} extra_info this can be used to have special properties of an input (label, color, position, etc)
     */
    addInput(name: string, type: string | number, extra_info?: Partial<INodeInputSlot>): INodeInputSlot;
    /**
     * add several new input slots in this node
     * @method addInputs
     * @param {Array} array of triplets like [[name,type,extra_info],[...]]
     */
    addInputs(array: [string, string | number, Partial<INodeInputSlot> | undefined][]): void;
    /**
     * remove an existing input slot
     * @method removeInput
     * @param {number} slot
     */
    removeInput(slot: number): void;
    /**
     * add an special connection to this node (used for special kinds of graphs)
     * @method addConnection
     * @param {string} name
     * @param {string} type string defining the input type ("vec3","number",...)
     * @param {[x,y]} pos position of the connection inside the node
     * @param {string} direction if is input or output
     */
    addConnection(name: string, type: string, pos: Vector2, direction: string): {
        name: string;
        type: string;
        pos: Vector2;
        direction: string;
        links: null;
    };
    /**
     * computes the minimum size of a node according to its inputs and output slots
     * @method computeSize
     * @param {vec2} minHeight
     * @return {vec2} the total size
     */
    computeSize(out?: Vector2): Vector2;
    /**
     * returns all the info available about a property of this node.
     *
     * @method getPropertyInfo
     * @param {String} property name of the property
     * @return {Object} the object with all the available info
    */
    getPropertyInfo(property: string): object;
    /**
     * Defines a widget inside the node, it will be rendered on top of the node, you can control lots of properties
     *
     * @method addWidget
     * @param {String} type the widget type (could be "number","string","combo"
     * @param {String} name the text to show on the widget
     * @param {String} value the default value
     * @param {Function|String} callback function to call when it changes (optionally, it can be the name of the property to modify)
     * @param {Object} options the object that contains special properties of this widget
     * @return {Object} the created widget object
     */
    addWidget<T extends IWidget>(type: T["type"], name: string, value: T["value"], callback?: WidgetCallback<T> | string | T["options"], options?: T["options"] | string): T;
    addCustomWidget<T extends IWidget>(custom_widget: T): T;
    setDirtyCanvas(_fg: boolean, _bg: boolean): void;
}
export {};
