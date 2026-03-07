export type NodeRenderRuntime = "legacy" | "modern";

export interface RuntimeDiscriminatorNodeLike {
    id?: number | string;
    [key: string]: unknown;
}

export function discriminateNodeRuntime(
    _node: RuntimeDiscriminatorNodeLike
): NodeRenderRuntime {
    return "legacy";
}
