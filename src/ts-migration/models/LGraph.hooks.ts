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
 * d.ts 中 `LGraph.onNodeAdded(node)` 为显式契约，运行时实现中按 truthy 回调触发：
 * `if (this.onNodeAdded) { this.onNodeAdded(node); }`
 * 为保持与原 JS 一致，这里不对非函数 truthy 值做额外防御，保持原有异常语义。
 */
export function invokeGraphOnNodeAddedCompatHook<TNode = unknown>(
    graph: LGraphHooksCompatHost<TNode>,
    node: TNode
): boolean {
    const rawHook = (graph as Record<string, unknown>).onNodeAdded;
    if (!rawHook) {
        return false;
    }
    (rawHook as (node: TNode) => void)(node);
    return true;
}
