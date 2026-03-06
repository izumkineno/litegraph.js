import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import { createClassHostResolver } from "../core/host-resolver";
import type { LGraphPersistence as LGraph } from "./LGraph.persistence";
import { LGraphNode } from "./LGraphNode.state";

interface TriggerOptions {
    action_call?: string;
    [key: string]: unknown;
}

interface LiteGraphNodeExecutionHost
    extends Pick<
        LiteGraphConstantsShape,
        "EVENT" | "ACTION" | "ON_TRIGGER" | "use_deferred_actions"
    > {
    getTime: () => number;
}

const defaultExecutionHost: LiteGraphNodeExecutionHost = {
    EVENT: -1,
    ACTION: -1,
    ON_TRIGGER: 3,
    use_deferred_actions: true,
    getTime: () => Date.now(),
};

const resolveNodeExecutionHost = createClassHostResolver(defaultExecutionHost, {
    cacheKey: "LGraphNode.execution",
    fallbackOwners: [() => LGraphNode],
});

interface NodeInputExecutionLike {
    name?: string;
    link: number | null;
}

interface NodeOutputExecutionLike {
    name?: string;
    type?: string | number;
    links: number[] | null;
    _data?: unknown;
}

interface GraphLinkExecutionLike {
    origin_id: number | string;
    origin_slot: number;
    target_id: number | string;
    target_slot: number;
    type?: string | number;
    data?: unknown;
    _last_time?: number;
}

interface LGraphNodeExecutionLike {
    id: number | string;
    mode?: number;
    inputs?: NodeInputExecutionLike[];
    outputs?: NodeOutputExecutionLike[];
    properties?: Record<string, unknown>;
    onExecute?: (param?: unknown, options?: TriggerOptions) => void;
    onAction?: (
        action: string | undefined,
        param?: unknown,
        options?: TriggerOptions,
        action_slot?: number,
        source_slot?: number
    ) => void;
    doExecute?: (param?: unknown, options?: TriggerOptions) => void;
    actionDo?: (
        action: string | undefined,
        param?: unknown,
        options?: TriggerOptions,
        action_slot?: number
    ) => void;
    updateOutputData?: (slot: number) => void;
    _waiting_actions?: Array<
        [string | undefined, unknown, TriggerOptions, number, number?]
    >;
}

interface LGraphExecutionStateLike extends Pick<LGraph, "iteration"> {
    links: Record<string, GraphLinkExecutionLike>;
    getNodeById: (id: number | string) => LGraphNodeExecutionLike | null;
    nodes_executing: Record<string, unknown>;
    nodes_actioning: Record<string, unknown>;
    nodes_executedAction: Record<string, unknown>;
    _last_trigger_time?: number;
}

/**
 * LGraphNode data-channel and execution methods.
 * Source: `setOutputData/getInputData/doExecute/actionDo/trigger/triggerSlot/clearTriggeredSlot`.
 */
export class LGraphNodeExecution extends LGraphNode {
    exec_version?: number;
    action_call?: string;
    execute_triggered?: number;
    action_triggered?: number;
    _waiting_actions?: Array<
        [string | undefined, unknown, TriggerOptions, number, number?]
    >;

    onExecute?: (param?: unknown, options?: TriggerOptions) => void;
    onAction?: (
        action: string | undefined,
        param?: unknown,
        options?: TriggerOptions,
        action_slot?: number,
        source_slot?: number
    ) => void;
    onAfterExecuteNode?: (param?: unknown, options?: TriggerOptions) => void;
    updateOutputData?: (slot: number) => void;

    private getExecutionGraph(): LGraphExecutionStateLike | null {
        return (this.graph as unknown as LGraphExecutionStateLike) || null;
    }

    /**
     * sets the output data
     * @method setOutputData
     * @param {number} slot
     * @param {*} data
     */
    setOutputData(slot: number, data: unknown): void {
        if (!this.outputs) {
            return;
        }

        // this maybe slow and a niche case
        // if(slot && slot.constructor === String)
        //  slot = this.findOutputSlot(slot);

        if (slot == -1 || slot >= this.outputs.length) {
            return;
        }

        const output_info = this.outputs[slot] as NodeOutputExecutionLike | undefined;
        if (!output_info) {
            return;
        }

        // store data in the output itself in case we want to debug
        output_info._data = data;

        const graph = this.getExecutionGraph() as LGraphExecutionStateLike;

        // if there are connections, pass the data to the connections
        if (output_info.links) {
            for (let i = 0; i < output_info.links.length; i++) {
                const link_id = output_info.links[i];
                const link = graph.links[String(link_id)];
                if (link) {
                    link.data = data;
                }
            }
        }
    }

