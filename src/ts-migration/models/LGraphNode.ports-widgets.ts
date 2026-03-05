// TODO: Import full LiteGraph runtime host from its future module

import type {
    INodeInputSlot,
    INodeOutputSlot,
    IWidget,
    Vector2,
    WidgetCallback,
} from "../types/core-types";
import { LGraphNodeExecution } from "./LGraphNode.execution";

interface LiteGraphNodePortsWidgetsHost {
    NODE_TEXT_SIZE: number;
    NODE_WIDTH: number;
    NODE_SLOT_HEIGHT: number;
    NODE_WIDGET_HEIGHT: number;
    auto_load_slot_types: boolean;
    registerNodeAndSlotType?: (
        node: LGraphNodePortsWidgets,
        type: string | number | -1,
        isOutput?: boolean
    ) => void;
}

const defaultPortsWidgetsHost: LiteGraphNodePortsWidgetsHost = {
    NODE_TEXT_SIZE: 14,
    NODE_WIDTH: 140,
    NODE_SLOT_HEIGHT: 20,
    NODE_WIDGET_HEIGHT: 20,
    auto_load_slot_types: false,
};

interface LGraphNodePortsWidgetsClassMetadata extends Function {
    size?: Vector2;
    slot_start_y?: number;
    min_height?: number;
    widgets_info?: Record<string, unknown>;
    [key: string]: unknown;
}

type InputSlot = INodeInputSlot & { link: number | null };
type OutputSlot = INodeOutputSlot & { links: number[] | null; link?: number | null };

type PropertyInfo = Record<string, unknown> & {
    name?: string;
    type?: string;
    widget?: string;
    default_value?: unknown;
};

type WidgetOptions = Record<string, unknown> & {
    y?: number;
    callback?: unknown;
    property?: string;
    values?: unknown;
};

type WidgetLike = IWidget & {
    type: string;
    name: string;
    callback?: WidgetCallback | null;
    options: WidgetOptions;
    y?: number;
    computeSize?: (width: number) => [number, number];
};

/**
 * LGraphNode ports and widgets methods.
 * Source: `addInput/addOutput/addWidget/addCustomWidget/computeSize/getPropertyInfo`.
 */
export class LGraphNodePortsWidgets extends LGraphNodeExecution {
    onResize?: (size: Vector2) => void;
    declare onOutputAdded?: (output: OutputSlot) => void;
    onOutputRemoved?: (slot: number) => void;
    declare onInputAdded?: (input: InputSlot) => void;
    onInputRemoved?: (slot: number, slot_info: InputSlot) => void;
    onGetPropertyInfo?: (property: string) => PropertyInfo | null;

    private getPortsWidgetsHost(): LiteGraphNodePortsWidgetsHost {
        const classHost = (LGraphNodePortsWidgets as typeof LGraphNodePortsWidgets & {
            liteGraph?: Partial<LiteGraphNodePortsWidgetsHost>;
        }).liteGraph;
        const ctorHost = (this.constructor as typeof LGraphNodePortsWidgets & {
            liteGraph?: Partial<LiteGraphNodePortsWidgetsHost>;
        }).liteGraph;
        return { ...defaultPortsWidgetsHost, ...(classHost || {}), ...(ctorHost || {}) };
    }

    private getPortsWidgetsClassMeta(): LGraphNodePortsWidgetsClassMetadata {
        return this.constructor as LGraphNodePortsWidgetsClassMetadata;
    }

    private getGraphLinksMap(): Record<string, Record<string, unknown>> {
        const graphLike = this.graph as unknown as {
            links?: Record<string, Record<string, unknown>>;
        };
        return graphLike.links || {};
    }

    /**
     * changes node size and triggers callback
     * @method setSize
     * @param {vec2} size
     */
    setSize(size: Vector2): void {
        this.size = size;
        if (this.onResize) {
            this.onResize(this.size);
        }
    }

    /**
     * add a new property to this node
     * @method addProperty
     * @param {string} name
     * @param {*} default_value
     * @param {string} type string defining the output type ("vec3","number",...)
     * @param {Object} extra_info this can be used to have special properties of the property (like values, etc)
     */
    addProperty<T = unknown>(
        name: string,
        default_value: unknown,
        type: string,
        extra_info?: object
    ): T {
        const o: PropertyInfo = { name, type, default_value };
        if (extra_info) {
            for (const i in extra_info as Record<string, unknown>) {
                (o as Record<string, unknown>)[i] = (
                    extra_info as Record<string, unknown>
                )[i];
            }
        }
        if (!this.properties_info) {
            this.properties_info = [];
        }
        this.properties_info.push(o);
        if (!this.properties) {
            this.properties = {};
        }
        this.properties[name] = default_value;
        return o as unknown as T;
    }

