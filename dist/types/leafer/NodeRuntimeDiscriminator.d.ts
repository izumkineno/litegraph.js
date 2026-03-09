import { MODERN_NODE_MARKER_KEY } from "./ModernNodeContracts";
export type NodeRenderRuntime = "legacy" | "modern";
export interface RuntimeDiscriminatorNodeLike {
    id?: number | string;
    renderRuntime?: NodeRenderRuntime;
    [MODERN_NODE_MARKER_KEY]?: boolean;
    mountContent?: unknown;
    patchContent?: unknown;
    getShellState?: unknown;
    defineActionParts?: unknown;
    getPortPresentation?: unknown;
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
export declare function discriminateNodeRuntime(node: RuntimeDiscriminatorNodeLike): NodeRenderRuntime;
