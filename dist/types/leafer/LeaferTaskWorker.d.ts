export type LeaferWorkerPoint = readonly [number, number];
export interface LeaferWorkerLinkCurve {
    readonly start: LeaferWorkerPoint;
    readonly end: LeaferWorkerPoint;
    readonly startDir: number;
    readonly endDir: number;
    readonly c1: LeaferWorkerPoint;
    readonly c2: LeaferWorkerPoint;
    readonly path: string;
}
export interface LeaferActiveLinkPresentationTask {
    readonly linkId: string;
    readonly start: LeaferWorkerPoint;
    readonly end: LeaferWorkerPoint;
    readonly startDir: number;
    readonly endDir: number;
    readonly lastTime: number;
}
export interface LeaferActiveLinkPresentationResult {
    readonly linkId: string;
    readonly layoutKey: string;
    readonly cacheKey: string;
    readonly active: boolean;
    readonly opacity: number;
    readonly curve: LeaferWorkerLinkCurve;
    readonly midpoint: LeaferWorkerPoint;
}
export declare class LeaferTaskWorker {
    static isSupported(): boolean;
    private readonly worker;
    private readonly workerUrl;
    private nextRequestId;
    private activeLinkPresentationListener;
    constructor(enabled?: boolean);
    destroy(): void;
    onActiveLinkPresentation(listener: ((requestId: number, results: ReadonlyArray<LeaferActiveLinkPresentationResult>) => void) | null): void;
    requestActiveLinkPresentations(now: number, tasks: ReadonlyArray<LeaferActiveLinkPresentationTask>): number | null;
}
