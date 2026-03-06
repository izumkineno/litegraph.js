import type {
    GraphCanvasConstructorPort,
    GraphCanvasLifecyclePort,
} from "../contracts/canvas";
import { createClassHostResolver } from "../core/host-resolver";
import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import type { LGraphNodeCanvasCollab as LGraphNode } from "./LGraphNode.canvas-collab";

type LGraphNodeLifecycleIdentity = Pick<LGraphNode, "id">;

export interface LGraphNodeLifecycleLike extends LGraphNodeLifecycleIdentity {
    onRemoved?: () => void;
}

interface LGraphCanvasLifecycleGraphLike {
    detachCanvas: (canvas: LGraphCanvasLifecycleLike) => void;
}

export interface LGraphCanvasLifecycleLike
    extends GraphCanvasLifecyclePort<LGraphCanvasLifecycleGraphLike> {
    constructor: unknown;
}

export interface LiteGraphLifecycleHost
    extends Pick<LiteGraphConstantsShape, "debug"> {
    getTime: () => number;
    LGraphCanvas?: GraphCanvasConstructorPort<LGraphCanvasLifecycleLike>;
}

const defaultLiteGraphLifecycleHost: LiteGraphLifecycleHost = {
    debug: false,
    getTime: () => Date.now(),
};

const resolveLifecycleHost = createClassHostResolver(defaultLiteGraphLifecycleHost, {
    cacheKey: "LGraph.lifecycle",
    fallbackOwners: [() => LGraph],
});

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
export class LGraph {
    static supported_types = ["number", "string", "boolean"];
    static STATUS_STOPPED = 1 as const;
    static STATUS_RUNNING = 2 as const;
    static liteGraph: LiteGraphLifecycleHost = defaultLiteGraphLifecycleHost;

    // used to know which types of connections support this graph (some graphs do not allow certain types)
    supported_types?: string[];

    list_of_graphcanvas: LGraphCanvasLifecycleLike[] | null = null;
    status: typeof LGraph.STATUS_RUNNING | typeof LGraph.STATUS_STOPPED =
        LGraph.STATUS_STOPPED;

    last_node_id = 0;
    last_link_id = 0;
    protected _version = -1; // used to detect changes

    protected _nodes: LGraphNodeLifecycleLike[] = [];
    protected _nodes_by_id: Record<number, LGraphNodeLifecycleLike> = {};
    protected _nodes_in_order: LGraphNodeLifecycleLike[] = [];
    protected _nodes_executable: LGraphNodeLifecycleLike[] | null = null;
    protected _groups: unknown[] = [];

    links: Record<number, unknown> = {}; // container with all the links
    iteration = 0;

    // custom data
    config: Record<string, unknown> = {};
    vars: Record<string, unknown> = {};
    extra: Record<string, unknown> = {};

    // timing
    globaltime = 0;
    runningtime = 0;
    fixedtime = 0;
    fixedtime_lapse = 0.01;
    elapsed_time = 0.01;
    last_update_time = 0;
    starttime = 0;

    catch_errors = true;

    nodes_executing: unknown[] = [];
    nodes_actioning: unknown[] = [];
    nodes_executedAction: unknown[] = [];

    // subgraph_data
    inputs: Record<string, unknown> = {};
    outputs: Record<string, unknown> = {};

    execution_timer_id: number | ReturnType<typeof setInterval> | null = null;

    onPlayEvent?: () => void;
    onStopEvent?: () => void;
    onBeforeStep?: () => void;
    onAfterStep?: () => void;

    constructor(o?: object) {
        if (resolveLifecycleHost(this).debug) {
            console.log("Graph created");
        }
        this.list_of_graphcanvas = null;
        this.clear();

        if (o) {
            this.configure(o);
        }
    }

    getSupportedTypes(): string[] {
        return this.supported_types || LGraph.supported_types;
    }

    /**
     * Removes all nodes from this graph
     * @method clear
     */
    clear(): void {
        this.stop();
        this.status = LGraph.STATUS_STOPPED;

        this.last_node_id = 0;
        this.last_link_id = 0;

        this._version = -1; // used to detect changes

        // safe clear
        if (this._nodes) {
            for (let i = 0; i < this._nodes.length; ++i) {
                const node = this._nodes[i];
                if (node.onRemoved) {
                    node.onRemoved();
                }
            }
        }

        // nodes
        this._nodes = [];
        this._nodes_by_id = {};
        this._nodes_in_order = []; // nodes sorted in execution order
        this._nodes_executable = null; // nodes that contain onExecute sorted in execution order

        // other scene stuff
        this._groups = [];

        // links
        this.links = {}; // container with all the links

        // iterations
        this.iteration = 0;

        // custom data
        this.config = {};
        this.vars = {};
        this.extra = {}; // to store custom data

        // timing
        this.globaltime = 0;
        this.runningtime = 0;
        this.fixedtime = 0;
        this.fixedtime_lapse = 0.01;
        this.elapsed_time = 0.01;
        this.last_update_time = 0;
        this.starttime = 0;

        this.catch_errors = true;

        this.nodes_executing = [];
        this.nodes_actioning = [];
        this.nodes_executedAction = [];

        // subgraph_data
        this.inputs = {};
        this.outputs = {};

        // notify canvas to redraw
        this.change();
        this.sendActionToCanvas("clear");
    }

