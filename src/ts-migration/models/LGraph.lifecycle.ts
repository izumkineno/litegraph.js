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

interface LeaferExecutionAppLike {
    nextRender: (item: () => void, bind?: object, off?: "off") => void;
    removeNextRender?: (item: () => void) => void;
    requestRender: (change?: boolean) => void;
}

interface LGraphCanvasExecutionSchedulerLike extends LGraphCanvasLifecycleLike {
    renderRuntime?: "legacy-canvas" | "leafer";
    leaferAppHost?: {
        app?: LeaferExecutionAppLike | null;
    } | null;
}

export interface LGraphCanvasLifecycleLike
    extends GraphCanvasLifecyclePort<LGraphCanvasLifecycleGraphLike> {
    constructor: unknown;
}

type ExecutionScheduleKind = "none" | "leafer-frame" | "raf" | "timer";

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

    nodes_executing: Record<string, unknown> = {};
    nodes_actioning: Record<string, unknown> = {};
    nodes_executedAction: Record<string, unknown> = {};

    // subgraph_data
    inputs: Record<string, unknown> = {};
    outputs: Record<string, unknown> = {};

    execution_timer_id: number | ReturnType<typeof setTimeout> | null = null;
    protected execution_schedule_kind: ExecutionScheduleKind = "none";
    protected execution_schedule_interval = 0;
    protected execution_leafer_app: LeaferExecutionAppLike | null = null;
    protected execution_animation_frame_id: number | null = null;
    protected execution_schedule_revision = 0;
    protected execution_phase_depth = 0;
    protected readonly runtime_dirty_node_ids = new Set<number | string>();
    protected readonly runtime_dirty_link_ids = new Set<number | string>();
    protected readonly runtime_state_touched_node_keys = new Set<string>();
    protected readonly runtime_state_touched_node_id_list: string[] = [];
    protected internal_scene_batch_depth = 0;
    protected internal_scene_batch_execution_order_dirty = false;
    protected internal_scene_batch_change_requested = false;
    protected internal_scene_batch_dirty_foreground = false;
    protected internal_scene_batch_dirty_background = false;
    protected readonly internal_scene_batch_canvas_actions = new Set<string>();

    onPlayEvent?: () => void;
    onStopEvent?: () => void;
    onBeforeStep?: () => void;
    onAfterStep?: () => void;
    protected readonly executionTick = (): void => {
        const scheduleKind = this.execution_schedule_kind;
        if (scheduleKind === "none" || this.status !== LGraph.STATUS_RUNNING) {
            return;
        }

        if (scheduleKind === "timer") {
            this.execution_timer_id = null;
        } else if (scheduleKind === "raf") {
            this.execution_animation_frame_id = null;
            this.execution_timer_id = null;
        }

        if (this.onBeforeStep) {
            this.onBeforeStep();
        }
        this.runStep(1, !this.catch_errors);
        this.afterExecutionTick();
        if (this.onAfterStep) {
            this.onAfterStep();
        }

        if (this.status !== LGraph.STATUS_RUNNING) {
            return;
        }

        this.scheduleNextExecutionTick();
    };

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

        this.nodes_executing = {};
        this.nodes_actioning = {};
        this.nodes_executedAction = {};
        this.execution_phase_depth = 0;
        this.runtime_dirty_node_ids.clear();
        this.runtime_dirty_link_ids.clear();
        this.runtime_state_touched_node_keys.clear();
        this.runtime_state_touched_node_id_list.length = 0;

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
        this.execution_schedule_interval = Math.max(0, interval || 0);
        this.beginExecutionSchedule();
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

        this.clearExecutionSchedule();

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

    protected trackRuntimeExecutionNode(nodeId: number | string): void {
        this.runtime_dirty_node_ids.add(nodeId);
        const key = String(nodeId);
        if (!this.runtime_state_touched_node_keys.has(key)) {
            this.runtime_state_touched_node_keys.add(key);
            this.runtime_state_touched_node_id_list.push(key);
        }
    }

    protected trackRuntimeExecutionLink(linkId: number | string): void {
        this.runtime_dirty_link_ids.add(linkId);
    }

    protected consumeRuntimeDirtyNodeIds(): (number | string)[] {
        if (!this.runtime_dirty_node_ids.size) {
            return [];
        }

        const dirtyNodeIds = Array.from(this.runtime_dirty_node_ids);
        this.runtime_dirty_node_ids.clear();
        return dirtyNodeIds;
    }

    protected consumeRuntimeDirtyLinkIds(): (number | string)[] {
        if (!this.runtime_dirty_link_ids.size) {
            return [];
        }

        const dirtyLinkIds = Array.from(this.runtime_dirty_link_ids);
        this.runtime_dirty_link_ids.clear();
        return dirtyLinkIds;
    }

    protected resetRuntimeExecutionState(): void {
        const touchedNodeIds = this.runtime_state_touched_node_id_list;
        for (let i = 0; i < touchedNodeIds.length; ++i) {
            const key = touchedNodeIds[i];
            delete this.nodes_executing[key];
            delete this.nodes_actioning[key];
            delete this.nodes_executedAction[key];
        }

        touchedNodeIds.length = 0;
        this.runtime_state_touched_node_keys.clear();
    }

    protected afterExecutionTick(): void {
        // implemented by execution host when runtime-side flushing is needed
    }

    __litegraphBeginSceneBatch(): void {
        if (this.internal_scene_batch_depth === 0) {
            this.internal_scene_batch_execution_order_dirty = false;
            this.internal_scene_batch_change_requested = false;
            this.internal_scene_batch_dirty_foreground = false;
            this.internal_scene_batch_dirty_background = false;
            this.internal_scene_batch_canvas_actions.clear();
        }
        this.internal_scene_batch_depth += 1;
    }

    __litegraphEndSceneBatch(): void {
        if (this.internal_scene_batch_depth <= 0) {
            return;
        }
        this.internal_scene_batch_depth -= 1;
        if (this.internal_scene_batch_depth !== 0) {
            return;
        }

        this.flushInternalSceneBatch();
        this.internal_scene_batch_execution_order_dirty = false;
        this.internal_scene_batch_change_requested = false;
        this.internal_scene_batch_dirty_foreground = false;
        this.internal_scene_batch_dirty_background = false;
        this.internal_scene_batch_canvas_actions.clear();
    }

    __litegraphRunSceneBatch<T>(work: () => T): T {
        this.__litegraphBeginSceneBatch();
        try {
            return work();
        } finally {
            this.__litegraphEndSceneBatch();
        }
    }

    protected isInternalSceneBatchActive(): boolean {
        return this.internal_scene_batch_depth > 0;
    }

    protected queueInternalSceneBatchExecutionOrder(): boolean {
        if (!this.isInternalSceneBatchActive()) {
            return false;
        }
        this.internal_scene_batch_execution_order_dirty = true;
        return true;
    }

    protected consumeInternalSceneBatchExecutionOrder(): boolean {
        const pending = this.internal_scene_batch_execution_order_dirty;
        this.internal_scene_batch_execution_order_dirty = false;
        return pending;
    }

    protected queueInternalSceneBatchChange(): boolean {
        if (!this.isInternalSceneBatchActive()) {
            return false;
        }
        this.internal_scene_batch_change_requested = true;
        return true;
    }

    protected consumeInternalSceneBatchChange(): boolean {
        const pending = this.internal_scene_batch_change_requested;
        this.internal_scene_batch_change_requested = false;
        return pending;
    }

    protected queueInternalSceneBatchDirty(
        dirtyForeground: boolean,
        dirtyBackground?: boolean
    ): boolean {
        if (!this.isInternalSceneBatchActive()) {
            return false;
        }
        this.internal_scene_batch_dirty_foreground =
            this.internal_scene_batch_dirty_foreground || dirtyForeground === true;
        this.internal_scene_batch_dirty_background =
            this.internal_scene_batch_dirty_background || dirtyBackground === true;
        return true;
    }

    protected consumeInternalSceneBatchDirty(): [boolean, boolean] | null {
        const dirtyForeground = this.internal_scene_batch_dirty_foreground;
        const dirtyBackground = this.internal_scene_batch_dirty_background;
        this.internal_scene_batch_dirty_foreground = false;
        this.internal_scene_batch_dirty_background = false;
        if (!dirtyForeground && !dirtyBackground) {
            return null;
        }
        return [dirtyForeground, dirtyBackground];
    }

    protected queueInternalSceneBatchCanvasAction(action: string): boolean {
        if (!this.isInternalSceneBatchActive()) {
            return false;
        }
        this.internal_scene_batch_canvas_actions.add(action);
        return true;
    }

    protected consumeInternalSceneBatchCanvasActions(): string[] {
        const actions = Array.from(this.internal_scene_batch_canvas_actions);
        this.internal_scene_batch_canvas_actions.clear();
        return actions;
    }

    protected flushInternalSceneBatch(): void {
        // implemented by derived graph hosts that coalesce graph-side work
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

    private beginExecutionSchedule(): void {
        this.clearExecutionSchedule();

        if (this.execution_schedule_interval > 0) {
            this.execution_schedule_kind = "timer";
            this.scheduleNextExecutionTick();
            return;
        }

        const leaferApp = this.resolveLeaferExecutionApp();
        if (leaferApp) {
            this.execution_schedule_kind = "leafer-frame";
            this.execution_leafer_app = leaferApp;
            this.scheduleInitialExecutionTick();
            return;
        }

        if (typeof window != "undefined") {
            this.execution_schedule_kind = "raf";
            this.scheduleInitialExecutionTick();
            return;
        }

        this.execution_schedule_kind = "timer";
        this.scheduleNextExecutionTick();
    }

    private scheduleNextExecutionTick(): void {
        switch (this.execution_schedule_kind) {
            case "leafer-frame":
                if (!this.execution_leafer_app) {
                    this.execution_schedule_kind = "timer";
                    this.scheduleNextExecutionTick();
                    return;
                }
                this.execution_leafer_app.nextRender(this.executionTick, this);
                this.execution_leafer_app.requestRender();
                return;
            case "raf":
                this.execution_animation_frame_id = window.requestAnimationFrame(
                    this.executionTick
                );
                this.execution_timer_id = this.execution_animation_frame_id;
                return;
            case "timer":
                this.execution_timer_id = setTimeout(
                    this.executionTick,
                    this.execution_schedule_interval
                );
                return;
            default:
                return;
        }
    }

    private scheduleInitialExecutionTick(): void {
        const scheduleRevision = this.execution_schedule_revision;
        const runInitialTick = (): void => {
            if (this.execution_schedule_revision !== scheduleRevision) {
                return;
            }
            this.executionTick();
        };

        if (typeof queueMicrotask === "function") {
            queueMicrotask(runInitialTick);
            return;
        }

        Promise.resolve().then(runInitialTick);
    }

    private clearExecutionSchedule(): void {
        const previousKind = this.execution_schedule_kind;
        const previousTimerId = this.execution_timer_id;
        const previousAnimationFrameId = this.execution_animation_frame_id;
        const previousLeaferApp = this.execution_leafer_app;

        this.execution_schedule_revision += 1;
        this.execution_schedule_kind = "none";
        this.execution_timer_id = null;
        this.execution_animation_frame_id = null;
        this.execution_leafer_app = null;

        if (previousKind === "leafer-frame" && previousLeaferApp) {
            if (typeof previousLeaferApp.removeNextRender === "function") {
                previousLeaferApp.removeNextRender(this.executionTick);
            } else {
                previousLeaferApp.nextRender(this.executionTick, this, "off");
            }
            return;
        }

        if (previousKind === "raf" && previousAnimationFrameId !== null) {
            window.cancelAnimationFrame(previousAnimationFrameId);
            return;
        }

        if (previousKind === "timer" && previousTimerId != null) {
            clearTimeout(previousTimerId as ReturnType<typeof setTimeout>);
        }
    }

    private resolveLeaferExecutionApp(): LeaferExecutionAppLike | null {
        const canvasList =
            this.list_of_graphcanvas as LGraphCanvasExecutionSchedulerLike[] | null;
        if (!canvasList?.length) {
            return null;
        }

        for (let i = 0; i < canvasList.length; ++i) {
            const canvas = canvasList[i];
            if (canvas?.renderRuntime !== "leafer") {
                continue;
            }

            const app = canvas.leaferAppHost?.app || null;
            if (
                app &&
                typeof app.nextRender === "function" &&
                typeof app.requestRender === "function"
            ) {
                return app;
            }
        }

        return null;
    }
}
