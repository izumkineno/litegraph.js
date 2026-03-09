import { LGraphNode } from "./LGraphNode.state";
interface TriggerOptions {
    action_call?: string;
    [key: string]: unknown;
}
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
    onAction?: (action: string | undefined, param?: unknown, options?: TriggerOptions, action_slot?: number, source_slot?: number) => void;
    doExecute?: (param?: unknown, options?: TriggerOptions) => void;
    actionDo?: (action: string | undefined, param?: unknown, options?: TriggerOptions, action_slot?: number) => void;
    updateOutputData?: (slot: number) => void;
    _waiting_actions?: Array<[
        string | undefined,
        unknown,
        TriggerOptions,
        number,
        number?
    ]>;
}
/**
 * LGraphNode data-channel and execution methods.
 * Source: `setOutputData/getInputData/doExecute/actionDo/trigger/triggerSlot/clearTriggeredSlot`.
 */
export declare class LGraphNodeExecution extends LGraphNode {
    exec_version?: number;
    action_call?: string;
    execute_triggered?: number;
    action_triggered?: number;
    _waiting_actions?: Array<[
        string | undefined,
        unknown,
        TriggerOptions,
        number,
        number?
    ]>;
    onExecute?: (param?: unknown, options?: TriggerOptions) => void;
    onAction?: (action: string | undefined, param?: unknown, options?: TriggerOptions, action_slot?: number, source_slot?: number) => void;
    onAfterExecuteNode?: (param?: unknown, options?: TriggerOptions) => void;
    updateOutputData?: (slot: number) => void;
    private getExecutionGraph;
    /**
     * sets the output data
     * @method setOutputData
     * @param {number} slot
     * @param {*} data
     */
    setOutputData(slot: number, data: unknown): void;
    /**
     * sets the output data type, useful when you want to be able to overwrite the data type
     * @method setOutputDataType
     * @param {number} slot
     * @param {String} datatype
     */
    setOutputDataType(slot: number, type: string): void;
    /**
     * Retrieves the input data (data traveling through the connection) from one slot
     * @method getInputData
     * @param {number} slot
     * @param {boolean} force_update if set to true it will force the connected node of this slot to output data into this link
     * @return {*} data or if it is not connected returns undefined
     */
    getInputData<T = unknown>(slot: number, force_update?: boolean): T | null | undefined;
    /**
     * Retrieves the input data type (in case this supports multiple input types)
     * @method getInputDataType
     * @param {number} slot
     * @return {String} datatype in string format
     */
    getInputDataType(slot: number): string | number | null;
    /**
     * Retrieves the input data from one slot using its name instead of slot number
     * @method getInputDataByName
     * @param {String} slot_name
     * @param {boolean} force_update if set to true it will force the connected node of this slot to output data into this link
     * @return {*} data or if it is not connected returns null
     */
    getInputDataByName<T = unknown>(slot_name: string, force_update?: boolean): T | null | undefined;
    /**
     * tells you if there is a connection in one input slot
     * @method isInputConnected
     * @param {number} slot
     * @return {boolean}
     */
    isInputConnected(slot: number): boolean;
    /**
     * tells you info about an input connection (which node, type, etc)
     * @method getInputInfo
     * @param {number} slot
     * @return {Object} object or null { link: id, name: string, type: string or 0 }
     */
    getInputInfo(slot: number): NodeInputExecutionLike | null;
    /**
     * Returns the link info in the connection of an input slot
     * @method getInputLink
     * @param {number} slot
     * @return {LLink} object or null
     */
    getInputLink(slot: number): GraphLinkExecutionLike | null;
    /**
     * returns the node connected in the input slot
     * @method getInputNode
     * @param {number} slot
     * @return {LGraphNode} node or null
     */
    getInputNode(slot: number): LGraphNodeExecutionLike | null;
    /**
     * returns the value of an input with this name, otherwise checks if there is a property with that name
     * @method getInputOrProperty
     * @param {string} name
     * @return {*} value
     */
    getInputOrProperty<T = unknown>(name: string): T | null | undefined;
    /**
     * tells you the last output data that went in that slot
     * @method getOutputData
     * @param {number} slot
     * @return {Object}  object or null
     */
    getOutputData<T = unknown>(slot: number): T | null;
    /**
     * tells you info about an output connection (which node, type, etc)
     * @method getOutputInfo
     * @param {number} slot
     * @return {Object}  object or null { name: string, type: string, links: [ ids of links in number ] }
     */
    getOutputInfo(slot: number): NodeOutputExecutionLike | null;
    /**
     * tells you if there is a connection in one output slot
     * @method isOutputConnected
     * @param {number} slot
     * @return {boolean}
     */
    isOutputConnected(slot: number): boolean;
    /**
     * tells you if there is any connection in the output slots
     * @method isAnyOutputConnected
     * @return {boolean}
     */
    isAnyOutputConnected(): boolean;
    /**
     * retrieves all the nodes connected to this output slot
     * @method getOutputNodes
     * @param {number} slot
     * @return {array}
     */
    getOutputNodes(slot: number): LGraphNodeExecutionLike[] | null;
    /**
     * Triggers the execution of actions that were deferred when the action was triggered
     * @method executePendingActions
     */
    executePendingActions(): void;
    /**
     * Triggers the node code execution, place a boolean/counter to mark the node as being executed
     * @method doExecute
     * @param {*} param
     * @param {*} options
     */
    doExecute(param?: unknown, options?: TriggerOptions): void;
    /**
     * Triggers an action, wrapped by logics to control execution flow
     * @method actionDo
     * @param {String} action name
     * @param {*} param
     */
    actionDo(action: string | undefined, param?: unknown, options?: TriggerOptions, action_slot?: number): void;
    /**
     * Triggers an event in this node, this will trigger any output with the same name
     * @method trigger
     * @param {String} event name ( "on_play", ... ) if action is equivalent to false then the event is send to all
     * @param {*} param
     */
    trigger(action?: string, param?: unknown, options?: TriggerOptions): void;
    /**
     * Triggers a slot event in this node: cycle output slots and launch execute/action on connected nodes
     * @method triggerSlot
     * @param {Number} slot the index of the output slot
     * @param {*} param
     * @param {Number} link_id [optional] in case you want to trigger and specific output link in a slot
     */
    triggerSlot(slot: number, param?: unknown, link_id?: number | null, options?: TriggerOptions): void;
    /**
     * clears the trigger slot animation
     * @method clearTriggeredSlot
     * @param {Number} slot the index of the output slot
     * @param {Number} link_id [optional] in case you want to trigger and specific output link in a slot
     */
    clearTriggeredSlot(slot: number, link_id?: number | null): void;
}
export {};
