import {
    MODERN_NODE_MARKER_KEY,
    isModernNodeContract,
} from "../../modern/ModernNodeContracts";

export type NodeRenderRuntime = "legacy" | "modern";

export interface RuntimeDiscriminatorNodeLike {
    id?: number | string;
    renderRuntime?: NodeRenderRuntime;
    [MODERN_NODE_MARKER_KEY]?: boolean;
    mountView?: unknown;
    patchView?: unknown;
    consumeModernChangeMask?: unknown;
    requestModernPatch?: unknown;
    ensureModernPorts?: unknown;
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

    if (isModernNodeContract(node)) {
        return "modern";
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
