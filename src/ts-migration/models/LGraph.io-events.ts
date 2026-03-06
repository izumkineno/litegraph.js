import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import type { LGraphNodeCanvasCollab as LGraphNode } from "./LGraphNode.canvas-collab";
import { createClassHostResolver } from "../core/host-resolver";
import { type LiteGraphLifecycleHost } from "./LGraph.lifecycle";
import { LGraphStructure } from "./LGraph.structure";

interface LiteGraphIOEventsHost
    extends LiteGraphLifecycleHost,
        Pick<LiteGraphConstantsShape, "ALWAYS"> {
    Subgraph?: Function;
    GraphInput?: Function;
}

const defaultIOEventsHost: LiteGraphIOEventsHost = {
    debug: false,
    getTime: () => Date.now(),
    ALWAYS: 0,
};

const resolveIOEventsHost = createClassHostResolver(defaultIOEventsHost, {
    cacheKey: "LGraph.io-events",
    fallbackOwners: [() => LGraphIOEvents, () => LGraphStructure],
});

type GraphNodeEventBase = Pick<LGraphNode, "id" | "mode">;

interface GraphNodeEventLike extends GraphNodeEventBase {
    constructor: Function;
    properties: { name?: string };
    onTrigger: (value: unknown) => void;
    setTrigger: (func: (...args: unknown[]) => unknown) => void;
    actionDo: (action: string, param?: unknown, options?: unknown) => void;
    sendEventToAllNodes: (
        eventname: string,
        params?: unknown,
        mode?: number
    ) => void;
    [key: string]: unknown;
}

interface GraphCanvasEventLike {
    live_mode?: boolean;
    [key: string]: unknown;
}

interface GraphLinkEventLike {
    target_id: number;
    target_slot: number;
    _last_time?: number;
}

interface GraphGlobalIOSlotLike {
    name: string;
    type: string;
    value: unknown;
}

/**
 * LGraph graph-level IO and event methods.
 * Source: `sendEventToAllNodes/onAction/trigger/addInput/addOutput/triggerInput/connectionChange`.
 */
export class LGraphIOEvents extends LGraphStructure {
    onTrigger?: (action: string, param: unknown) => void;

    onInputAdded?: (name: string, type: string) => void;
    onInputRemoved?: (name: string) => void;
    onInputRenamed?: (old_name: string, name: string) => void;
    onInputTypeChanged?: (name: string, type: string) => void;

    onOutputAdded?: (name: string, type: string) => void;
    onOutputRemoved?: (name: string) => void;
    onOutputRenamed?: (old_name: string, name: string) => void;
    onOutputTypeChanged?: (name: string, type: string) => void;

    onInputsOutputsChange?: () => void;

    onBeforeChange?: (
        graph: LGraphIOEvents,
        info?: GraphNodeEventLike
    ) => void;
    onAfterChange?: (
        graph: LGraphIOEvents,
        info?: GraphNodeEventLike
    ) => void;
    onConnectionChange?: (node: GraphNodeEventLike) => void;

    on_change?: (graph: LGraphIOEvents) => void;

    private _input_nodes: GraphNodeEventLike[] = [];

    private getNodesInEventOrder(): GraphNodeEventLike[] {
        const ordered = this._nodes_in_order as unknown as GraphNodeEventLike[] | null;
        const fallback = this._nodes as unknown as GraphNodeEventLike[];
        return ordered || fallback;
    }

    private getInputSlots(): Record<string, GraphGlobalIOSlotLike> {
        return this.inputs as Record<string, GraphGlobalIOSlotLike>;
    }

    private getOutputSlots(): Record<string, GraphGlobalIOSlotLike> {
        return this.outputs as Record<string, GraphGlobalIOSlotLike>;
    }

    private getCanvasList(): GraphCanvasEventLike[] | null {
        return this.list_of_graphcanvas as unknown as GraphCanvasEventLike[] | null;
    }

    /**
     * Sends an event to all the nodes, useful to trigger stuff
     * @method sendEventToAllNodes
     * @param {String} eventname the name of the event (function to be called)
     * @param {Array} params parameters in array format
     */
    sendEventToAllNodes(eventname: string, params?: unknown, mode?: number): void {
        const host = resolveIOEventsHost(this);
        const targetMode = mode || host.ALWAYS;

        const nodes = this.getNodesInEventOrder();
        if (!nodes) {
            return;
        }

        for (let j = 0, l = nodes.length; j < l; ++j) {
            const node = nodes[j];

            if (node.constructor === host.Subgraph && eventname != "onExecute") {
                if (node.mode == targetMode) {
                    node.sendEventToAllNodes(eventname, params, targetMode);
                }
                continue;
            }

            if (!node[eventname] || node.mode != targetMode) {
                continue;
            }

            if (params === undefined) {
                (node[eventname] as () => void).call(node);
            } else if ((params as { constructor?: unknown }).constructor === Array) {
                (node[eventname] as (...args: unknown[]) => void).apply(
                    node,
                    params as unknown[]
                );
            } else {
                (node[eventname] as (value: unknown) => void).call(node, params);
            }
        }
    }

