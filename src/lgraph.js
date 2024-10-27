import { LiteGraph } from "./litegraph.js";

/**
 * LGraph is the class that contain a full graph. We instantiate one and add nodes to it, and then we can run the execution loop.
 *
 * LGraph 是包含完整图的类。我们实例化一个并向其添加节点，然后可以运行执行循环。
 * supported callbacks:
 * 支持的回调:
    + onNodeAdded: 当新节点添加到图中时
    + onNodeRemoved: 当图中的节点被移除时
    + onNodeConnectionChange: 图中的某些连接发生了变化(连接或断开)
 */
export class LGraph {

    // default supported types
    static supported_types = ["number", "string", "boolean"];

    static STATUS_STOPPED = 1;
    static STATUS_RUNNING = 2;

    /**
     * @constructor
     * @param {Object} o data from previous serialization [optional]} o
     */
    constructor(o) {
        LiteGraph.log?.("Graph created");
        this.list_of_graphcanvas = null;
        this.clear();

        if (o) {
            this.configure(o);
        }
    }

    /**
     * Gets the supported types of the LGraph class, falling back to the default supported types if not defined for the instance.
     * @returns {Array} An array of supported types for the LGraph class.
     */
    getSupportedTypes() {
        return this.supported_types ?? LGraph.supported_types;
    }

    /**
     * Removes all nodes from this graph
     * @method clear
     */
    clear() {
        this.stop();
        this.status = LGraph.STATUS_STOPPED;

        this.last_node_id = 0;
        this.last_link_id = 0;

        this._version = -1; // used to detect changes

        // safe clear
        this._nodes?.forEach((node) => {
            node.onRemoved?.();
        });

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
        this.configApplyDefaults();

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

        // savings
        this.history = {
            actionHistory: [],
            actionHistoryVersions: [],
            actionHistoryPtr: 0,
        };

        this.nodes_executing = [];
        this.nodes_actioning = [];
        this.node_ancestorsCalculated = [];
        this.nodes_executedAction = [];

        // subgraph_data
        this.inputs = {};
        this.outputs = {};

        // notify canvas to redraw
        this.change();

        this.sendActionToCanvas("clear");
    }

    /**
    * Apply config values to LGraph config object
    * @method configApply
     * @param {object} opts options to merge
    */
    configApply(opts) {
        /*
        align_to_grid
        links_ontop
        */
        this.config = Object.assign(this.config,opts);
    }

    /**
    * Apply config values to LGraph config object
    * @method configApply
     * @param {object} opts options to merge
    */
    configApplyDefaults() {
        var opts = LiteGraph.graphDefaultConfig;
        this.configApply(opts);
    }

    /**
     * Attach Canvas to this graph
     * @method attachCanvas
     * @param {GraphCanvas} graph_canvas
     */
    attachCanvas(graphcanvas) {
        if (! graphcanvas instanceof LiteGraph.LGraphCanvas) {
            throw new Error("attachCanvas expects a LiteGraph.LGraphCanvas instance");
        }
        if (graphcanvas.graph && graphcanvas.graph != this) {
            graphcanvas.graph.detachCanvas(graphcanvas);
        }

        graphcanvas.graph = this;
        this.list_of_graphcanvas ??= [];
        this.list_of_graphcanvas.push(graphcanvas);
    }

