import { type LGraphHooksCompatHost } from "../compat/compat-schema";
export declare const LGRAPH_ON_NODE_ADDED_DIFF_ID: "graph-hooks.on-node-added";
export declare function hasGraphOnNodeAddedCompatHook<TNode = unknown>(graph: LGraphHooksCompatHost<TNode>): graph is LGraphHooksCompatHost<TNode> & {
    onNodeAdded: (node: TNode) => void;
};
/**
 * Task 41 compatibility helper:
 * d.ts 中 `LGraph.onNodeAdded(node)` 为显式契约，运行时实现中按 truthy 回调触发：
 * `if (this.onNodeAdded) { this.onNodeAdded(node); }`
 * 为保持与原 JS 一致，这里不对非函数 truthy 值做额外防御，保持原有异常语义。
 */
export declare function invokeGraphOnNodeAddedCompatHook<TNode = unknown>(graph: LGraphHooksCompatHost<TNode>, node: TNode): boolean;
