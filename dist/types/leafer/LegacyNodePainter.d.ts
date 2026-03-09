export interface LegacyNodePainterNodeLike {
    id: number | string;
    pos: [number, number];
    size: [number, number];
    flags?: {
        collapsed?: boolean;
        [key: string]: unknown;
    };
    getTitle?: () => string;
    getBounding?: (out?: Float32Array | [number, number, number, number], computeOuter?: boolean) => Float32Array | [number, number, number, number];
    computeSize?: () => [number, number] | Float32Array;
    [key: string]: unknown;
}
export interface LegacyNodeRenderHost {
    canvas?: HTMLCanvasElement | null;
    drawNode: (node: LegacyNodePainterNodeLike, ctx: CanvasRenderingContext2D) => void;
    drawNodeShape?: (...args: unknown[]) => unknown;
    drawNodeWidgets?: (...args: unknown[]) => unknown;
    [key: string]: unknown;
}
export interface LegacyNodePaintBounds {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly contentOffsetX: number;
    readonly contentOffsetY: number;
    readonly padding: number;
    readonly titleHeight: number;
}
export declare class LegacyNodePainter {
    static measure(node: LegacyNodePainterNodeLike, renderHost: LegacyNodeRenderHost, context?: CanvasRenderingContext2D | null): LegacyNodePaintBounds;
    static drawNode(renderHost: LegacyNodeRenderHost, node: LegacyNodePainterNodeLike, context: CanvasRenderingContext2D): void;
    static drawNodeShape(renderHost: LegacyNodeRenderHost, ...args: unknown[]): void;
    static drawNodeWidgets(renderHost: LegacyNodeRenderHost, ...args: unknown[]): void;
    static paint(node: LegacyNodePainterNodeLike, renderHost: LegacyNodeRenderHost, context: CanvasRenderingContext2D, bounds?: LegacyNodePaintBounds, renderScale?: number): LegacyNodePaintBounds;
}