    /**
     * sets the output data type, useful when you want to be able to overwrite the data type
     * @method setOutputDataType
     * @param {number} slot
     * @param {String} datatype
     */
    setOutputDataType(slot: number, type: string): void {
        if (!this.outputs) {
            return;
        }
        if (slot == -1 || slot >= this.outputs.length) {
            return;
        }
        const output_info = this.outputs[slot] as NodeOutputExecutionLike | undefined;
        if (!output_info) {
            return;
        }
        // store data in the output itself in case we want to debug
        output_info.type = type;

        const graph = this.getExecutionGraph() as LGraphExecutionStateLike;

        // if there are connections, pass the data to the connections
        if (output_info.links) {
            for (let i = 0; i < output_info.links.length; i++) {
                const link_id = output_info.links[i];
                graph.links[String(link_id)].type = type;
            }
        }
    }

    /**
     * Retrieves the input data (data traveling through the connection) from one slot
     * @method getInputData
     * @param {number} slot
     * @param {boolean} force_update if set to true it will force the connected node of this slot to output data into this link
     * @return {*} data or if it is not connected returns undefined
     */
    getInputData<T = unknown>(slot: number, force_update?: boolean): T | null | undefined {
        if (!this.inputs) {
            return undefined;
        } // undefined;

        const input = this.inputs[slot] as NodeInputExecutionLike | undefined;
        if (!input || slot >= this.inputs.length || input.link == null) {
            return undefined;
        }

        const graph = this.getExecutionGraph() as LGraphExecutionStateLike;

        const link_id = input.link;
        const link = graph.links[String(link_id)];
        if (!link) {
            // bug: weird case but it happens sometimes
            return null;
        }

        if (!force_update) {
            return link.data as T;
        }

        // special case: used to extract data from the incoming connection before the graph has been executed
        const node = graph.getNodeById(link.origin_id);
        if (!node) {
            return link.data as T;
        }

        if (node.updateOutputData) {
            node.updateOutputData(link.origin_slot);
        } else if (node.onExecute) {
            node.onExecute();
        }

        return link.data as T;
    }

    /**
     * Retrieves the input data type (in case this supports multiple input types)
     * @method getInputDataType
     * @param {number} slot
     * @return {String} datatype in string format
     */
    getInputDataType(slot: number): string | number | null {
        if (!this.inputs) {
            return null;
        }

        const input = this.inputs[slot] as NodeInputExecutionLike | undefined;
        if (!input || slot >= this.inputs.length || input.link == null) {
            return null;
        }

        const graph = this.getExecutionGraph() as LGraphExecutionStateLike;

        const link_id = input.link;
        const link = graph.links[String(link_id)];
        if (!link) {
            // bug: weird case but it happens sometimes
            return null;
        }

        const node = graph.getNodeById(link.origin_id);
        if (!node) {
            return link.type || null;
        }
        const outputs = node.outputs as NodeOutputExecutionLike[] | undefined;
        const output_info = outputs ? outputs[link.origin_slot] : null;
        if (output_info) {
            return output_info.type || null;
        }
        return null;
    }

    /**
     * Retrieves the input data from one slot using its name instead of slot number
     * @method getInputDataByName
     * @param {String} slot_name
     * @param {boolean} force_update if set to true it will force the connected node of this slot to output data into this link
     * @return {*} data or if it is not connected returns null
     */
    getInputDataByName<T = unknown>(
        slot_name: string,
        force_update?: boolean
    ): T | null | undefined {
        const withFindInputSlot = this as unknown as {
            findInputSlot: (name: string) => number;
        };
        const slot = withFindInputSlot.findInputSlot(slot_name);
        if (slot == -1) {
            return null;
        }
        return this.getInputData<T>(slot, force_update);
    }

    /**
     * tells you if there is a connection in one input slot
     * @method isInputConnected
     * @param {number} slot
     * @return {boolean}
     */
    isInputConnected(slot: number): boolean {
        if (!this.inputs) {
            return false;
        }
        return slot < this.inputs.length && this.inputs[slot].link != null;
    }

