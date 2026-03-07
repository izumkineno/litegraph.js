export interface LegacyNodePainterNodeLike {
    id: number | string;
    pos: [number, number];
    size: [number, number];
    flags?: {
        collapsed?: boolean;
        [key: string]: unknown;
    };
    getTitle?: () => string;
    getBounding?: (
        out?: Float32Array | [number, number, number, number],
        computeOuter?: boolean
    ) => Float32Array | [number, number, number, number];
    computeSize?: () => [number, number] | Float32Array;
    [key: string]: unknown;
}

export interface LegacyNodeRenderHost {
    canvas?: HTMLCanvasElement | null;
    drawNode: (
        node: LegacyNodePainterNodeLike,
        ctx: CanvasRenderingContext2D
    ) => void;
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

const DEFAULT_PADDING = 8;
const DEFAULT_NODE_TITLE_HEIGHT = 30;
const DEFAULT_NODE_WIDTH = 140;
const DEFAULT_NODE_HEIGHT = 80;
const DEFAULT_OVERFLOW_MARGIN = 32;

function getLegacyConstants(renderHost: LegacyNodeRenderHost): Record<string, unknown> {
    const maybeConstants = (renderHost as {
        constants?: () => Record<string, unknown>;
    }).constants;
    return typeof maybeConstants === "function" ? maybeConstants.call(renderHost) : {};
}

function getNodeTitleHeight(renderHost: LegacyNodeRenderHost): number {
    const constants = getLegacyConstants(renderHost);
    const titleHeight = Number(constants.NODE_TITLE_HEIGHT);
    return Number.isFinite(titleHeight) ? titleHeight : DEFAULT_NODE_TITLE_HEIGHT;
}

function getCollapsedWidth(
    node: LegacyNodePainterNodeLike,
    renderHost: LegacyNodeRenderHost,
    context?: CanvasRenderingContext2D | null
): number {
    if (!node.flags?.collapsed) {
        return Number(node.size?.[0]) || DEFAULT_NODE_WIDTH;
    }

    const title = node.getTitle?.() || String(node.title || "");
    const baseWidth = Number(node.size?.[0]) || DEFAULT_NODE_WIDTH;
    if (!title || !context) {
        return baseWidth;
    }

    const titleHeight = getNodeTitleHeight(renderHost);
    context.save();
    context.font =
        String((renderHost as { inner_text_font?: string }).inner_text_font) ||
        `normal 12px Arial`;
    const measuredWidth =
        context.measureText(title).width + titleHeight * 2;
    context.restore();

    return Math.min(baseWidth, Math.ceil(measuredWidth));
}

export class LegacyNodePainter {
    static measure(
        node: LegacyNodePainterNodeLike,
        renderHost: LegacyNodeRenderHost,
        context?: CanvasRenderingContext2D | null
    ): LegacyNodePaintBounds {
        const padding = DEFAULT_PADDING;
        const titleHeight = getNodeTitleHeight(renderHost);
        let width = Math.max(
            DEFAULT_NODE_WIDTH,
            getCollapsedWidth(node, renderHost, context)
        );
        let bodyHeight = Math.max(
            node.flags?.collapsed
                ? titleHeight
                : Number(node.size?.[1]) || DEFAULT_NODE_HEIGHT,
            titleHeight
        );
        const computedSize =
            !node.flags?.collapsed && typeof node.computeSize === "function"
                ? node.computeSize()
                : null;
        if (computedSize) {
            width = Math.max(width, Number(computedSize[0]) || 0);
            bodyHeight = Math.max(bodyHeight, Number(computedSize[1]) || 0);
        }

        const defaultLeft = (Number(node.pos?.[0]) || 0) - padding;
        const defaultTop =
            (Number(node.pos?.[1]) || 0) - titleHeight - padding;
        const defaultRight = defaultLeft + width + padding * 2;
        const defaultBottom =
            defaultTop + bodyHeight + titleHeight + padding * 2;

        let left = defaultLeft;
        let top = defaultTop;
        let right = defaultRight;
        let bottom = defaultBottom;

        if (typeof node.getBounding === "function") {
            const bounding = node.getBounding(undefined, true);
            const boundLeft = Number(bounding[0]);
            const boundTop = Number(bounding[1]);
            const boundWidth = Number(bounding[2]);
            const boundHeight = Number(bounding[3]);
            if (
                Number.isFinite(boundLeft) &&
                Number.isFinite(boundTop) &&
                Number.isFinite(boundWidth) &&
                Number.isFinite(boundHeight)
            ) {
                left = Math.min(left, boundLeft);
                top = Math.min(top, boundTop);
                right = Math.max(right, boundLeft + boundWidth);
                bottom = Math.max(bottom, boundTop + boundHeight);
            }
        }

        left -= DEFAULT_OVERFLOW_MARGIN;
        top -= DEFAULT_OVERFLOW_MARGIN;
        right += DEFAULT_OVERFLOW_MARGIN;
        bottom += DEFAULT_OVERFLOW_MARGIN;

        const normalizedLeft = Math.floor(left);
        const normalizedTop = Math.floor(top);
        const contentOffsetX = (Number(node.pos?.[0]) || 0) - normalizedLeft;
        const contentOffsetY = (Number(node.pos?.[1]) || 0) - normalizedTop;

        return {
            x: normalizedLeft,
            y: normalizedTop,
            width: Math.ceil(right - left),
            height: Math.ceil(bottom - top),
            contentOffsetX,
            contentOffsetY,
            padding,
            titleHeight,
        };
    }

    static drawNode(
        renderHost: LegacyNodeRenderHost,
        node: LegacyNodePainterNodeLike,
        context: CanvasRenderingContext2D
    ): void {
        renderHost.drawNode(node, context);
    }

    static drawNodeShape(
        renderHost: LegacyNodeRenderHost,
        ...args: unknown[]
    ): void {
        renderHost.drawNodeShape?.(...args);
    }

    static drawNodeWidgets(
        renderHost: LegacyNodeRenderHost,
        ...args: unknown[]
    ): void {
        renderHost.drawNodeWidgets?.(...args);
    }

    static paint(
        node: LegacyNodePainterNodeLike,
        renderHost: LegacyNodeRenderHost,
        context: CanvasRenderingContext2D,
        bounds?: LegacyNodePaintBounds
    ): LegacyNodePaintBounds {
        const resolvedBounds = bounds || this.measure(node, renderHost, context);

        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, resolvedBounds.width, resolvedBounds.height);
        context.translate(
            resolvedBounds.contentOffsetX,
            resolvedBounds.contentOffsetY
        );
        this.drawNode(renderHost, node, context);
        context.restore();

        return resolvedBounds;
    }
}
