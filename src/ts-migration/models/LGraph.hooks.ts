export const LGRAPH_ON_NODE_ADDED_DIFF_ID = "graph-hooks.on-node-added" as const;

export interface LGraphHooksCompatHost<TNode = unknown> {
    onNodeAdded?: ((node: TNode) => void) | null;
    [key: string]: unknown;
}

export function hasGraphOnNodeAddedCompatHook<TNode = unknown>(
    graph: LGraphHooksCompatHost<TNode>
): graph is LGraphHooksCompatHost<TNode> & {
    onNodeAdded: (node: TNode) => void;
} {
    return typeof graph.onNodeAdded === "function";
}

/**
 * Task 41 compatibility helper:
 * d.ts 中 `LGraph.onNodeAdded(node)` 为显式契约，运行时实现中则按可选回调触发。
 * 该 helper 统一为“安全触发”：仅当 hook 为函数时调用，且不吞掉用户 hook 抛错。
 */
export function invokeGraphOnNodeAddedCompatHook<TNode = unknown>(
    graph: LGraphHooksCompatHost<TNode>,
    node: TNode
): boolean {
    if (!hasGraphOnNodeAddedCompatHook(graph)) {
        return false;
    }
    graph.onNodeAdded(node);
    return true;
}
