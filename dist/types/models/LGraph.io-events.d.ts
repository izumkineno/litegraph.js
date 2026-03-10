import type { LGraphNodeCanvasCollab as LGraphNode } from "./LGraphNode.canvas-collab";
import { LGraphStructure } from "./LGraph.structure";
type GraphNodeEventBase = Pick<LGraphNode, "id" | "mode">;
interface GraphNodeEventLike extends GraphNodeEventBase {
    constructor: Function;
    properties: {
        name?: string;
    };
    onTrigger: (value: unknown) => void;
    setTrigger: (func: (...args: unknown[]) => unknown) => void;
    actionDo: (action: string, param?: unknown, options?: unknown) => void;
    sendEventToAllNodes: (eventname: string, params?: unknown, mode?: number) => void;
    [key: string]: unknown;
}
/**
 * LGraph graph-level IO and event methods.
 * Source: `sendEventToAllNodes/onAction/trigger/addInput/addOutput/triggerInput/connectionChange`.
 */
export declare class LGraphIOEvents extends LGraphStructure {
    onTrigger?: (action: string, param: unknown) => void;
    onInputAdded?: (name: string, type: string | number) => void;
    onInputRemoved?: (name: string) => void;
    onInputRenamed?: (old_name: string, name: string) => void;
    onInputTypeChanged?: (name: string, type: string | number) => void;
    onOutputAdded?: (name: string, type: string | number) => void;
    onOutputRemoved?: (name: string) => void;
    onOutputRenamed?: (old_name: string, name: string) => void;
    onOutputTypeChanged?: (name: string, type: string | number) => void;
    onInputsOutputsChange?: () => void;
    onBeforeChange?: (graph: LGraphIOEvents, info?: GraphNodeEventLike) => void;
    onAfterChange?: (graph: LGraphIOEvents, info?: GraphNodeEventLike) => void;
    onConnectionChange?: (node: GraphNodeEventLike) => void;
    on_change?: (graph: LGraphIOEvents) => void;
    private _input_nodes;
    private batchedAfterChangeInfo;
    private hasBatchedAfterChange;
    private batchedBeforeChangeEmitted;
    private getNodesInEventOrder;
    private getInputSlots;
    private getOutputSlots;
    private getCanvasList;
    /**
     * Sends an event to all the nodes, useful to trigger stuff
     * @method sendEventToAllNodes
     * @param {String} eventname the name of the event (function to be called)
     * @param {Array} params parameters in array format
     */
    sendEventToAllNodes(eventname: string, params?: unknown, mode?: number): void;
    sendActionToCanvas(action: string, params?: unknown): void;
    __litegraphBeginSceneBatch(): void;
    onAction(action: string, param?: unknown, options?: unknown): void;
    trigger(action: string, param?: unknown): void;
    /**
     * Tell this graph it has a global graph input of this type
     * @method addGlobalInput
     * @param {String} name
     * @param {String} type
     * @param {*} value [optional]
     */
    addInput(name: string, type: string | number, value?: unknown): void;
    /**
     * Assign a data to the global graph input
     * @method setGlobalInputData
     * @param {String} name
     * @param {*} data
     */
    setInputData(name: string, data: unknown): void;
    /**
     * Returns the current value of a global graph input
     * @method getInputData
     * @param {String} name
     * @return {*} the data
     */
    getInputData<T = unknown>(name: string): T | null;
    /**
     * Changes the name of a global graph input
     * @method renameInput
     * @param {String} old_name
     * @param {String} new_name
     */
    renameInput(old_name: string, name: string): false | undefined;
    /**
     * Changes the type of a global graph input
     * @method changeInputType
     * @param {String} name
     * @param {String} type
     */
    changeInputType(name: string, type: string | number): false | undefined;
    /**
     * Removes a global graph input
     * @method removeInput
     * @param {String} name
     * @param {String} type
     */
    removeInput(name: string): boolean;
    /**
     * Creates a global graph output
     * @method addOutput
     * @param {String} name
     * @param {String} type
     * @param {*} value
     */
    addOutput(name: string, type: string | number, value: unknown): void;
    /**
     * Assign a data to the global output
     * @method setOutputData
     * @param {String} name
     * @param {String} value
     */
    setOutputData(name: string, value: unknown): void;
    /**
     * Returns the current value of a global graph output
     * @method getOutputData
     * @param {String} name
     * @return {*} the data
     */
    getOutputData<T = unknown>(name: string): T | null;
    /**
     * Renames a global graph output
     * @method renameOutput
     * @param {String} old_name
     * @param {String} new_name
     */
    renameOutput(old_name: string, name: string): false | undefined;
    /**
     * Changes the type of a global graph output
     * @method changeOutputType
     * @param {String} name
     * @param {String} type
     */
    changeOutputType(name: string, type: string | number): false | undefined;
    /**
     * Removes a global graph output
     * @method removeOutput
     * @param {String} name
     */
    removeOutput(name: string): boolean;
    triggerInput(name: string, value: unknown): void;
    setCallback(name: string, func: (...args: unknown[]) => unknown): void;
    beforeChange(info?: unknown): void;
    afterChange(info?: unknown): void;
    connectionChange(node: GraphNodeEventLike, _link_info?: unknown): void;
    /**
     * returns if the graph is in live mode
     * @method isLive
     */
    isLive(): boolean;
    /**
     * clears the triggered slot animation in all links (stop visual animation)
     * @method clearTriggeredSlots
     */
    clearTriggeredSlots(): void;
    change(): void;
    setDirtyCanvas(fg: boolean, bg?: boolean): void;
    protected flushInternalSceneBatch(): void;
    private dispatchBeforeChange;
    private dispatchAfterChange;
    private dispatchChange;
}
export {};
