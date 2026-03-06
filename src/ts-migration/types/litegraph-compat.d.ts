/**
 * Compatibility facade declarations.
 * The source of truth now lives in:
 * - `src/ts-migration/compat/compat-schema.ts`
 * - `src/ts-migration/compat/compat-runtime.ts`
 */

export type {
    CompatCallback,
    ContextMenuCloseCompatHost,
    LGraphCanvasPrototypeCompatHost,
    LGraphCanvasStaticCompatHost,
    LGraphHooksCompatHost,
    LiteGraphApiCompatTargets,
    LiteGraphCompatArea,
    LiteGraphCompatAssemblyDiffId,
    LiteGraphCompatDiffId,
    LiteGraphCompatDiffItem,
    LiteGraphCompatRuntimeMode,
    LiteGraphConstantAliasHost,
    LiteGraphContextMenuCompatHost,
    SerializedLGraphGroupCompatInput,
    SerializedLGraphGroupDtsShape,
    SerializedLGraphGroupOrder,
    SerializedLGraphGroupRuntime,
    SerializedLLinkCompatInput,
    SerializedLLinkDtsInput,
    SerializedLLinkDtsOrder,
    SerializedLLinkOrder,
    SerializedLLinkRuntime,
    SerializedLLinkRuntimeInput,
    SerializedLLinkRuntimeOrder,
} from "../compat/compat-schema";

export {
    LITEGRAPH_API_DIFF_MATRIX,
    LITEGRAPH_COMPAT_DIFF_IDS,
} from "../compat/compat-schema";

export {
    applyContextMenuCloseAllCompat,
    applyLGraphCanvasPrototypeCompatShims,
    applyLGraphCanvasStaticCompat,
    applyLGraphCanvasStaticCompatAliases,
    applyLiteGraphApiCompatAliases,
    applyLiteGraphConstantAliases,
    denormalizeSerializedLGraphGroup,
    denormalizeSerializedLLinkTuple,
    invokeGraphOnNodeAddedCompatHook,
    isSerializedLLinkDtsOrder,
    normalizeSerializedLGraphGroup,
    normalizeSerializedLLinkTuple,
} from "../compat/compat-runtime";
