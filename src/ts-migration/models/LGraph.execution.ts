// TODO: Import LGraphNode from its future module

import { LGraph, type LiteGraphLifecycleHost } from "./LGraph.lifecycle";

interface LiteGraphExecutionHost extends LiteGraphLifecycleHost {
    use_deferred_actions: boolean;
    ALWAYS: number;
    throw_errors: boolean;
    NODE_TITLE_HEIGHT: number;
    VERTICAL_LAYOUT: string;
}

const defaultExecutionHost: LiteGraphExecutionHost = {
    debug: false,
    getTime: () => Date.now(),
    use_deferred_actions: true,
    ALWAYS: 0,
    throw_errors: true,
    NODE_TITLE_HEIGHT: 30,
    VERTICAL_LAYOUT: "vertical",
};

interface GraphInputSlot {
    link: number | null;
}

interface GraphOutputSlot {
    links: number[] | null;
}

interface GraphLinkLike {
    id: number;
    target_id: number;
}

interface GraphNodeExecutionLike {
    id: number;
    mode: number;
    onExecute?: () => void;
    doExecute?: () => void;
    _waiting_actions?: unknown[];
    executePendingActions?: () => void;
    inputs?: Array<GraphInputSlot | null>;
    outputs?: Array<GraphOutputSlot | null>;
    _level?: number;
    order: number;
    constructor: { priority?: number };
    priority?: number;
    getInputNode?: (index: number) => GraphNodeExecutionLike | null;
    pos: [number, number];
    size: [number, number];
}

/**
 * LGraph execution-order and run-loop methods.
 * Source: `runStep/updateExecutionOrder/computeExecutionOrder/getAncestors/arrange`.
 */
export class LGraphExecution extends LGraph {
    errors_in_execution = false;
    execution_time = 0;
    onExecuteStep?: () => void;
    onAfterExecute?: () => void;

    private getExecutionHost(): LiteGraphExecutionHost {
        const ctor = this.constructor as {
            liteGraph?: Partial<LiteGraphExecutionHost>;
        };
        const host =
            (ctor.liteGraph ||
                (LGraphExecution as unknown as {
                    liteGraph?: Partial<LiteGraphExecutionHost>;
                }).liteGraph ||
                (LGraph as unknown as {
                    liteGraph?: Partial<LiteGraphExecutionHost>;
                }).liteGraph ||
                {}) as Partial<LiteGraphExecutionHost>;
        return { ...defaultExecutionHost, ...host };
    }

    private getNodeByIdExecution(id: number): GraphNodeExecutionLike | null {
        return (this._nodes_by_id[id] as GraphNodeExecutionLike) || null;
    }

    /**
     * Run N steps (cycles) of the graph
     * @method runStep
     * @param {number} num number of steps to run, default is 1
     * @param {Boolean} do_not_catch_errors [optional] if you want to try/catch errors
     * @param {number} limit max number of nodes to execute (used to execute from start to a node)
     */
    runStep(num?: number, do_not_catch_errors?: boolean, limit?: number): void {
        const liteGraph = this.getExecutionHost();

        num = num || 1;

        const start = liteGraph.getTime();
        this.globaltime = 0.001 * (start - this.starttime);

        // not optimal: executes possible pending actions in node, problem is it is not optimized
        // it is done here as if it was done in the later loop it wont be called in the node missed the onExecute

        // from now on it will iterate only on executable nodes which is faster
        const nodes = (this._nodes_executable
            ? this._nodes_executable
            : this._nodes) as GraphNodeExecutionLike[] | null;
        if (!nodes) {
            return;
        }

        limit = limit || nodes.length;

        if (do_not_catch_errors) {
            // iterations
            for (let i = 0; i < num; i++) {
                for (let j = 0; j < limit; ++j) {
                    const node = nodes[j];
                    if (
                        liteGraph.use_deferred_actions &&
                        node._waiting_actions &&
                        node._waiting_actions.length &&
                        node.executePendingActions
                    ) {
                        node.executePendingActions();
                    }
                    if (node.mode == liteGraph.ALWAYS && node.onExecute) {
                        // wrap node.onExecute();
                        if (node.doExecute) {
                            node.doExecute();
                        } else {
                            node.onExecute();
                        }
                    }
                }

                this.fixedtime += this.fixedtime_lapse;
                if (this.onExecuteStep) {
                    this.onExecuteStep();
                }
            }

            if (this.onAfterExecute) {
                this.onAfterExecute();
            }
        } else {
            // catch errors
            try {
                // iterations
                for (let i = 0; i < num; i++) {
                    for (let j = 0; j < limit; ++j) {
                        const node = nodes[j];
                        if (
                            liteGraph.use_deferred_actions &&
                            node._waiting_actions &&
                            node._waiting_actions.length &&
                            node.executePendingActions
                        ) {
                            node.executePendingActions();
                        }
                        if (node.mode == liteGraph.ALWAYS && node.onExecute) {
                            node.onExecute();
                        }
                    }

                    this.fixedtime += this.fixedtime_lapse;
                    if (this.onExecuteStep) {
                        this.onExecuteStep();
                    }
                }

                if (this.onAfterExecute) {
                    this.onAfterExecute();
                }
                this.errors_in_execution = false;
            } catch (err) {
                this.errors_in_execution = true;
                if (liteGraph.throw_errors) {
                    throw err;
                }
                if (liteGraph.debug) {
                    console.log("Error during execution: " + err);
                }
                this.stop();
            }
        }

        const now = liteGraph.getTime();
        let elapsed = now - start;
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
        this.nodes_executedAction = [];
    }

