export type NodeRenderRuntime = "legacy" | "modern";

export interface RuntimeDiscriminatorNodeLike {
    id?: number | string;
    renderRuntime?: NodeRenderRuntime;
    buildUI?: unknown;
    updateUI?: unknown;
    renderLeafer?: unknown;
    getPortLayout?: unknown;
    [key: string]: unknown;
}

export function discriminateNodeRuntime(
    node: RuntimeDiscriminatorNodeLike
): NodeRenderRuntime {
    if (node.renderRuntime === "legacy" || node.renderRuntime === "modern") {
        return node.renderRuntime;
    }

    if (
        typeof node.buildUI === "function" ||
        typeof node.updateUI === "function" ||
        typeof node.renderLeafer === "function" ||
        typeof node.getPortLayout === "function"
    ) {
        return "modern";
    }

    return "legacy";
}
