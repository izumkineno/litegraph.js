function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export interface RasterRenderScaleOptions {
    zoomScale: unknown;
    view?: HTMLElement | null;
    maxPixelRatio?: number;
}

export function resolveDevicePixelRatio(view?: HTMLElement | null): number {
    const windowRef = view?.ownerDocument?.defaultView || window;
    return Math.max(1, toFiniteNumber(windowRef.devicePixelRatio, 1));
}

export function resolveRasterRenderScale(
    options: RasterRenderScaleOptions
): number {
    const devicePixelRatio = resolveDevicePixelRatio(options.view);
    const zoomScale = Math.max(1, toFiniteNumber(options.zoomScale, 1));
    const maxPixelRatio = Math.max(
        devicePixelRatio,
        toFiniteNumber(options.maxPixelRatio, 4)
    );
    const scaledRatio = devicePixelRatio * zoomScale;

    return clamp(Math.ceil(scaledRatio * 2) / 2, devicePixelRatio, maxPixelRatio);
}
