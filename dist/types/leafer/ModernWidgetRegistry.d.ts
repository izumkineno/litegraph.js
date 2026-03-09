import { type ModernWidgetRectLike, type ModernWidgetRenderer } from "./index";
export declare function ensureDefaultModernWidgetRenderers(): void;
export declare function resolveModernWidgetRenderer(type: string): ModernWidgetRenderer | undefined;
export declare function resolveWidgetBounds(bodyBounds: ModernWidgetRectLike, index: number, count: number): ModernWidgetRectLike;
export type { ModernWidgetRenderer };