    /**
     * Updates the graph execution order according to relevance of the nodes (nodes with only outputs have more relevance than
     * nodes with only inputs.
     * @method updateExecutionOrder
     */
    updateExecutionOrder(): void {
        this._nodes_in_order = this.computeExecutionOrder(false);
        this._nodes_executable = [];
        for (let i = 0; i < this._nodes_in_order.length; ++i) {
            const node = this._nodes_in_order[i] as GraphNodeExecutionLike;
            if (node.onExecute) {
                this._nodes_executable.push(node as unknown as (typeof this._nodes_executable)[number]);
            }
        }
    }

    // This is more internal, it computes the executable nodes in order and returns it
    computeExecutionOrder(
        only_onExecute?: boolean,
        set_level?: boolean
    ): GraphNodeExecutionLike[] {
        let L: GraphNodeExecutionLike[] = [];
        const S: GraphNodeExecutionLike[] = [];
        const M: Record<number, GraphNodeExecutionLike> = {};
        const visited_links: Record<number, boolean> = {}; // to avoid repeating links
        const remaining_links: Record<number, number> = {}; // to a

        // search for the nodes without inputs (starting nodes)
        for (let i = 0, l = this._nodes.length; i < l; ++i) {
            const node = this._nodes[i] as GraphNodeExecutionLike;
            if (only_onExecute && !node.onExecute) {
                continue;
            }

            M[node.id] = node; // add to pending nodes

            let num = 0; // num of input connections
            if (node.inputs) {
                for (let j = 0, l2 = node.inputs.length; j < l2; j++) {
                    if (node.inputs[j] && node.inputs[j]!.link != null) {
                        num += 1;
                    }
                }
            }

            if (num == 0) {
                // is a starting node
                S.push(node);
                if (set_level) {
                    node._level = 1;
                }
            } // num of input links
            else {
                if (set_level) {
                    node._level = 0;
                }
                remaining_links[node.id] = num;
            }
        }

        while (true) {
            if (S.length == 0) {
                break;
            }

            // get an starting node
            const node = S.shift()!;
            L.push(node); // add to ordered list
            delete M[node.id]; // remove from the pending nodes

            if (!node.outputs) {
                continue;
            }

            // for every output
            for (let i = 0; i < node.outputs.length; i++) {
                const output = node.outputs[i];
                // not connected
                if (
                    output == null ||
                    output.links == null ||
                    output.links.length == 0
                ) {
                    continue;
                }

                // for every connection
                for (let j = 0; j < output.links.length; j++) {
                    const link_id = output.links[j];
                    const link = this.links[link_id] as GraphLinkLike | undefined;
                    if (!link) {
                        continue;
                    }

                    // already visited link (ignore it)
                    if (visited_links[link.id]) {
                        continue;
                    }

                    const target_node = this.getNodeByIdExecution(link.target_id);
                    if (target_node == null) {
                        visited_links[link.id] = true;
                        continue;
                    }

                    if (
                        set_level &&
                        (!target_node._level || target_node._level <= node._level!)
                    ) {
                        target_node._level = node._level! + 1;
                    }

                    visited_links[link.id] = true; // mark as visited
                    remaining_links[target_node.id] -= 1; // reduce the number of links remaining
                    if (remaining_links[target_node.id] == 0) {
                        S.push(target_node);
                    } // if no more links, then add to starters array
                }
            }
        }

        // the remaining ones (loops)
        for (const i in M) {
            L.push(M[i]);
        }

        if (L.length != this._nodes.length && this.getExecutionHost().debug) {
            console.warn("something went wrong, nodes missing");
        }

        const l = L.length;

        // save order number in the node
        for (let i = 0; i < l; ++i) {
            L[i].order = i;
        }

        // sort now by priority
        L = L.sort(function(A, B) {
            const Ap = A.constructor.priority || A.priority || 0;
            const Bp = B.constructor.priority || B.priority || 0;
            if (Ap == Bp) {
                // if same priority, sort by order
                return A.order - B.order;
            }
            return Ap - Bp; // sort by priority
        });

        // save order number in the node, again...
        for (let i = 0; i < l; ++i) {
            L[i].order = i;
        }

        return L;
    }

