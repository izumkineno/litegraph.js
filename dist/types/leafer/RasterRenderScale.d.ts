export interface RasterRenderScaleOptions {
    zoomScale: unknown;
    view?: HTMLElement | null;
    maxPixelRatio?: number;
}
export declare function resolveDevicePixelRatio(view?: HTMLElement | null): number;
export declare function resolveRasterRenderScale(options: RasterRenderScaleOptions): number;