    /**
     * Attach Canvas to this graph
     * @method attachCanvas
     */
    attachCanvas(graphcanvas: LGraphCanvasLifecycleLike): void {
        const host = resolveLifecycleHost(this);
        if (
            !graphcanvas ||
            typeof graphcanvas !== "object" ||
            (host.LGraphCanvas &&
                graphcanvas.constructor != host.LGraphCanvas)
        ) {
            throw "attachCanvas expects a LGraphCanvas instance";
        }

        const currentGraph = graphcanvas.graph;
        if (currentGraph && currentGraph !== this) {
            currentGraph.detachCanvas(graphcanvas);
        }

        graphcanvas.graph = this;

        if (!this.list_of_graphcanvas) {
            this.list_of_graphcanvas = [];
        }
        this.list_of_graphcanvas.push(graphcanvas);
    }

    /**
     * Detach Canvas from this graph
     * @method detachCanvas
     */
    detachCanvas(graphcanvas: LGraphCanvasLifecycleLike): void {
        if (!this.list_of_graphcanvas) {
            return;
        }

        const pos = this.list_of_graphcanvas.indexOf(graphcanvas);
        if (pos === -1) {
            return;
        }
        graphcanvas.graph = null;
        this.list_of_graphcanvas.splice(pos, 1);
    }

    /**
     * Starts running this graph every interval milliseconds.
     * @method start
     * @param {number} interval amount of milliseconds between executions, if 0 then it renders to the monitor refresh rate
     */
    start(interval?: number): void {
        if (this.status == LGraph.STATUS_RUNNING) {
            return;
        }
        this.status = LGraph.STATUS_RUNNING;

        if (this.onPlayEvent) {
            this.onPlayEvent();
        }

        this.sendEventToAllNodes("onStart");

        // launch
        this.starttime = resolveLifecycleHost(this).getTime();
        this.last_update_time = this.starttime;
        interval = interval || 0;
        const that = this;

        // execute once per frame
        if (
            interval == 0 &&
            typeof window != "undefined" &&
            window.requestAnimationFrame
        ) {
            const on_frame = (): void => {
                if (that.execution_timer_id != -1) {
                    return;
                }
                window.requestAnimationFrame(on_frame);
                if (that.onBeforeStep) {
                    that.onBeforeStep();
                }
                that.runStep(1, !that.catch_errors);
                if (that.onAfterStep) {
                    that.onAfterStep();
                }
            };
            this.execution_timer_id = -1;
            on_frame();
        } else {
            // execute every 'interval' ms
            this.execution_timer_id = setInterval(function() {
                if (that.onBeforeStep) {
                    that.onBeforeStep();
                }
                that.runStep(1, !that.catch_errors);
                if (that.onAfterStep) {
                    that.onAfterStep();
                }
            }, interval);
        }
    }

    /**
     * Stops the execution loop of the graph
     * @method stop execution
     */
    stop(): void {
        if (this.status == LGraph.STATUS_STOPPED) {
            return;
        }

        this.status = LGraph.STATUS_STOPPED;

        if (this.onStopEvent) {
            this.onStopEvent();
        }

        if (this.execution_timer_id != null) {
            if (this.execution_timer_id != -1) {
                clearInterval(this.execution_timer_id as ReturnType<typeof setInterval>);
            }
            this.execution_timer_id = null;
        }

        this.sendEventToAllNodes("onStop");
    }

    /**
     * Returns the amount of time the graph has been running in milliseconds
     * @method getTime
     * @return {number} number of milliseconds the graph has been running
     */
    getTime(): number {
        return this.globaltime;
    }

    /**
     * Returns the amount of time accumulated using the fixedtime_lapse var. This is used in context where the time increments should be constant
     * @method getFixedTime
     * @return {number} number of milliseconds the graph has been running
     */
    getFixedTime(): number {
        return this.fixedtime;
    }

    /**
     * Returns the amount of time it took to compute the latest iteration. Take into account that this number could be not correct
     * if the nodes are using graphical actions
     * @method getElapsedTime
     * @return {number} number of milliseconds it took the last cycle
     */
    getElapsedTime(): number {
        return this.elapsed_time;
    }

    // placeholders to keep lifecycle module self-contained during incremental migration.
    configure(_data: object, _keep_old?: boolean): boolean | undefined {
        return undefined;
    }

    runStep(_num?: number, _do_not_catch_errors?: boolean): void {
        // implemented in Task 11
    }

    change(): void {
        // implemented in later tasks
    }

    sendActionToCanvas(_action: string, ..._params: unknown[]): void {
        // implemented in later tasks
    }

    sendEventToAllNodes(
        _eventname: string,
        _params?: unknown[],
        _mode?: unknown
    ): void {
        // implemented in later tasks
    }
}