    /**
     * tells you info about an input connection (which node, type, etc)
     * @method getInputInfo
     * @param {number} slot
     * @return {Object} object or null { link: id, name: string, type: string or 0 }
     */
    getInputInfo(slot: number): NodeInputExecutionLike | null {
        if (!this.inputs) {
            return null;
        }
        if (slot < this.inputs.length) {
            return this.inputs[slot];
        }
        return null;
    }

    /**
     * Returns the link info in the connection of an input slot
     * @method getInputLink
     * @param {number} slot
     * @return {LLink} object or null
     */
    getInputLink(slot: number): GraphLinkExecutionLike | null {
        if (!this.inputs) {
            return null;
        }
        if (slot < this.inputs.length) {
            const slot_info = this.inputs[slot];
            const graph = this.getExecutionGraph() as LGraphExecutionStateLike;
            return graph.links[String(slot_info.link)] || null;
        }
        return null;
    }

    /**
     * returns the node connected in the input slot
     * @method getInputNode
     * @param {number} slot
     * @return {LGraphNode} node or null
     */
    getInputNode(slot: number): LGraphNodeExecutionLike | null {
        if (!this.inputs) {
            return null;
        }
        if (slot >= this.inputs.length) {
            return null;
        }
        const input = this.inputs[slot];
        if (!input || input.link === null) {
            return null;
        }
        const graph = this.getExecutionGraph() as LGraphExecutionStateLike;
        const link_info = graph.links[String(input.link)];
        if (!link_info) {
            return null;
        }
        return graph.getNodeById(link_info.origin_id);
    }

    /**
     * returns the value of an input with this name, otherwise checks if there is a property with that name
     * @method getInputOrProperty
     * @param {string} name
     * @return {*} value
     */
    getInputOrProperty<T = unknown>(name: string): T | null | undefined {
        const properties = (this as unknown as { properties?: Record<string, unknown> })
            .properties;
        if (!this.inputs || !this.inputs.length) {
            return properties ? (properties[name] as T) : null;
        }

        const graph = this.getExecutionGraph() as LGraphExecutionStateLike;
        for (let i = 0, l = this.inputs.length; i < l; ++i) {
            const input_info = this.inputs[i];
            if (name == input_info.name && input_info.link != null) {
                const link = graph.links[String(input_info.link)];
                if (link) {
                    return link.data as T;
                }
            }
        }
        return properties ? (properties[name] as T) : undefined;
    }

    /**
     * tells you the last output data that went in that slot
     * @method getOutputData
     * @param {number} slot
     * @return {Object}  object or null
     */
    getOutputData<T = unknown>(slot: number): T | null {
        if (!this.outputs) {
            return null;
        }
        if (slot >= this.outputs.length) {
            return null;
        }

        const info = this.outputs[slot];
        return (info._data as T) ?? null;
    }

    /**
     * tells you info about an output connection (which node, type, etc)
     * @method getOutputInfo
     * @param {number} slot
     * @return {Object}  object or null { name: string, type: string, links: [ ids of links in number ] }
     */
    getOutputInfo(slot: number): NodeOutputExecutionLike | null {
        if (!this.outputs) {
            return null;
        }
        if (slot < this.outputs.length) {
            return this.outputs[slot];
        }
        return null;
    }

    /**
     * tells you if there is a connection in one output slot
     * @method isOutputConnected
     * @param {number} slot
     * @return {boolean}
     */
    isOutputConnected(slot: number): boolean {
        if (!this.outputs) {
            return false;
        }
        return Boolean(
            slot < this.outputs.length &&
                this.outputs[slot].links &&
                this.outputs[slot].links.length
        );
    }

    /**
     * tells you if there is any connection in the output slots
     * @method isAnyOutputConnected
     * @return {boolean}
     */
    isAnyOutputConnected(): boolean {
        if (!this.outputs) {
            return false;
        }
        for (let i = 0; i < this.outputs.length; ++i) {
            const links = this.outputs[i]?.links;
            if (links && links.length) {
                return true;
            }
        }
        return false;
    }

