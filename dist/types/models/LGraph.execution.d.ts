import type { LGraphNodeCanvasCollab as LGraphNode } from "./LGraphNode.canvas-collab";
import { LGraph } from "./LGraph.lifecycle";
interface GraphInputSlot {
    link: number | null;
}
interface GraphOutputSlot {
    links: number[] | null;
}
type GraphNodeExecutionBase = Pick<LGraphNode, "id" | "mode" | "onExecute" | "doExecute" | "getInputNode" | "pos" | "size">;
interface GraphNodeExecutionLike extends GraphNodeExecutionBase {
    _waiting_actions?: unknown[];
    executePendingActions?: () => void;
    inputs?: Array<GraphInputSlot | null>;
    outputs?: Array<GraphOutputSlot | null>;
    _level?: number;
    order: number;
    constructor: {
        priority?: number;
    };
    priority?: number;
}
/**
 * LGraph execution-order and run-loop methods.
 * Source: `runStep/updateExecutionOrder/computeExecutionOrder/getAncestors/arrange`.
 */
export declare class LGraphExecution extends LGraph {
    errors_in_execution: boolean;
    execution_time: number;
    onExecuteStep?: () => void;
    onAfterExecute?: () => void;
    private getNodeByIdExecution;
    flushRuntimeExecutionRender(): void;
    protected afterExecutionTick(): void;
    protected flushInternalSceneBatch(): void;
    /**
     * Run N steps (cycles) of the graph
     * @method runStep
     * @param {number} num number of steps to run, default is 1
     * @param {Boolean} do_not_catch_errors [optional] if you want to try/catch errors
     * @param {number} limit max number of nodes to execute (used to execute from start to a node)
     */
    runStep(num?: number, do_not_catch_errors?: boolean, limit?: number): void;
    /**
     * Updates the graph execution order according to relevance of the nodes (nodes with only outputs have more relevance than
     * nodes with only inputs.
     * @method updateExecutionOrder
     */
    updateExecutionOrder(): void;
    private applyExecutionOrderNow;
    computeExecutionOrder(only_onExecute?: boolean, set_level?: boolean): GraphNodeExecutionLike[];
    /**
     * Returns all the nodes that could affect this one (ancestors) by crawling all the inputs recursively.
     * It doesn't include the node itself
     * @method getAncestors
     * @return {Array} an array with all the LGraphNodes that affect this node, in order of execution
     */
    getAncestors(node: GraphNodeExecutionLike): GraphNodeExecutionLike[];
    /**
     * Positions every node in a more readable manner
     * @method arrange
     */
    arrange(margin?: number, layout?: string): void;
}
export {};