    /**
     * add a new output slot to use in this node
     * @method addOutput
     * @param {string} name
     * @param {string} type string defining the output type ("vec3","number",...)
     * @param {Object} extra_info this can be used to have special properties of an output (label, special color, position, etc)
     */
    addOutput(
        name: string,
        type: string | -1,
        extra_info?: Partial<INodeOutputSlot>
    ): INodeOutputSlot {
        const output: OutputSlot = {
            name,
            type,
            links: null,
        };
        if (extra_info) {
            for (const i in extra_info) {
                (output as unknown as Record<string, unknown>)[i] = (
                    extra_info as Record<string, unknown>
                )[i];
            }
        }

        if (!this.outputs) {
            this.outputs = [];
        }
        this.outputs.push(output);
        if (this.onOutputAdded) {
            this.onOutputAdded(output);
        }

        const host = this.getPortsWidgetsHost();
        if (host.auto_load_slot_types) {
            (
                host.registerNodeAndSlotType as NonNullable<
                    LiteGraphNodePortsWidgetsHost["registerNodeAndSlotType"]
                >
            )(this, type, true);
        }

        this.setSize(this.computeSize());
        this.setDirtyCanvas(true, true);
        return output;
    }

    /**
     * add a new output slot to use in this node
     * @method addOutputs
     * @param {Array} array of triplets like [[name,type,extra_info],[...]]
     */
    addOutputs(
        array: [string, string | -1, Partial<INodeOutputSlot> | undefined][]
    ): void {
        const host = this.getPortsWidgetsHost();
        for (let i = 0; i < array.length; ++i) {
            const info = array[i];
            const o = {
                name: info[0],
                type: info[1],
                link: null,
            } as unknown as OutputSlot;
            if (array[2]) {
                for (const j in info[2]) {
                    (o as unknown as Record<string, unknown>)[j] = (
                        info[2] as Record<string, unknown>
                    )[j];
                }
            }

            if (!this.outputs) {
                this.outputs = [];
            }
            this.outputs.push(o);
            if (this.onOutputAdded) {
                this.onOutputAdded(o);
            }

            if (host.auto_load_slot_types) {
                (
                    host.registerNodeAndSlotType as NonNullable<
                        LiteGraphNodePortsWidgetsHost["registerNodeAndSlotType"]
                    >
                )(this, info[1], true);
            }
        }

        this.setSize(this.computeSize());
        this.setDirtyCanvas(true, true);
    }

    /**
     * remove an existing output slot
     * @method removeOutput
     * @param {number} slot
     */
    removeOutput(slot: number): void {
        (this as unknown as { disconnectOutput: (slot: number) => void }).disconnectOutput(
            slot
        );
        this.outputs.splice(slot, 1);
        for (let i = slot; i < this.outputs.length; ++i) {
            if (!this.outputs[i] || !this.outputs[i].links) {
                continue;
            }
            const links = this.outputs[i].links!;
            for (let j = 0; j < links.length; ++j) {
                const link = this.getGraphLinksMap()[String(links[j])];
                if (!link) {
                    continue;
                }
                link.origin_slot = (link.origin_slot as number) - 1;
            }
        }

        this.setSize(this.computeSize());
        if (this.onOutputRemoved) {
            this.onOutputRemoved(slot);
        }
        this.setDirtyCanvas(true, true);
    }

    /**
     * add a new input slot to use in this node
     * @method addInput
     * @param {string} name
     * @param {string} type string defining the input type ("vec3","number",...), it its a generic one use 0
     * @param {Object} extra_info this can be used to have special properties of an input (label, color, position, etc)
     */
    addInput(
        name: string,
        type: string | -1,
        extra_info?: Partial<INodeInputSlot>
    ): INodeInputSlot {
        const normalizedType = (type || (0 as unknown as -1 | string)) as
            | string
            | -1
            | number;
        const input: InputSlot = {
            name,
            type: normalizedType as string | -1,
            link: null,
        };
        if (extra_info) {
            for (const i in extra_info) {
                (input as unknown as Record<string, unknown>)[i] = (
                    extra_info as Record<string, unknown>
                )[i];
            }
        }

        if (!this.inputs) {
            this.inputs = [];
        }

        this.inputs.push(input);
        this.setSize(this.computeSize());

        if (this.onInputAdded) {
            this.onInputAdded(input);
        }

        const host = this.getPortsWidgetsHost();
        (
            host.registerNodeAndSlotType as NonNullable<
                LiteGraphNodePortsWidgetsHost["registerNodeAndSlotType"]
            >
        )(this, normalizedType);

        this.setDirtyCanvas(true, true);
        return input;
    }