    /**
     * retrieves all the nodes connected to this output slot
     * @method getOutputNodes
     * @param {number} slot
     * @return {array}
     */
    getOutputNodes(slot: number): LGraphNodeExecutionLike[] | null {
        if (!this.outputs || this.outputs.length == 0) {
            return null;
        }

        if (slot >= this.outputs.length) {
            return null;
        }

        const output = this.outputs[slot];
        if (!output.links || output.links.length == 0) {
            return null;
        }

        const graph = this.getExecutionGraph() as LGraphExecutionStateLike;
        const result: LGraphNodeExecutionLike[] = [];
        for (let i = 0; i < output.links.length; i++) {
            const link_id = output.links[i];
            const link = graph.links[String(link_id)];
            if (link) {
                const target_node = graph.getNodeById(link.target_id);
                if (target_node) {
                    result.push(target_node);
                }
            }
        }
        return result;
    }

    /**
     * Triggers the execution of actions that were deferred when the action was triggered
     * @method executePendingActions
     */
    executePendingActions(): void {
        if (!this._waiting_actions || !this._waiting_actions.length) {
            return;
        }
        for (let i = 0; i < this._waiting_actions.length; ++i) {
            const p = this._waiting_actions[i];
            (this.onAction as NonNullable<LGraphNodeExecution["onAction"]>)(
                p[0],
                p[1],
                p[2],
                p[3],
                p[4]
            );
        }
        this._waiting_actions.length = 0;
    }

    /**
     * Triggers the node code execution, place a boolean/counter to mark the node as being executed
     * @method doExecute
     * @param {*} param
     * @param {*} options
     */
    doExecute(param?: unknown, options?: TriggerOptions): void {
        const runtimeOptions = options || {};
        const graph = this.getExecutionGraph() as LGraphExecutionStateLike;

        if (this.onExecute) {
            // enable this to give the event an ID
            if (!runtimeOptions.action_call) {
                runtimeOptions.action_call =
                    this.id + "_exec_" + Math.floor(Math.random() * 9999);
            }

            graph.nodes_executing[String(this.id)] = true; // .push(this.id);

            this.onExecute(param, runtimeOptions);

            graph.nodes_executing[String(this.id)] = false; // .pop();

            // save execution/action ref
            this.exec_version = graph.iteration;
            if (runtimeOptions.action_call) {
                this.action_call = runtimeOptions.action_call; // if (param)
                graph.nodes_executedAction[String(this.id)] =
                    runtimeOptions.action_call;
            }
        }

        // the nFrames it will be used (-- each step), means "how old" is the event
        this.execute_triggered = 2;
        if (this.onAfterExecuteNode) {
            this.onAfterExecuteNode(param, runtimeOptions); // callback
        }
    }

    /**
     * Triggers an action, wrapped by logics to control execution flow
     * @method actionDo
     * @param {String} action name
     * @param {*} param
     */
    actionDo(
        action: string | undefined,
        param?: unknown,
        options?: TriggerOptions,
        action_slot?: number
    ): void {
        const runtimeOptions = options || {};
        const graph = this.getExecutionGraph() as LGraphExecutionStateLike;

        if (this.onAction) {
            // enable this to give the event an ID
            if (!runtimeOptions.action_call) {
                runtimeOptions.action_call =
                    this.id +
                    "_" +
                    (action ? action : "action") +
                    "_" +
                    Math.floor(Math.random() * 9999);
            }

            graph.nodes_actioning[String(this.id)] = action
                ? action
                : "actioning"; // .push(this.id);

            this.onAction(action, param, runtimeOptions, action_slot);

            graph.nodes_actioning[String(this.id)] = false; // .pop();

            // save execution/action ref
            if (runtimeOptions.action_call) {
                this.action_call = runtimeOptions.action_call; // if (param)
                graph.nodes_executedAction[String(this.id)] =
                    runtimeOptions.action_call;
            }
        }

        // the nFrames it will be used (-- each step), means "how old" is the event
        this.action_triggered = 2;
        if (this.onAfterExecuteNode) {
            this.onAfterExecuteNode(param, runtimeOptions);
        }
    }

    /**
     * Triggers an event in this node, this will trigger any output with the same name
     * @method trigger
     * @param {String} event name ( "on_play", ... ) if action is equivalent to false then the event is send to all
     * @param {*} param
     */
    trigger(
        action?: string,
        param?: unknown,
        options?: TriggerOptions
    ): void {
        if (!this.outputs || !this.outputs.length) {
            return;
        }

        const host = resolveNodeExecutionHost(this);
        const graph = this.getExecutionGraph();
        if (graph) {
            graph._last_trigger_time = host.getTime();
        }

        for (let i = 0; i < this.outputs.length; ++i) {
            const output = this.outputs[i] as NodeOutputExecutionLike | undefined;
            if (
                !output ||
                output.type !== host.EVENT ||
                (action && output.name != action)
            ) {
                continue;
            }
            this.triggerSlot(i, param, null, options);
        }
    }