    sendActionToCanvas(action: string, params?: unknown): void {
        const canvasList = this.getCanvasList();
        if (!canvasList) {
            return;
        }

        for (let i = 0; i < canvasList.length; ++i) {
            const canvas = canvasList[i];
            if (canvas[action]) {
                (canvas[action] as (...args: unknown[]) => void).apply(
                    canvas,
                    params as unknown[]
                );
            }
        }
    }

    onAction(action: string, param?: unknown, options?: unknown): void {
        const host = resolveIOEventsHost(this);
        this._input_nodes = this.findNodesByClass(
            host.GraphInput as Function,
            this._input_nodes as unknown as never[]
        ) as unknown as GraphNodeEventLike[];
        for (let i = 0; i < this._input_nodes.length; ++i) {
            const node = this._input_nodes[i];
            if (node.properties.name != action) {
                continue;
            }
            // wrap node.onAction(action, param);
            node.actionDo(action, param, options);
            break;
        }
    }

    trigger(action: string, param?: unknown): void {
        if (this.onTrigger) {
            this.onTrigger(action, param);
        }
    }

    /**
     * Tell this graph it has a global graph input of this type
     * @method addGlobalInput
     * @param {String} name
     * @param {String} type
     * @param {*} value [optional]
     */
    addInput(name: string, type: string, value?: unknown): void {
        const input = this.getInputSlots()[name];
        if (input) {
            // already exist
            return;
        }

        this.beforeChange();
        this.getInputSlots()[name] = { name, type, value };
        this._version++;
        this.afterChange();

        if (this.onInputAdded) {
            this.onInputAdded(name, type);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
    }

    /**
     * Assign a data to the global graph input
     * @method setGlobalInputData
     * @param {String} name
     * @param {*} data
     */
    setInputData(name: string, data: unknown): void {
        const input = this.getInputSlots()[name];
        if (!input) {
            return;
        }
        input.value = data;
    }

    /**
     * Returns the current value of a global graph input
     * @method getInputData
     * @param {String} name
     * @return {*} the data
     */
    getInputData<T = unknown>(name: string): T | null {
        const input = this.getInputSlots()[name];
        if (!input) {
            return null;
        }
        return input.value as T;
    }

    /**
     * Changes the name of a global graph input
     * @method renameInput
     * @param {String} old_name
     * @param {String} new_name
     */
    renameInput(old_name: string, name: string): false | undefined {
        if (name == old_name) {
            return;
        }

        const inputs = this.getInputSlots();

        if (!inputs[old_name]) {
            return false;
        }

        if (inputs[name]) {
            console.error("there is already one input with that name");
            return false;
        }

        inputs[name] = inputs[old_name];
        delete inputs[old_name];
        this._version++;

        if (this.onInputRenamed) {
            this.onInputRenamed(old_name, name);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
        return;
    }

    /**
     * Changes the type of a global graph input
     * @method changeInputType
     * @param {String} name
     * @param {String} type
     */
    changeInputType(name: string, type: string): false | undefined {
        const inputs = this.getInputSlots();
        if (!inputs[name]) {
            return false;
        }

        if (
            inputs[name].type &&
            String(inputs[name].type).toLowerCase() == String(type).toLowerCase()
        ) {
            return;
        }

        inputs[name].type = type;
        this._version++;
        if (this.onInputTypeChanged) {
            this.onInputTypeChanged(name, type);
        }
        return;
    }

    /**
     * Removes a global graph input
     * @method removeInput
     * @param {String} name
     * @param {String} type
     */
    removeInput(name: string): boolean {
        const inputs = this.getInputSlots();
        if (!inputs[name]) {
            return false;
        }

        delete inputs[name];
        this._version++;

        if (this.onInputRemoved) {
            this.onInputRemoved(name);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
        return true;
    }

    /**
     * Creates a global graph output
     * @method addOutput
     * @param {String} name
     * @param {String} type
     * @param {*} value
     */
    addOutput(name: string, type: string, value: unknown): void {
        this.getOutputSlots()[name] = { name, type, value };
        this._version++;

        if (this.onOutputAdded) {
            this.onOutputAdded(name, type);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
    }

    /**
     * Assign a data to the global output
     * @method setOutputData
     * @param {String} name
     * @param {String} value
     */
    setOutputData(name: string, value: unknown): void {
        const output = this.getOutputSlots()[name];
        if (!output) {
            return;
        }
        output.value = value;
    }

    /**
     * Returns the current value of a global graph output
     * @method getOutputData
     * @param {String} name
     * @return {*} the data
     */
    getOutputData<T = unknown>(name: string): T | null {
        const output = this.getOutputSlots()[name];
        if (!output) {
            return null;
        }
        return output.value as T;
    }

    /**
     * Renames a global graph output
     * @method renameOutput
     * @param {String} old_name
     * @param {String} new_name
     */
    renameOutput(old_name: string, name: string): false | undefined {
        const outputs = this.getOutputSlots();

        if (!outputs[old_name]) {
            return false;
        }

        if (outputs[name]) {
            console.error("there is already one output with that name");
            return false;
        }

        outputs[name] = outputs[old_name];
        delete outputs[old_name];
        this._version++;

        if (this.onOutputRenamed) {
            this.onOutputRenamed(old_name, name);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
        return;
    }

    /**
     * Changes the type of a global graph output
     * @method changeOutputType
     * @param {String} name
     * @param {String} type
     */
    changeOutputType(name: string, type: string): false | undefined {
        const outputs = this.getOutputSlots();
        if (!outputs[name]) {
            return false;
        }

        if (
            outputs[name].type &&
            String(outputs[name].type).toLowerCase() == String(type).toLowerCase()
        ) {
            return;
        }

        outputs[name].type = type;
        this._version++;
        if (this.onOutputTypeChanged) {
            this.onOutputTypeChanged(name, type);
        }
        return;
    }

    /**
     * Removes a global graph output
     * @method removeOutput
     * @param {String} name
     */
    removeOutput(name: string): boolean {
        const outputs = this.getOutputSlots();
        if (!outputs[name]) {
            return false;
        }
        delete outputs[name];
        this._version++;

        if (this.onOutputRemoved) {
            this.onOutputRemoved(name);
        }

        if (this.onInputsOutputsChange) {
            this.onInputsOutputsChange();
        }
        return true;
    }

    triggerInput(name: string, value: unknown): void {
        const nodes = this.findNodesByTitle(name) as unknown as GraphNodeEventLike[];
        for (let i = 0; i < nodes.length; ++i) {
            nodes[i].onTrigger(value);
        }
    }

    setCallback(name: string, func: (...args: unknown[]) => unknown): void {
        const nodes = this.findNodesByTitle(name) as unknown as GraphNodeEventLike[];
        for (let i = 0; i < nodes.length; ++i) {
            nodes[i].setTrigger(func);
        }
    }

    // used for undo, called before any change is made to the graph
    beforeChange(info?: unknown): void {
        if (this.onBeforeChange) {
            this.onBeforeChange(this, info as GraphNodeEventLike | undefined);
        }
        this.sendActionToCanvas("onBeforeChange", this);
    }

    // used to resend actions, called after any change is made to the graph
    afterChange(info?: unknown): void {
        if (this.onAfterChange) {
            this.onAfterChange(this, info as GraphNodeEventLike | undefined);
        }
        this.sendActionToCanvas("onAfterChange", this);
    }

    connectionChange(node: GraphNodeEventLike, _link_info?: unknown): void {
        this.updateExecutionOrder();
        if (this.onConnectionChange) {
            this.onConnectionChange(node);
        }
        this._version++;
        this.sendActionToCanvas("onConnectionChange");
    }

    /**
     * returns if the graph is in live mode
     * @method isLive
     */
    isLive(): boolean {
        const canvasList = this.getCanvasList();
        if (!canvasList) {
            return false;
        }

        for (let i = 0; i < canvasList.length; ++i) {
            const canvas = canvasList[i];
            if (canvas.live_mode) {
                return true;
            }
        }
        return false;
    }

    /**
     * clears the triggered slot animation in all links (stop visual animation)
     * @method clearTriggeredSlots
     */
    clearTriggeredSlots(): void {
        for (const i in this.links) {
            const linkInfo = this.links[i] as GraphLinkEventLike | undefined;
            if (!linkInfo) {
                continue;
            }
            if (linkInfo._last_time) {
                linkInfo._last_time = 0;
            }
        }
    }

    /* Called when something visually changed (not the graph!) */
    change(): void {
        if (resolveIOEventsHost(this).debug) {
            console.log("Graph changed");
        }
        this.sendActionToCanvas("setDirty", [true, true]);
        if (this.on_change) {
            this.on_change(this);
        }
    }

    setDirtyCanvas(fg: boolean, bg?: boolean): void {
        this.sendActionToCanvas("setDirty", [fg, bg]);
    }
}