    /**
     * add several new input slots in this node
     * @method addInputs
     * @param {Array} array of triplets like [[name,type,extra_info],[...]]
     */
    addInputs(
        array: [string, string | -1, Partial<INodeInputSlot> | undefined][]
    ): void {
        const host = this.getPortsWidgetsHost();
        for (let i = 0; i < array.length; ++i) {
            const info = array[i];
            const o: InputSlot = { name: info[0], type: info[1], link: null };
            if (array[2]) {
                for (const j in info[2]) {
                    (o as unknown as Record<string, unknown>)[j] = (
                        info[2] as Record<string, unknown>
                    )[j];
                }
            }

            if (!this.inputs) {
                this.inputs = [];
            }
            this.inputs.push(o);
            if (this.onInputAdded) {
                this.onInputAdded(o);
            }

            (
                host.registerNodeAndSlotType as NonNullable<
                    LiteGraphNodePortsWidgetsHost["registerNodeAndSlotType"]
                >
            )(this, info[1]);
        }

        this.setSize(this.computeSize());
        this.setDirtyCanvas(true, true);
    }

    /**
     * remove an existing input slot
     * @method removeInput
     * @param {number} slot
     */
    removeInput(slot: number): void {
        (this as unknown as { disconnectInput: (slot: number) => void }).disconnectInput(
            slot
        );
        const slot_info = this.inputs.splice(slot, 1);
        for (let i = slot; i < this.inputs.length; ++i) {
            if (!this.inputs[i]) {
                continue;
            }
            const link = this.getGraphLinksMap()[String(this.inputs[i].link)];
            if (!link) {
                continue;
            }
            link.target_slot = (link.target_slot as number) - 1;
        }
        this.setSize(this.computeSize());
        if (this.onInputRemoved) {
            this.onInputRemoved(slot, slot_info[0] as InputSlot);
        }
        this.setDirtyCanvas(true, true);
    }

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
    } {
        const o = {
            name,
            type,
            pos,
            direction,
            links: null,
        };
        this.connections.push(o);
        return o;
    }

    /**
     * computes the minimum size of a node according to its inputs and output slots
     * @method computeSize
     * @param {vec2} minHeight
     * @return {vec2} the total size
     */
    computeSize(out?: Vector2): Vector2 {
        const classMeta = this.getPortsWidgetsClassMeta();
        const host = this.getPortsWidgetsHost();
        if (classMeta.size) {
            return classMeta.size.concat() as Vector2;
        }

        let rows = Math.max(
            this.inputs ? this.inputs.length : 1,
            this.outputs ? this.outputs.length : 1
        );
        const size = out || (new Float32Array([0, 0]) as unknown as Vector2);
        rows = Math.max(rows, 1);
        const font_size = host.NODE_TEXT_SIZE; // although it should be graphcanvas.inner_text_font size

        const compute_text_size = (text: string | undefined): number => {
            if (!text) {
                return 0;
            }
            return font_size * text.length * 0.6;
        };

        const title_width = compute_text_size(this.title);
        let input_width = 0;
        let output_width = 0;

        if (this.inputs) {
            for (let i = 0, l = this.inputs.length; i < l; ++i) {
                const input = this.inputs[i] as InputSlot;
                const text = (input.label || input.name || "") as string;
                const text_width = compute_text_size(text);
                if (input_width < text_width) {
                    input_width = text_width;
                }
            }
        }

        if (this.outputs) {
            for (let i = 0, l = this.outputs.length; i < l; ++i) {
                const output = this.outputs[i] as OutputSlot;
                const text = (output.label || output.name || "") as string;
                const text_width = compute_text_size(text);
                if (output_width < text_width) {
                    output_width = text_width;
                }
            }
        }

        size[0] = Math.max(input_width + output_width + 10, title_width);
        size[0] = Math.max(size[0], host.NODE_WIDTH);
        if (this.widgets && this.widgets.length) {
            size[0] = Math.max(size[0], host.NODE_WIDTH * 1.5);
        }

        size[1] = (classMeta.slot_start_y || 0) + rows * host.NODE_SLOT_HEIGHT;

        let widgets_height = 0;
        if (this.widgets && this.widgets.length) {
            for (let i = 0, l = this.widgets.length; i < l; ++i) {
                const widget = this.widgets[i] as WidgetLike | null;
                if (!widget) {
                    continue;
                }
                if (widget.computeSize) {
                    widgets_height += widget.computeSize(size[0])[1] + 4;
                } else {
                    widgets_height += host.NODE_WIDGET_HEIGHT + 4;
                }
            }
            widgets_height += 8;
        }

        // compute height using widgets height
        if (this.widgets_up) {
            size[1] = Math.max(size[1], widgets_height);
        } else if (this.widgets_start_y != null) {
            size[1] = Math.max(size[1], widgets_height + this.widgets_start_y);
        } else {
            size[1] += widgets_height;
        }

        if (classMeta.min_height && size[1] < classMeta.min_height) {
            size[1] = classMeta.min_height;
        }

        size[1] += 6; // margin

        return size;
    }

    /**
     * returns all the info available about a property of this node.
     *
     * @method getPropertyInfo
     * @param {String} property name of the property
     * @return {Object} the object with all the available info
    */
    getPropertyInfo(property: string): object {
        let info: PropertyInfo | null = null;

        // there are several ways to define info about a property
        // legacy mode
        if (this.properties_info) {
            for (let i = 0; i < this.properties_info.length; ++i) {
                const item = this.properties_info[i] as PropertyInfo;
                if (item && item.name == property) {
                    info = item;
                    break;
                }
            }
        }
        // litescene mode using the constructor
        const classMeta = this.getPortsWidgetsClassMeta();
        if (classMeta["@" + property]) {
            info = classMeta["@" + property] as PropertyInfo;
        }

        if (classMeta.widgets_info && classMeta.widgets_info[property]) {
            info = classMeta.widgets_info[property] as PropertyInfo;
        }

        // litescene mode using the constructor
        if (!info && this.onGetPropertyInfo) {
            info = this.onGetPropertyInfo(property);
        }

        if (!info) {
            info = {};
        }
        if (!info.type) {
            info.type = typeof this.properties[property];
        }
        if (info.widget == "combo") {
            info.type = "enum";
        }

        return info;
    }

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
    addWidget<T extends IWidget>(
        type: T["type"],
        name: string,
        value: T["value"],
        callback?: WidgetCallback<T> | string | T["options"],
        options?: T["options"] | string
    ): T {
        if (!this.widgets) {
            this.widgets = [];
        }

        let widgetCallback = callback as WidgetCallback<T> | string | null | undefined;
        let widgetOptions = options as T["options"] | string | undefined;

        if (
            !widgetOptions &&
            widgetCallback &&
            (widgetCallback as unknown as { constructor?: unknown }).constructor ===
                Object
        ) {
            widgetOptions = widgetCallback as T["options"];
            widgetCallback = null;
        }

        if (
            widgetOptions &&
            (widgetOptions as unknown as { constructor?: unknown }).constructor ===
                String
        ) {
            // options can be the property name
            widgetOptions = {
                property: widgetOptions as string,
            } as T["options"];
        }

        if (
            widgetCallback &&
            (widgetCallback as unknown as { constructor?: unknown }).constructor ===
                String
        ) {
            // callback can be the property name
            if (!widgetOptions) {
                widgetOptions = {} as T["options"];
            }
            (widgetOptions as WidgetOptions).property = widgetCallback as string;
            widgetCallback = null;
        }

        if (
            widgetCallback &&
            (widgetCallback as unknown as { constructor?: unknown }).constructor !==
                Function
        ) {
            console.warn("addWidget: callback must be a function");
            widgetCallback = null;
        }

        const w = {
            type: (type as string).toLowerCase(),
            name,
            value,
            callback: widgetCallback as WidgetCallback<T> | null | undefined,
            options: (widgetOptions || {}) as WidgetOptions,
        } as WidgetLike;

        if (w.options.y !== undefined) {
            w.y = w.options.y;
        }

        if (!widgetCallback && !w.options.callback && !w.options.property) {
            console.warn(
                "LiteGraph addWidget(...) without a callback or property assigned"
            );
        }
        if (type == ("combo" as T["type"]) && !w.options.values) {
            throw "LiteGraph addWidget('combo',...) requires to pass values in options: { values:['red','blue'] }";
        }
        this.widgets.push(w);
        this.setSize(this.computeSize());
        return w as unknown as T;
    }

    addCustomWidget<T extends IWidget>(custom_widget: T): T {
        if (!this.widgets) {
            this.widgets = [];
        }
        this.widgets.push(custom_widget);
        return custom_widget;
    }

    // placeholder to keep this module self-contained during incremental migration.
    setDirtyCanvas(_fg: boolean, _bg: boolean): void {
        // implemented in Task 19
    }
}