    /**
     * Triggers a slot event in this node: cycle output slots and launch execute/action on connected nodes
     * @method triggerSlot
     * @param {Number} slot the index of the output slot
     * @param {*} param
     * @param {Number} link_id [optional] in case you want to trigger and specific output link in a slot
     */
    triggerSlot(
        slot: number,
        param?: unknown,
        link_id?: number | null,
        options?: TriggerOptions
    ): void {
        const runtimeOptions = options || {};
        if (!this.outputs) {
            return;
        }

        if (slot == null) {
            console.error("slot must be a number");
            return;
        }

        if ((slot as unknown as { constructor?: unknown }).constructor !== Number) {
            console.warn(
                "slot must be a number, use node.trigger('name') if you want to use a string"
            );
        }

        const output = this.outputs[slot] as NodeOutputExecutionLike | undefined;
        if (!output) {
            return;
        }

        const links = output.links;
        if (!links || !links.length) {
            return;
        }

        const host = resolveNodeExecutionHost(this);
        const graph = this.getExecutionGraph() as LGraphExecutionStateLike | null;
        if (!graph) {
            return;
        }
        graph._last_trigger_time = host.getTime();

        // for every link attached here
        for (let k = 0; k < links.length; ++k) {
            const id = links[k];
            if (link_id != null && link_id != id) {
                // to skip links
                continue;
            }
            const link_info = graph.links[String(links[k])];
            if (!link_info) {
                // not connected
                continue;
            }
            link_info._last_time = host.getTime();
            const node = graph.getNodeById(link_info.target_id);
            if (!node) {
                // node not found?
                continue;
            }

            if (node.mode === host.ON_TRIGGER) {
                // generate unique trigger ID if not present
                if (!runtimeOptions.action_call) {
                    runtimeOptions.action_call =
                        this.id + "_trigg_" + Math.floor(Math.random() * 9999);
                }
                if (node.onExecute) {
                    // -- wrapping node.onExecute(param); --
                    (node.doExecute as NonNullable<LGraphNodeExecutionLike["doExecute"]>)(
                        param,
                        runtimeOptions
                    );
                }
            } else if (node.onAction) {
                // generate unique action ID if not present
                if (!runtimeOptions.action_call) {
                    runtimeOptions.action_call =
                        this.id + "_act_" + Math.floor(Math.random() * 9999);
                }
                // pass the action name
                const target_connection =
                    node.inputs![link_info.target_slot];

                // instead of executing them now, it will be executed in the next graph loop, to ensure data flow
                if (host.use_deferred_actions && node.onExecute) {
                    if (!node._waiting_actions) {
                        node._waiting_actions = [];
                    }
                    node._waiting_actions.push([
                        target_connection.name,
                        param,
                        runtimeOptions,
                        link_info.target_slot,
                    ]);
                } else {
                    // wrap node.onAction(target_connection.name, param);
                    (
                        node.actionDo as NonNullable<LGraphNodeExecutionLike["actionDo"]>
                    )(
                        target_connection.name,
                        param,
                        runtimeOptions,
                        link_info.target_slot
                    );
                }
            }
        }
    }

    /**
     * clears the trigger slot animation
     * @method clearTriggeredSlot
     * @param {Number} slot the index of the output slot
     * @param {Number} link_id [optional] in case you want to trigger and specific output link in a slot
     */
    clearTriggeredSlot(slot: number, link_id?: number | null): void {
        if (!this.outputs) {
            return;
        }

        const output = this.outputs[slot] as NodeOutputExecutionLike | undefined;
        if (!output) {
            return;
        }

        const links = output.links;
        if (!links || !links.length) {
            return;
        }

        const graph = this.getExecutionGraph() as LGraphExecutionStateLike;

        // for every link attached here
        for (let k = 0; k < links.length; ++k) {
            const id = links[k];
            if (link_id != null && link_id != id) {
                // to skip links
                continue;
            }
            const link_info = graph.links[String(links[k])];
            if (!link_info) {
                // not connected
                continue;
            }
            link_info._last_time = 0;
        }
    }
}
