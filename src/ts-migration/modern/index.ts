export { ModernNodeBase } from "./ModernNodeBase";
export {
    MODERN_NODE_MARKER_KEY,
    MODERN_NODE_STATE_KEY,
    ModernNodeChangeMask,
    isModernNodeContract,
    type ModernNodeChangeMaskValue,
    type ModernNodeLifecycleContext,
    type ModernNodePortDefinition,
    type ModernNodePortLayout,
    type ModernNodePortSchema,
    type ModernNodeRuntimeLike,
} from "./ModernNodeContracts";
export {
    attachModernNodeRegistryApi,
    registerModernNode,
    registerModernNodes,
    registerModernWidget,
    registerModernWidgets,
    getModernWidgetRenderer,
    type ModernNodeConstructorLike,
    type ModernNodeRegistryLiteGraphLike,
} from "./ModernNodeRegistry";
export type {
    ModernWidgetActionContext,
    ModernWidgetActionResult,
    ModernWidgetHit,
    ModernWidgetRectLike,
    ModernWidgetRenderContext,
    ModernWidgetRenderer,
    ModernWidgetSchema,
    ModernWidgetViewHandle,
} from "./ModernWidgetContracts";

import {
    MODERN_NODE_MARKER_KEY,
    MODERN_NODE_STATE_KEY,
    ModernNodeChangeMask,
} from "./ModernNodeContracts";

export const ModernNodeContracts = {
    MODERN_NODE_MARKER_KEY,
    MODERN_NODE_STATE_KEY,
    ModernNodeChangeMask,
} as const;
