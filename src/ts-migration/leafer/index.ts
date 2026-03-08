export { ModernNodeBase } from "./ModernNodeBase";
export {
    MODERN_NODE_MARKER_KEY,
    MODERN_NODE_STATE_KEY,
    ModernNodeChangeMask,
    isModernNodeContract,
    type ModernActionPartCallbackContext,
    type ModernActionPartSchema,
    type ModernNodeChangeMaskValue,
    type ModernNodeLifecycleContext,
    type ModernNodePortDefinition,
    type ModernNodePortLayout,
    type ModernPortPresentation,
    type ModernNodePortSchema,
    type ModernNodeRuntimeLike,
    type ModernPortShape,
    type ModernShellState,
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
export { discriminateNodeRuntime } from "./NodeRuntimeDiscriminator";

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