    /**
     * Detach Canvas from this graph
     * @method detachCanvas
     * @param {GraphCanvas} graph_canvas
     */
    detachCanvas(graphcanvas) {
        if (!this.list_of_graphcanvas) {
            return;
        }

        var pos = this.list_of_graphcanvas.indexOf(graphcanvas);
        if (pos == -1) {
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
    start(interval = 0) {
        if (this.status === LGraph.STATUS_RUNNING) {
            return;
        }

        this.status = LGraph.STATUS_RUNNING;
        this.onPlayEvent?.();
        this.sendEventToAllNodes("onStart");

        this.starttime = LiteGraph.getTime();
        this.last_update_time = this.starttime;

        const onAnimationFrame = () => {
            if (this.execution_timer_id !== -1) {
                return;
            }
            window.requestAnimationFrame(onAnimationFrame);
            this.onBeforeStep?.();
            this.runStep(1, !this.catch_errors);
            this.onAfterStep?.();
        };

        if (interval === 0 && typeof window === "object" && window.requestAnimationFrame) {
            this.execution_timer_id = -1;
            onAnimationFrame();
        } else {
            this.execution_timer_id = setInterval(() => {
                this.onBeforeStep?.();
                this.runStep(1, !this.catch_errors);
                this.onAfterStep?.();
            }, interval);
        }
    }

    /**
     * Stops the execution loop of the graph
     * @method stop execution
     */
    stop() {
        if (this.status == LGraph.STATUS_STOPPED) {
            return;
        }
        this.status = LGraph.STATUS_STOPPED;
        this.onStopEvent?.();
        if (this.execution_timer_id != null) {
            if (this.execution_timer_id != -1) {
                clearInterval(this.execution_timer_id);
            }
            this.execution_timer_id = null;
        }
        this.sendEventToAllNodes("onStop");
    }

    /**
     * Run N steps (cycles) of the graph
     * @method runStep
     * @param {number} num number of steps to run, default is 1
     * @param {Boolean} do_not_catch_errors [optional] if you want to try/catch errors
     * @param {number} limit max number of nodes to execute (used to execute from start to a node)
     */
    runStep(num = 1, do_not_catch_errors, limit) {
        var start = LiteGraph.getTime();
        this.globaltime = 0.001 * (start - this.starttime);

        var nodes = this._nodes_executable ?? this._nodes;
        if (!nodes) {
            return;
        }

        limit ||= nodes.length;

        if (do_not_catch_errors) {
            for (let i = 0; i < num; i++) {
                nodes.forEach((node) => {
                    if (LiteGraph.use_deferred_actions && node._waiting_actions?.length) {
                        node.executePendingActions();
                    }

                    if (node.mode === LiteGraph.ALWAYS) {
                        node.doExecute?.();
                    }
                });

                this.fixedtime += this.fixedtime_lapse;
                this.onExecuteStep?.();
            }
            this.onAfterExecute?.();
        } else { // catch errors
            try {
                for (let i = 0; i < num; i++) {
                    nodes.forEach((node) => {
                        if (LiteGraph.use_deferred_actions && node._waiting_actions?.length) {
                            node.executePendingActions();
                        }

                        if (node.mode === LiteGraph.ALWAYS) {
                            node.doExecute?.();
                        }
                    });

                    this.fixedtime += this.fixedtime_lapse;
                    this.onExecuteStep?.();
                }

                this.onAfterExecute?.();
                this.errors_in_execution = false;
            } catch (err) {

                this.errors_in_execution = true;
                if (LiteGraph.throw_errors) {
                    throw err;
                }
                LiteGraph.log?.(`Error during execution: ${err}`);
                this.stop();
            }
        }

        var now = LiteGraph.getTime();
        var elapsed = now - start;
        if (elapsed == 0) {
            elapsed = 1;
        }
        this.execution_time = 0.001 * elapsed;
        this.globaltime += 0.001 * elapsed;
        this.iteration += 1;
        this.elapsed_time = (now - this.last_update_time) * 0.001;
        this.last_update_time = now;
        this.nodes_executing = [];
        this.nodes_actioning = [];
        this.node_ancestorsCalculated = [];
        this.nodes_executedAction = [];
    }

    /**
     * 更新图的执行顺序，根据节点的相关性（只有输出的节点比只有输入的节点更相关）。
     * Updates the graph execution order according to relevance of the nodes (nodes with only outputs have more relevance than
     * nodes with only inputs.
     * @method updateExecutionOrder
     */
    updateExecutionOrder() {
        // 计算执行顺序
        this._nodes_in_order = this.computeExecutionOrder(false);
        // 初始化可执行节点数组
        this._nodes_executable = [];
        // 遍历排序后的节点
        for (var i = 0; i < this._nodes_in_order.length; ++i) {
            // 如果节点有onExecute方法，将其添加到可执行节点数组中
            if (this._nodes_in_order[i].onExecute) {
                this._nodes_executable.push(this._nodes_in_order[i]);
            }
        }
    }

    /**
     * 计算流图中节点的执行顺序，基于它们的连接和层级。
     * @param {boolean} only_onExecute - 指示是否只考虑具有onExecute方法的节点。
     * @param {boolean} set_level - 如果为true，则根据节点的连接为其分配层级。
     * @returns {Array} 按计算出的执行顺序排列的节点数组。
     *
     * @TODO:这整个概念是一个错误。应该从输出节点开始回溯调用图
     */
    computeExecutionOrder(only_onExecute, set_level) {
        var L = []; // 最终的执行顺序数组
        var S = []; // 起始节点数组
        var M = {}; // 待处理节点映射
        var visited_links = {}; // 用于避免重复处理链接
        var remaining_links = {}; // 用于跟踪剩余的输入链接数

        // 搜索没有输入的节点（起始节点）
        for (let i = 0, l = this._nodes.length; i < l; ++i) {
            let node = this._nodes[i];
            if (only_onExecute && !node.onExecute) {
                continue;
            }

            M[node.id] = node; // 添加到待处理节点

            var num = 0; // 输入连接数
            if (node.inputs) {
                for (var j = 0, l2 = node.inputs.length; j < l2; j++) {
                    if (node.inputs[j] && node.inputs[j].link != null) {
                        num += 1;
                    }
                }
            }

            if (num == 0) {
                // 是一个起始节点
                S.push(node);
                if (set_level) {
                    node._level = 1;
                }
            } else { // 输入链接数
                if (set_level) {
                    node._level = 0;
                }
                remaining_links[node.id] = num;
            }
        }

        while (S.length != 0) {
            // 获取一个起始节点
            var node = S.shift();
            L.push(node); // 添加到有序列表
            delete M[node.id]; // 从待处理节点中移除

            if (!node.outputs) {
                continue;
            }

            // 对每个输出
            for (let i = 0; i < node.outputs.length; i++) {
                let output = node.outputs[i];
                // 未连接
                if (
                    output == null ||
                    output.links == null ||
                    output.links.length == 0
                ) {
                    continue;
                }

                // 对每个连接
                for (let j = 0; j < output.links.length; j++) {
                    let link_id = output.links[j];
                    let link = this.links[link_id];
                    if (!link) {
                        continue;
                    }

                    // 已访问的链接（忽略它）
                    if (visited_links[link.id]) {
                        continue;
                    }

                    let target_node = this.getNodeById(link.target_id);
                    if (target_node == null) {
                        visited_links[link.id] = true;
                        continue;
                    }

                    if (
                        set_level &&
                        (!target_node._level ||
                            target_node._level <= node._level)
                    ) {
                        target_node._level = node._level + 1;
                    }

                    visited_links[link.id] = true; // 标记为已访问
                    remaining_links[target_node.id] -= 1; // 减少剩余链接数
                    if (remaining_links[target_node.id] == 0) {
                        S.push(target_node);
                    } // 如果没有更多链接，则添加到起始数组
                }
            }
        }

        // 剩余的节点（循环）
        for (let i in M) {
            L.push(M[i]);
        }

        if (L.length != this._nodes.length && LiteGraph.debug) {
            LiteGraph.warn?.("出现问题，节点缺失");
        }

        var l = L.length;

        // 在节点中保存顺序编号
        for (let i = 0; i < l; ++i) {
            L[i].order = i;
        }

        // 现在按优先级排序
        L = L.sort((A, B) => {
            let Ap = A.constructor.priority || A.priority || 0;
            let Bp = B.constructor.priority || B.priority || 0;
            if (Ap == Bp) {
                // 如果优先级相同，按顺序排序
                return A.order - B.order;
            }
            return Ap - Bp; // 按优先级排序
        });

        // 再次在节点中保存顺序编号
        for (let i = 0; i < l; ++i) {
            L[i].order = i;
        }

        return L;
    }

    /**
     * Returns all the nodes that could affect this one (ancestors) by crawling all the inputs recursively.
     * It doesn't include the node itself
     * @method getAncestors
     * @return {Array} an array with all the LiteGraph.LGraphNodes that affect this node, in order of execution
     */
    getAncestors(node, optsIn = {}) {
        var optsDef = {
            modesSkip: [],
            modesOnly: [],
            typesSkip: [],
            typesOnly: [],
        };
        var opts = Object.assign(optsDef,optsIn);

        var ancestors = [];
        var ancestorsIds = [];
        var pending = [node];
        var visited = {};

        while (pending.length) {
            var current = pending.shift();
            if (!current) {
                continue;
            }
            if (visited[current.id]) {
                continue;
            }
            // mark as visited
            visited[current.id] = true;

            // add to ancestors
            if (current.id != node.id) {

                // mode check
                if (opts.modesSkip && opts.modesSkip.length) {
                    if (opts.modesSkip.indexOf(current.mode) != -1) {
                        // DBG("mode skip "+current.id+":"+current.order+" :: "+current.mode);
                        continue;
                    }
                }
                if (opts.modesOnly && opts.modesOnly.length) {
                    if (opts.modesOnly.indexOf(current.mode) == -1) {
                        // DBG("mode only "+current.id+":"+current.order+" :: "+current.mode);
                        continue;
                    }
                }

                if (ancestorsIds.indexOf(current.id) == -1) {
                    ancestors.push(current);
                    ancestorsIds.push(current.id);
                    // DBG("push current "+current.id+":"+current.order);
                }

            }

            // get its inputs
            if (!current.inputs) {
                continue;
            }

            for (var i = 0; i < current.inputs.length; ++i) {
                var input = current.getInputNode(i);
                if (!input)
                    continue;
                var inputType = current.inputs[i].type;

                // type check
                if (opts.typesSkip && opts.typesSkip.length) {
                    if (opts.typesSkip.indexOf(inputType) != -1) {
                        // DBG("type skip "+input.id+":"+input.order+" :: "+inputType);
                        continue;
                    }
                }
                if (opts.typesOnly && opts.typesOnly.length) {
                    if (opts.typesOnly.indexOf(input.mode) == -1) {
                        // DBG("type only "+input.id+":"+input.order+" :: "+inputType);
                        continue;
                    }
                }

                // DBG("input "+i+" "+input.id+":"+input.order);
                // push em in
                if (ancestorsIds.indexOf(input.id) == -1) {
                    if(!visited[input.id]) {
                        pending.push(input);
                        // DBG("push input "+input.id+":"+input.order);
                    }
                }
            }
        }

        ancestors.sort((a, b) => a.order - b.order);
        return ancestors;
    }

    /**
     * Positions every node in a more readable manner
     * @method arrange
     */
    arrange(margin = 100, layout) {
        const nodes = this.computeExecutionOrder(false, true);
        const columns = [];
        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            const col = node._level || 1;
            columns[col] ??= [];
            columns[col].push(node);
        }

        let x = margin;

        for (let i = 0; i < columns.length; ++i) {
            const column = columns[i];
            if (!column) {
                continue;
            }
            let max_size = 100;
            let y = margin + LiteGraph.NODE_TITLE_HEIGHT;
            for (let j = 0; j < column.length; ++j) {
                const node = column[j];
                node.pos[0] = (layout == LiteGraph.VERTICAL_LAYOUT) ? y : x;
                node.pos[1] = (layout == LiteGraph.VERTICAL_LAYOUT) ? x : y;
                const max_size_index = (layout == LiteGraph.VERTICAL_LAYOUT) ? 1 : 0;
                if (node.size[max_size_index] > max_size) {
                    max_size = node.size[max_size_index];
                }
                const node_size_index = (layout == LiteGraph.VERTICAL_LAYOUT) ? 0 : 1;
                y += node.size[node_size_index] + margin + LiteGraph.NODE_TITLE_HEIGHT;
            }
            x += max_size + margin;
        }

        this.setDirtyCanvas(true, true);
    }

    /**
     * Returns the amount of time the graph has been running in milliseconds
     * @method getTime
     * @return {number} number of milliseconds the graph has been running
     */
    getTime() {
        return this.globaltime;
    }

    /**
     * Returns the amount of time accumulated using the fixedtime_lapse var. This is used in context where the time increments should be constant
     * @method getFixedTime
     * @return {number} number of milliseconds the graph has been running
     */
    getFixedTime() {
        return this.fixedtime;
    }

    /**
     * Returns the amount of time it took to compute the latest iteration. Take into account that this number could be not correct
     * if the nodes are using graphical actions
     * @method getElapsedTime
     * @return {number} number of milliseconds it took the last cycle
     */
    getElapsedTime() {
        return this.elapsed_time;
    }

    /**
     * Sends an event to all the nodes, useful to trigger stuff
     * @method sendEventToAllNodes
     * @param {String} eventname the name of the event (function to be called)
     * @param {Array} params parameters in array format
     */
    sendEventToAllNodes(eventname, params, mode = LiteGraph.ALWAYS) {
        var nodes = this._nodes_in_order ? this._nodes_in_order : this._nodes;
        if (!nodes) {
            return;
        }

        for (let j = 0, l = nodes.length; j < l; ++j) {
            const node = nodes[j];

            if (
                node.constructor === LiteGraph.Subgraph &&
                eventname !== "onExecute"
            ) {
                if (node.mode == mode) {
                    node.sendEventToAllNodes(eventname, params, mode);
                }
                continue;
            }

            if (!node[eventname] || node.mode !== mode) {
                continue;
            }
            if (params === undefined) {
                node[eventname]();
            } else if (Array.isArray(params)) {
                node[eventname].apply(node, params);
            } else {
                node[eventname](params);
            }
        }
    }

    /**
     * Sends an action with parameters to the connected GraphCanvas instances for processing.
     * @param {string} action - The action to be performed on the GraphCanvas instances.
     * @param {Array} params - An array of parameters to be passed to the action method.
     */
    sendActionToCanvas(action, params) {
        if (!this.list_of_graphcanvas) {
            return;
        }

        for (const c of this.list_of_graphcanvas) {
            if (c[action] && params) {
                c[action](...params);
            }
        }
    }

    /**
     * 向图中添加一个新的节点实例
     * @method add
     * @param {LiteGraph.LGraphNode} node 节点的实例
     */
    add(node, skip_compute_order, optsIn = {}) {

        // 默认选项
        var optsDef = {
            doProcessChange: true,
            doCalcSize: true,
        };
        var opts = Object.assign(optsDef,optsIn);

        if (!node) {
            return;
        }

        // 处理组
        if (node.constructor === LiteGraph.LGraphGroup) {
            this._groups.push(node);
            this.setDirtyCanvas(true);
            this.change();
            node.graph = this;
            this.onGraphChanged({action: "groupAdd", doSave: opts.doProcessChange});
            return;
        }

        // 处理节点
        // 检查ID是否已存在
        if (node.id != -1 && this._nodes_by_id[node.id] != null) {
            LiteGraph.warn?.("LiteGraph: 已存在具有此ID的节点，正在更改ID");
            if (LiteGraph.use_uuids) {
                node.id = LiteGraph.uuidv4();
            } else {
                node.id = ++this.last_node_id;
            }
        }

        // 检查节点数量是否超过最大限制
        if (this._nodes.length >= LiteGraph.MAX_NUMBER_OF_NODES) {
            throw new Error("LiteGraph: 图中的节点数量已达到最大值");
        }

        // 分配ID
        if (LiteGraph.use_uuids) {
            if (node.id == null || node.id == -1)
                node.id = LiteGraph.uuidv4();
        } else {
            if (node.id == null || node.id == -1) {
                node.id = ++this.last_node_id;
            } else if (this.last_node_id < node.id) {
                this.last_node_id = node.id;
            }
        }

        node.graph = this;
        this.onGraphChanged({action: "nodeAdd", doSave: opts.doProcessChange});

        this._nodes.push(node);
        this._nodes_by_id[node.id] = node;

        // 调用节点的onAdded方法（如果存在）
        node.onAdded?.(this);

        // 如果配置了对齐网格，则对齐节点
        if (this.config.align_to_grid) {
            node.alignToGrid();
        }

        // 更新执行顺序（如果需要）
        if (!skip_compute_order) {
            this.updateExecutionOrder();
        }

        // 调用onNodeAdded回调（如果存在）
        this.onNodeAdded?.(node);

        // 计算节点大小（如果需要）
        if (opts.doCalcSize) {
            node.setSize( node.computeSize() );
        }
        
        this.setDirtyCanvas(true);
        this.change();

        return node; // 返回节点以支持链式操作
    }

    /**
     * 从图中移除一个节点
     * @method remove
     * @param {LiteGraph.LGraphNode} node 要移除的节点实例
     */
    remove(node) {
        // 如果是组节点，特殊处理
        if (node.constructor === LiteGraph.LGraphGroup) {
            var index = this._groups.indexOf(node);
            if (index != -1) {
                this._groups.splice(index, 1);
            }
            node.graph = null;
            this.onGraphChanged({action: "groupRemove"});
            this.setDirtyCanvas(true, true);
            this.change();
            return;
        }

        // 检查节点是否存在
        if (this._nodes_by_id[node.id] == null) {
            return;
        } // 未找到节点

        // 检查节点是否可以被移除
        if (node.ignore_remove) {
            return;
        } // 不能被移除

        // 断开输入连接
        if (node.inputs) {
            for (let i = 0; i < node.inputs.length; i++) {
                let slot = node.inputs[i];
                if (slot.link != null) {
                    node.disconnectInput(i, {doProcessChange: false});
                }
            }
        }

        // 断开输出连接
        if (node.outputs) {
            for (let i = 0; i < node.outputs.length; i++) {
                let slot = node.outputs[i];
                if (slot.links != null && slot.links.length) {
                    node.disconnectOutput(i, false, {doProcessChange: false});
                }
            }
        }

        // 调用节点的onRemoved回调
        node.onRemoved?.();
        node.graph = null;
        this.onGraphChanged({action: "nodeRemove"});

        // 从画布渲染中移除
        if (this.list_of_graphcanvas) {
            for (let i = 0; i < this.list_of_graphcanvas.length; ++i) {
                let canvas = this.list_of_graphcanvas[i];
                if (canvas.selected_nodes[node.id]) {
                    delete canvas.selected_nodes[node.id];
                }
                if (canvas.node_dragged == node) {
                    canvas.node_dragged = null;
                }
            }
        }

        // 从容器中移除
        var pos = this._nodes.indexOf(node);
        if (pos != -1) {
            this._nodes.splice(pos, 1);
        }
        delete this._nodes_by_id[node.id];

        // 调用onNodeRemoved回调
        this.onNodeRemoved?.(node);

        // 关闭面板
        this.sendActionToCanvas("checkPanels");

        this.setDirtyCanvas(true, true);
        this.change();

        // 更新执行顺序
        this.updateExecutionOrder();
    }

    /**
     * Returns a node by its id.
     * @method getNodeById
     * @param {Number} id
     */
    getNodeById(id) {
        if (id == null) {
            return null;
        }
        return this._nodes_by_id[id];
    }

    /**
     * Returns a list of nodes that matches a class
     * @method findNodesByClass
     * @param {Class} classObject the class itself (not an string)
     * @return {Array} a list with all the nodes of this type
     */
    findNodesByClass(classObject, result = []) {
        result = this._nodes.filter((node) => node.constructor === classObject);
        return result;
    }

    /**
     * Returns a list of nodes that matches a type
     * @method findNodesByType
     * @param {String} type the name of the node type
     * @return {Array} a list with all the nodes of this type
     */
    findNodesByType(type, result = []) {
        const lowerCaseType = type.toLowerCase();
        result = this._nodes.filter((node) => node.type.toLowerCase() === lowerCaseType);
        return result;
    }

    /**
     * Returns the first node that matches a name in its title
     * @method findNodeByTitle
     * @param {String} name the name of the node to search
     * @return {Node} the node or null
     */
    findNodeByTitle(title) {
        return this._nodes.find((node) => node.title === title) ?? null;
    }

    /**
     * Returns a list of nodes that matches a name
     * @method findNodesByTitle
     * @param {String} name the name of the node to search
     * @return {Array} a list with all the nodes with this name
     */
    findNodesByTitle(title) {
        return this._nodes.filter((node) => node.title === title);
    }

    /**
     * Returns the top-most node in this position of the canvas
     * @method getNodeOnPos
     * @param {number} x the x coordinate in canvas space
     * @param {number} y the y coordinate in canvas space
     * @param {Array} nodes_list a list with all the nodes to search from, by default is all the nodes in the graph
     * @return {LiteGraph.LGraphNode} the node at this position or null
     */
    getNodeOnPos(x, y, nodes_list = this._nodes, margin = 0) {
        return nodes_list.reverse().find((node) => node.isPointInside(x, y, margin)) ?? null;
    }

    /**
     * Returns the top-most group in that position
     * @method getGroupOnPos
     * @param {number} x the x coordinate in canvas space
     * @param {number} y the y coordinate in canvas space
     * @return {LiteGraph.LGraphGroup} the group or null
     */
    getGroupOnPos(x, y) {
        return this._groups.find((group) => group.isPointInside(x, y, 2, true)) ?? null;
    }

    /**
     * Checks that the node type matches the node type registered, used when replacing a nodetype by a newer version during execution
     * this replaces the ones using the old version with the new version
     * @method checkNodeTypes
     */
    checkNodeTypes() {
        for (var i = 0; i < this._nodes.length; i++) {
            var node = this._nodes[i];
            var ctor = LiteGraph.registered_node_types[node.type];
            if (node.constructor == ctor) {
                continue;
            }
            if(LiteGraph.debug)
                LiteGraph.log?.(`node being replaced by newer version: ${node.type}`);
            var newnode = LiteGraph.createNode(node.type);
            this._nodes[i] = newnode;
            newnode.configure(node.serialize());
            newnode.graph = this;
            this._nodes_by_id[newnode.id] = newnode;
            if (node.inputs) {
                newnode.inputs = node.inputs.concat();
            }
            if (node.outputs) {
                newnode.outputs = node.outputs.concat();
            }
        }
        this.updateExecutionOrder();
    }

    /**
     * Executes an action on the GraphInput nodes based on the provided action name and parameters.
     * @param {string} action - The name of the action to be executed on the GraphInput nodes.
     * @param {any} param - The parameter to pass to the action method.
     * @param {object} options - Additional options for the action.
     */
    onAction(action, param, options) {
        this._input_nodes = this.findNodesByClass(
            LiteGraph.GraphInput,
            this._input_nodes,
        );
        for (var i = 0; i < this._input_nodes.length; ++i) {
            var node = this._input_nodes[i];
            if (node.properties.name != action) {
                continue;
            }
            // wrap node.onAction(action, param);
            node.actionDo(action, param, options);
            break;
        }
    }

    trigger(action, param) {
        this.onTrigger?.(action, param);
    }

    /**
     * Tell this graph it has a global graph input of this type
     * @method addGlobalInput
     * @param {String} name
     * @param {String} type
     * @param {*} value [optional]
     */
    addInput(name, type, value) {
        var input = this.inputs[name];
        if (input) {
            // already exist
            return;
        }

        this.beforeChange();
        this.inputs[name] = { name: name, type: type, value: value };
        this.onGraphChanged({action: "addInput"});
        this.afterChange();
        this.onInputAdded?.(name, type);
        this.onInputsOutputsChange?.();
    }

    /**
     * Assign a data to the global graph input
     * @method setGlobalInputData
     * @param {String} name
     * @param {*} data
     */
    setInputData(name, data) {
        var input = this.inputs[name];
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
    getInputData(name) {
        var input = this.inputs[name];
        if (!input) {
            return null;
        }
        return input.value;
    }

    /**
     * Changes the name of a global graph input
     * @method renameInput
     * @param {String} old_name
     * @param {String} new_name
     */
    renameInput(old_name, name) {
        if (name == old_name) {
            return;
        }

        if (!this.inputs[old_name]) {
            return false;
        }

        if (this.inputs[name]) {
            LiteGraph.error?.("there is already one input with that name");
            return false;
        }

        this.inputs[name] = this.inputs[old_name];
        delete this.inputs[old_name];
        this.onGraphChanged({action: "renameInput"});

        this.onInputRenamed?.(old_name, name);
        this.onInputsOutputsChange?.();
    }

    /**
     * Changes the type of a global graph input
     * @method changeInputType
     * @param {String} name
     * @param {String} type
     */
    changeInputType(name, type) {
        if (!this.inputs[name]) {
            return false;
        }

        if (
            this.inputs[name].type &&
            String(this.inputs[name].type).toLowerCase() ==
                String(type).toLowerCase()
        ) {
            return;
        }

        this.inputs[name].type = type;
        this.onGraphChanged({action: "changeInputType"});
        this.onInputTypeChanged?.(name, type);
    }

    /**
     * Removes a global graph input
     * @method removeInput
     * @param {String} name
     * @param {String} type
     */
    removeInput(name) {
        if (!this.inputs[name]) {
            return false;
        }

        delete this.inputs[name];
        this.onGraphChanged({action: "graphRemoveInput"});

        this.onInputRemoved?.(name);
        this.onInputsOutputsChange?.();
        return true;
    }

    /**
     * Creates a global graph output
     * @method addOutput
     * @param {String} name
     * @param {String} type
     * @param {*} value
     */
    addOutput(name, type, value) {
        this.outputs[name] = { name: name, type: type, value: value };
        this.onGraphChanged({action: "addOutput"});

        this.onOutputAdded?.(name, type);
        this.onInputsOutputsChange?.();
    }

    /**
     * Assign a data to the global output
     * @method setOutputData
     * @param {String} name
     * @param {String} value
     */
    setOutputData(name, value) {
        var output = this.outputs[name];
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
    getOutputData(name) {
        var output = this.outputs[name];
        if (!output) {
            return null;
        }
        return output.value;
    }

    /**
     * Renames a global graph output
     * @method renameOutput
     * @param {String} old_name
     * @param {String} new_name
     */
    renameOutput(old_name, name) {
        if (!this.outputs[old_name]) {
            return false;
        }

        if (this.outputs[name]) {
            LiteGraph.error?.("there is already one output with that name");
            return false;
        }

        this.outputs[name] = this.outputs[old_name];
        delete this.outputs[old_name];
        this._version++;

        this.onOutputRenamed?.(old_name, name);
        this.onInputsOutputsChange?.();
    }

    /**
     * Changes the type of a global graph output
     * @method changeOutputType
     * @param {String} name
     * @param {String} type
     */
    changeOutputType(name, type) {
        if (!this.outputs[name]) {
            return false;
        }

        if (
            this.outputs[name].type &&
            String(this.outputs[name].type).toLowerCase() ==
                String(type).toLowerCase()
        ) {
            return;
        }

        this.outputs[name].type = type;
        this.onGraphChanged({action: "changeOutputType"});
        this.onOutputTypeChanged?.(name, type);
    }

    /**
     * Removes a global graph output
     * @method removeOutput
     * @param {String} name
     */
    removeOutput(name) {
        if (!this.outputs[name]) {
            return false;
        }
        delete this.outputs[name];
        this.onGraphChanged({action: "removeOutput"});

        this.onOutputRemoved?.(name);
        this.onInputsOutputsChange?.();
        return true;
    }

    /**
     * Triggers the 'onTrigger' method on nodes with a specific title by passing a value to them.
     * @param {string} name - The title of the nodes to trigger.
     * @param {any} value - The value to pass to the 'onTrigger' method of the nodes.
     */
    triggerInput(name, value) {
        var nodes = this.findNodesByTitle(name);
        for (var i = 0; i < nodes.length; ++i) {
            nodes[i].onTrigger(value);
        }
    }

    /**
     * Sets a callback function on nodes with a specific title by invoking their 'setTrigger' method.
     * @param {string} name - The title of the nodes to set the callback function on.
     * @param {Function} func - The callback function to be set on the nodes.
     */
    setCallback(name, func) {
        var nodes = this.findNodesByTitle(name);
        for (var i = 0; i < nodes.length; ++i) {
            nodes[i].setTrigger(func);
        }
    }

    /**
     * Executes actions before a change with the provided information detail.
     * Calls the 'onBeforeChange' function on the class instance and sends the action to connected GraphCanvas instances.
     * @param {object} info - The information detail about the change.
     */
    beforeChange(info) {
        this.onBeforeChange?.(this,info);
        this.sendActionToCanvas("onBeforeChange", this);
    }

    /**
     * Executes actions after a change with the provided information detail.
     * Calls the 'onAfterChange' function on the class instance and sends the action to connected GraphCanvas instances.
     * @param {object} info - The information detail about the change.
     */
    afterChange(info) {
        this.onAfterChange?.(this,info);
        this.sendActionToCanvas("onAfterChange", this);
    }

    /**
     * Handles changes in node connections and triggers related actions.
     * Updates the execution order, calls the 'onConnectionChange' function on the class instance and connected GraphCanvas instances, and increments the version.
     * @param {object} node - The node where the connection change occurred.
     * @param {object} link_info - Information about the changed connection.
     */
    connectionChange(node) {
        this.updateExecutionOrder();
        this.onConnectionChange?.(node);
        this.onGraphChanged({action: "connectionChange", doSave: false});
        this.sendActionToCanvas("onConnectionChange");
    }

    /**
     * returns if the graph is in live mode
     * @method isLive
     */
    isLive() {
        if (!this.list_of_graphcanvas) {
            return false;
        }

        for (var i = 0; i < this.list_of_graphcanvas.length; ++i) {
            var c = this.list_of_graphcanvas[i];
            if (c.live_mode) {
                return true;
            }
        }
        return false;
    }

    /**
     * clears the triggered slot animation in all links (stop visual animation)
     * @method clearTriggeredSlots
     */
    clearTriggeredSlots() {
        for (var i in this.links) {
            var link_info = this.links[i];
            if (!link_info) {
                continue;
            }
            link_info._last_time &&= 0;
        }
    }

    /**
     * Indicates a visual change in the graph (not the structure) and triggers related actions.
     * Logs a message if in debug mode, sends a 'setDirty' action with parameters to connected GraphCanvas instances, and calls the 'on_change' function on the class instance.
     * @method change
     */
    change() {
        LiteGraph.log?.("Graph visually changed");
        this.sendActionToCanvas("setDirty", [true, true]);
        this.on_change?.(this);
    }

    setDirtyCanvas(fg, bg) {
        this.sendActionToCanvas("setDirty", [fg, bg]);
    }

    /**
     * Destroys a link
     * @method removeLink
     * @param {Number} link_id
     */
    removeLink(link_id) {
        var link = this.links[link_id];
        if (!link) {
            return;
        }
        var node = this.getNodeById(link.target_id);
        if(node) {
            this.beforeChange();
            node.disconnectInput(link.target_slot); /* , optsIn */
            this.afterChange();
        }
    }

    /**
     * Creates a Object containing all the info about this graph, it can be serialized
     * @method serialize
     * @return {Object} value of the node
     */
    serialize() {
        const nodesInfo = this._nodes.map((node) => node.serialize());

        // pack link info into a non-verbose format
        var links = [];
        for (var i in this.links) {
            // links is an OBJECT
            var link = this.links[i];
            if (!link.serialize) {
                // weird bug I havent solved yet
                LiteGraph.warn?.("weird LLink bug, link info is not a LLink but a regular object");
                var link2 = new LiteGraph.LLink();
                for (var j in link) {
                    link2[j] = link[j];
                }
                this.links[i] = link2;
                link = link2;
            }

            links.push(link.serialize());
        }

        const groupsInfo = this._groups.map((group) => group.serialize());

        var data = {
            last_node_id: this.last_node_id,
            last_link_id: this.last_link_id,
            nodes: nodesInfo,
            links: links,
            groups: groupsInfo,
            config: this.config,
            extra: this.extra,
            version: LiteGraph.VERSION,
        };
        this.onSerialize?.(data);
        return data;
    }

    /**
     * Configure a graph from a JSON string
     * @method configure
     * @param {String} str configure a graph from a JSON string
     * @param {Boolean} returns if there was any error parsing
     */
    configure(data, keep_old) {
        if (!data) {
            return;
        }

        if (!keep_old) {
            this.clear();
        }

        var nodes = data.nodes;

        // decode links info (they are very verbose)
        if (data.links && data.links.constructor === Array) {
            var links = [];
            for (var i = 0; i < data.links.length; ++i) {
                var link_data = data.links[i];
                if(!link_data) { // @BUG: "weird bug" originally
                    LiteGraph.warn?.("serialized graph link data contains errors, skipping.");
                    continue;
                }
                var link = new LiteGraph.LLink();
                link.configure(link_data);
                links[link.id] = link;
            }
            data.links = links;
        }

        // copy all stored fields
        for (let i in data) {
            if (["nodes", "groups"].includes(i)) continue; // Accepts "nodes" and "groups"
            this[i] = data[i];
        }

        var error = false;

        // create nodes
        this._nodes = [];
        if (nodes) {
            for (let i = 0, l = nodes.length; i < l; ++i) {
                var n_info = nodes[i]; // stored info
                var node = LiteGraph.createNode(n_info.type, n_info.title);
                if (!node) {
                    LiteGraph.log?.(`Node not found or has errors: ${n_info.type}`);

                    // in case of error we create a replacement node to avoid losing info
                    node = new LiteGraph.LGraphNode();
                    node.last_serialization = n_info;
                    node.has_errors = true;
                    error = true;
                    // continue;
                }

                node.id = n_info.id; // id it or it will create a new id
                this.add(node, true, {doProcessChange: false}); // add before configure, otherwise configure cannot create links
            }

            // configure nodes afterwards so they can reach each other
            nodes.forEach((n_info) => {
                const node = this.getNodeById(n_info.id);
                node?.configure(n_info);
            });
        }

        // groups
        this._groups.length = 0;
        if (data.groups) {
            data.groups.forEach((groupData) => {
                const group = new LiteGraph.LGraphGroup();
                group.configure(groupData);
                this.add(group, true, {doProcessChange: false});
            });
        }

        this.updateExecutionOrder();

        this.extra = data.extra ?? {};

        this.onConfigure?.(data);
        // TODO implement: when loading (configuring) a whole graph, skip calling graphChanged on every single configure
        if (!data._version) {
            this.onGraphChanged({action: "graphConfigure", doSave: false}); // this._version++;
        } else {
            LiteGraph.debug?.("skip onGraphChanged when configure passing version too!"); // atlasan DEBUG REMOVE
        }
        this.setDirtyCanvas(true, true);
        return error;
    }

    /**
     * Loads graph data from a given URL or file and configures the graph accordingly.
     * @param {string | File | Blob} url - The URL or file to load the graph data from.
     * @param {Function} callback - An optional callback function to be executed after loading and configuring the graph.
     */
    load(url, callback) {
        var that = this;

        // from file
        if(url.constructor === File || url.constructor === Blob) {
            var reader = new FileReader();
            reader.addEventListener('load', (event) => {
                var data = JSON.parse(event.target.result);
                that.configure(data);
                callback?.();
            });
            reader.readAsText(url);
            return;
        }

        // is a string, then an URL
        var req = new XMLHttpRequest();
        req.open("GET", url, true);
        req.send(null);
        req.onload = (_event) => {
            if (req.status !== 200) {
                LiteGraph.error?.("Error loading graph:", req.status, req.response);
                return;
            }
            var data = JSON.parse( req.response );
            that.configure(data);
            callback?.();
        };
        req.onerror = (err) => {
            LiteGraph.error?.("Error loading graph:", err);
        };
    }

    /**
    * Meant to serve the history-saving mechanism
    * @method onGraphSaved
    * @param {object} optsIn options
    */
    onGraphSaved(optsIn = {}) {
        var optsDef = {};
        var opts = Object.assign(optsDef,optsIn);

        this.savedVersion = this._version;
    }

    /**
    * Meant to serve the history-saving mechanism
    * @method onGraphSaved
    * @param {object} optsIn options
    */
    onGraphLoaded(optsIn = {}) {
        var optsDef = {};
        var opts = Object.assign(optsDef,optsIn);
        this.savedVersion = this._version;
    }

    /**
    * Ment to be the history and prevent-exit mechanism, call to change _version
    * @method onGraphChanged
    * @param {object} optsIn options
    */
    onGraphChanged(optsIn = {}) {
        var optsDef = {
            action: "",
            doSave: true, // log action in graph.history
            doSaveGraph: true, // save
        };
        var opts = Object.assign(optsDef,optsIn);

        this._version++;

        if(opts.action) {
            LiteGraph.debug?.("Graph change",opts.action);
        } else {
            LiteGraph.debug?.("Graph change, no action",opts);
        }

        if(opts.doSave && LiteGraph.actionHistory_enabled) {

            LiteGraph.debug?.("onGraphChanged SAVE :: "+opts.action); // debug history

            var oHistory = { actionName: opts.action };
            if(opts.doSaveGraph) {
                oHistory = Object.assign(oHistory, { graphSave: this.serialize() }, // this is a heavy method, but the alternative is way more complex: every action has to have its contrary
                );
            }

            var obH = this.history;

            // check if pointer has gone back: remove newest
            while(obH.actionHistoryPtr < obH.actionHistoryVersions.length-1) {
                LiteGraph.debug?.("popping: gone back? "+(obH.actionHistoryPtr+" < "+(obH.actionHistoryVersions.length-1))); // debug history
                obH.actionHistoryVersions.pop();
            }
            // check if maximum saves
            if(obH.actionHistoryVersions.length>=LiteGraph.actionHistoryMaxSave) {
                var olderSave = obH.actionHistoryVersions.shift();
                LiteGraph.debug?.("maximum saves reached: "+obH.actionHistoryVersions.length+", remove older: "+olderSave); // debug history
                obH.actionHistory[olderSave] = false; // unset
            }

            // update pointer
            obH.actionHistoryPtr = obH.actionHistoryVersions.length;
            obH.actionHistoryVersions.push(obH.actionHistoryPtr);

            // save to pointer
            obH.actionHistory[obH.actionHistoryPtr] = oHistory;

            LiteGraph.debug?.("history saved: "+obH.actionHistoryPtr,oHistory.actionName); // debug history
        }
    }

    /**
    * Go back in action history
    * @method actionHistoryBack
    * @param {object} optsIn options
    */
    actionHistoryBack(optsIn = {}) {
        var optsDef = {};
        var opts = Object.assign(optsDef,optsIn);

        var obH = this.history;

        if (obH.actionHistoryPtr != undefined && obH.actionHistoryPtr >= 0) {
            obH.actionHistoryPtr--;
            LiteGraph.debug?.("history step back: "+obH.actionHistoryPtr); // debug history
            if (!this.actionHistoryLoad({iVersion: obH.actionHistoryPtr})) {
                LiteGraph.warn?.("historyLoad failed, restore pointer? "+obH.actionHistoryPtr); // debug history
                // history not found?
                obH.actionHistoryPtr++;
                return false;
            }else{
                LiteGraph.debug?.("history loaded back: "+obH.actionHistoryPtr); // debug history
                LiteGraph.debug?.(this.history);
                return true;
            }
        }else{
            LiteGraph.debug?.("history is already at older state");
            return false;
        }
    }

    /**
    * Go forward in action history
    * @method actionHistoryForward
    * @param {object} optsIn options
    */
    actionHistoryForward(optsIn = {}) {
        var optsDef = {};
        var opts = Object.assign(optsDef,optsIn);

        var obH = this.history;

        if (obH.actionHistoryPtr<obH.actionHistoryVersions.length) {
            obH.actionHistoryPtr++;
            LiteGraph.debug?.("history step forward: "+obH.actionHistoryPtr); // debug history
            if (!this.actionHistoryLoad({iVersion: obH.actionHistoryPtr})) {
                LiteGraph.warn?.("historyLoad failed, restore pointer? "+obH.actionHistoryPtr); // debug history
                // history not found?
                obH.actionHistoryPtr--;
                return false;
            }else{
                LiteGraph.debug?.("history loaded forward: "+obH.actionHistoryPtr); // debug history
                return true;
            }
        }else{
            LiteGraph.debug?.("history is already at newer state");
            return false;
        }
    }

    /**
    * Load from action history
    * @method actionHistoryLoad
    * @param {object} optsIn options
    */
    actionHistoryLoad(optsIn = {}) {
        var optsDef = {
            iVersion: false,
            backStep: false,
        };
        var opts = Object.assign(optsDef,optsIn);

        var obH = this.history;

        if(obH.actionHistory[opts.iVersion] && obH.actionHistory[opts.iVersion].graphSave) {
            var tmpHistory = JSON.stringify(this.history);
            this.configure( obH.actionHistory[opts.iVersion].graphSave );
            this.history = JSON.parse(tmpHistory);
            LiteGraph.debug?.("history loaded: "+opts.iVersion,obH.actionHistory[opts.iVersion].actionName); // debug history
            // no: this.onGraphLoaded();
            return true;
        }else{
            return false;
        }
    }
}
