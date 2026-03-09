import type { GraphCanvasConstructorPort, GraphCanvasLifecyclePort } from "../contracts/canvas";
import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import type { LGraphNodeCanvasCollab as LGraphNode } from "./LGraphNode.canvas-collab";
type LGraphNodeLifecycleIdentity = Pick<LGraphNode, "id">;
export interface LGraphNodeLifecycleLike extends LGraphNodeLifecycleIdentity {
    onRemoved?: () => void;
}
interface LGraphCanvasLifecycleGraphLike {
    detachCanvas: (canvas: LGraphCanvasLifecycleLike) => void;
}
export interface LGraphCanvasLifecycleLike extends GraphCanvasLifecyclePort<LGraphCanvasLifecycleGraphLike> {
    constructor: unknown;
}
export interface LiteGraphLifecycleHost extends Pick<LiteGraphConstantsShape, "debug"> {
    getTime: () => number;
    LGraphCanvas?: GraphCanvasConstructorPort<LGraphCanvasLifecycleLike>;
}
/**
 * LGraph is the class that contain a full graph. We instantiate one and add nodes to it, and then we can run the execution loop.
 * supported callbacks:
 *   + onNodeAdded: when a new node is added to the graph
 *   + onNodeRemoved: when a node inside this graph is removed
 *   + onNodeConnectionChange: some connection has changed in the graph (connected or disconnected)
 *
 * @class LGraph
 * @constructor
 * @param {Object} o data from previous serialization [optional]
 */
export declare class LGraph {
    static supported_types: string[];
    static STATUS_STOPPED: 1;
    static STATUS_RUNNING: 2;
    static liteGraph: LiteGraphLifecycleHost;
    supported_types?: string[];
    list_of_graphcanvas: LGraphCanvasLifecycleLike[] | null;
    status: typeof LGraph.STATUS_RUNNING | typeof LGraph.STATUS_STOPPED;
    last_node_id: number;
    last_link_id: number;
    protected _version: number;
    protected _nodes: LGraphNodeLifecycleLike[];
    protected _nodes_by_id: Record<number, LGraphNodeLifecycleLike>;
    protected _nodes_in_order: LGraphNodeLifecycleLike[];
    protected _nodes_executable: LGraphNodeLifecycleLike[] | null;
    protected _groups: unknown[];
    links: Record<number, unknown>;
    iteration: number;
    config: Record<string, unknown>;
    vars: Record<string, unknown>;
    extra: Record<string, unknown>;
    globaltime: number;
    runningtime: number;
    fixedtime: number;
    fixedtime_lapse: number;
    elapsed_time: number;
    last_update_time: number;
    starttime: number;
    catch_errors: boolean;
    nodes_executing: unknown[];
    nodes_actioning: unknown[];
    nodes_executedAction: unknown[];
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    execution_timer_id: number | ReturnType<typeof setInterval> | null;
    onPlayEvent?: () => void;
    onStopEvent?: () => void;
    onBeforeStep?: () => void;
    onAfterStep?: () => void;
    constructor(o?: object);
    getSupportedTypes(): string[];
    /**
     * Removes all nodes from this graph
     * @method clear
     */
    clear(): void;
    /**
     * Attach Canvas to this graph
     * @method attachCanvas
     */
    attachCanvas(graphcanvas: LGraphCanvasLifecycleLike): void;
    /**
     * Detach Canvas from this graph
     * @method detachCanvas
     */
    detachCanvas(graphcanvas: LGraphCanvasLifecycleLike): void;
    /**
     * Starts running this graph every interval milliseconds.
     * @method start
     * @param {number} interval amount of milliseconds between executions, if 0 then it renders to the monitor refresh rate
     */
    start(interval?: number): void;
    /**
     * Stops the execution loop of the graph
     * @method stop execution
     */
    stop(): void;
    /**
     * Returns the amount of time the graph has been running in milliseconds
     * @method getTime
     * @return {number} number of milliseconds the graph has been running
     */
    getTime(): number;
    /**
     * Returns the amount of time accumulated using the fixedtime_lapse var. This is used in context where the time increments should be constant
     * @method getFixedTime
     * @return {number} number of milliseconds the graph has been running
     */
    getFixedTime(): number;
    /**
     * Returns the amount of time it took to compute the latest iteration. Take into account that this number could be not correct
     * if the nodes are using graphical actions
     * @method getElapsedTime
     * @return {number} number of milliseconds it took the last cycle
     */
    getElapsedTime(): number;
    configure(_data: object, _keep_old?: boolean): boolean | undefined;
    runStep(_num?: number, _do_not_catch_errors?: boolean): void;
    change(): void;
    sendActionToCanvas(_action: string, ..._params: unknown[]): void;
    sendEventToAllNodes(_eventname: string, _params?: unknown[], _mode?: unknown): void;
}
export {};