    /**
     * Returns all the nodes that could affect this one (ancestors) by crawling all the inputs recursively.
     * It doesn't include the node itself
     * @method getAncestors
     * @return {Array} an array with all the LGraphNodes that affect this node, in order of execution
     */
    getAncestors(node: GraphNodeExecutionLike): GraphNodeExecutionLike[] {
        const ancestors: GraphNodeExecutionLike[] = [];
        const pending: GraphNodeExecutionLike[] = [node];
        const visited: Record<number, boolean> = {};

        while (pending.length) {
            const current = pending.shift()!;
            if (!current.inputs) {
                continue;
            }
            if (!visited[current.id] && current != node) {
                visited[current.id] = true;
                ancestors.push(current);
            }

            if (current.getInputNode) {
                for (let i = 0; i < current.inputs.length; ++i) {
                    const input = current.getInputNode(i);
                    if (input && ancestors.indexOf(input) == -1) {
                        pending.push(input);
                    }
                }
            }
        }

        ancestors.sort(function(a, b) {
            return a.order - b.order;
        });
        return ancestors;
    }

    /**
     * Positions every node in a more readable manner
     * @method arrange
     */
    arrange(margin?: number, layout?: string): void {
        const liteGraph = this.getExecutionHost();
        margin = margin || 100;

        const nodes = this.computeExecutionOrder(false, true);
        const columns: GraphNodeExecutionLike[][] = [];
        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            const col = node._level || 1;
            if (!columns[col]) {
                columns[col] = [];
            }
            columns[col].push(node);
        }

        let x = margin;

        for (let i = 0; i < columns.length; ++i) {
            const column = columns[i];
            if (!column) {
                continue;
            }
            let max_size = 100;
            let y = margin + liteGraph.NODE_TITLE_HEIGHT;
            for (let j = 0; j < column.length; ++j) {
                const node = column[j];
                node.pos[0] = layout == liteGraph.VERTICAL_LAYOUT ? y : x;
                node.pos[1] = layout == liteGraph.VERTICAL_LAYOUT ? x : y;
                const max_size_index =
                    layout == liteGraph.VERTICAL_LAYOUT ? 1 : 0;
                if (node.size[max_size_index] > max_size) {
                    max_size = node.size[max_size_index];
                }
                const node_size_index =
                    layout == liteGraph.VERTICAL_LAYOUT ? 0 : 1;
                y += node.size[node_size_index] + margin + liteGraph.NODE_TITLE_HEIGHT;
            }
            x += max_size + margin;
        }

        const self = this as unknown as { setDirtyCanvas?: (fg: boolean, bg: boolean) => void };
        if (self.setDirtyCanvas) {
            self.setDirtyCanvas(true, true);
        }
    }
}
