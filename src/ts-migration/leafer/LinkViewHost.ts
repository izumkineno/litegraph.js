import "@leafer-in/arrow";

import { Group, Path, Rect } from "leafer-ui";
import type { IArrowStyle } from "@leafer-ui/interface";

import type { LinkCurveGeometry } from "./NodePortAdapter";

export interface LinkFlowPresentation {
    active?: boolean;
    color?: string;
    opacity?: number;
    dotRadius?: number;
    dots?: ReadonlyArray<readonly [number, number]>;
}

export interface LinkViewPresentation {
    curve: LinkCurveGeometry | null;
    stroke?: string;
    strokeWidth?: number;
    visible?: boolean;
    startArrow?: IArrowStyle | "none";
    endArrow?: IArrowStyle | "none";
    flow?: LinkFlowPresentation;
}

interface LinkViewHostOptions {
    readonly view?: HTMLElement | null;
    readonly getViewportScale?: () => number;
}

const LINK_BORDER_COLOR = "transparent";
const LINK_BORDER_EXTRA_WIDTH = 0;
const LINK_FLOW_DOT_COUNT = 5;

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toOpacity(value: unknown, fallback = 1): number {
    return Math.max(0, Math.min(1, toFiniteNumber(value, fallback)));
}

export class LinkViewHost {
    readonly view: Group;

    private readonly borderPath: Path;
    private readonly strokePath: Path;
    private readonly flowPath: Path;
    private readonly flowDotLayer: Group;
    private readonly flowDots: Rect[] = [];
    private readonly getViewportScale: () => number;

    constructor(name: string, options: LinkViewHostOptions = {}) {
        this.getViewportScale = options.getViewportScale || (() => 1);

        this.view = new Group({
            name,
            hittable: false,
            visible: true,
            data: {
                litegraphPlaceholderKind: "link-view",
                litegraphRenderMode: "leafer-path",
            },
        });

        this.borderPath = this.createPath(`${name}:border`, LINK_BORDER_COLOR);
        this.strokePath = this.createPath(`${name}:stroke`, "#9A9");
        this.flowPath = this.createPath(`${name}:flow`, "#FFF");
        this.flowPath.visible = false;

        this.flowDotLayer = new Group({
            name: `${name}:flow-dots`,
            hittable: false,
            visible: false,
        });

        for (let index = 0; index < LINK_FLOW_DOT_COUNT; ++index) {
            const dot = new Rect({
                name: `${name}:flow-dot:${String(index)}`,
                width: 0,
                height: 0,
                cornerRadius: 999,
                fill: "#FFF",
                visible: false,
                hittable: false,
            });
            this.flowDots.push(dot);
            this.flowDotLayer.add(dot);
        }

        this.view.add([
            this.borderPath,
            this.strokePath,
            this.flowPath,
            this.flowDotLayer,
        ]);
    }

    update(presentation: LinkViewPresentation): void {
        const curve = presentation.curve;
        const visible = presentation.visible !== false && Boolean(curve);
        this.view.visible = visible;

        if (!visible || !curve) {
            this.hideFlowOverlay();
            return;
        }

        const strokeWidth = Math.max(
            1,
            toFiniteNumber(presentation.strokeWidth, 3)
        );
        const viewportScale = this.getViewportScale();
        void viewportScale;
        const stroke = presentation.stroke || "#9A9";
        const path = curve.path;
        const startArrow = presentation.startArrow || "none";
        const endArrow = presentation.endArrow || "none";

        this.borderPath.visible = false;
        this.borderPath.path = path;
        this.borderPath.strokeWidth = strokeWidth + LINK_BORDER_EXTRA_WIDTH;
        this.borderPath.startArrow = "none";
        this.borderPath.endArrow = "none";

        this.strokePath.path = path;
        this.strokePath.stroke = stroke;
        this.strokePath.strokeWidth = strokeWidth;
        this.strokePath.startArrow = startArrow;
        this.strokePath.endArrow = endArrow;

        this.updateFlowOverlay(
            path,
            strokeWidth,
            presentation.flow,
            startArrow,
            endArrow
        );
    }

    destroy(): void {
        this.view.destroy();
    }

    private createPath(name: string, stroke: string): Path {
        return new Path({
            name,
            hitFill: "none",
            hitStroke: "none",
            hittable: false,
            visible: true,
            stroke,
            strokeWidth: 3,
            strokeCap: "round",
            strokeJoin: "round",
        });
    }

    private updateFlowOverlay(
        path: string,
        strokeWidth: number,
        flow?: LinkFlowPresentation,
        startArrow: IArrowStyle | "none" = "none",
        endArrow: IArrowStyle | "none" = "none"
    ): void {
        if (!flow?.active) {
            this.hideFlowOverlay();
            return;
        }

        const flowColor = flow.color || "#FFF";
        const flowOpacity = toOpacity(flow.opacity, 1);
        const dotRadius = Math.max(1, toFiniteNumber(flow.dotRadius, 5));
        const dots = flow.dots || [];

        this.flowPath.visible = true;
        this.flowPath.path = path;
        this.flowPath.stroke = flowColor;
        this.flowPath.strokeWidth = strokeWidth;
        this.flowPath.opacity = flowOpacity;
        this.flowPath.startArrow = startArrow;
        this.flowPath.endArrow = endArrow;

        this.flowDotLayer.visible = dots.length > 0;
        for (let index = 0; index < this.flowDots.length; ++index) {
            const dot = this.flowDots[index];
            const point = dots[index];
            if (!point) {
                dot.visible = false;
                continue;
            }

            const diameter = dotRadius * 2;
            dot.visible = true;
            dot.fill = flowColor;
            dot.opacity = flowOpacity;
            dot.x = point[0] - dotRadius;
            dot.y = point[1] - dotRadius;
            dot.width = diameter;
            dot.height = diameter;
            dot.cornerRadius = dotRadius;
        }
    }

    private hideFlowOverlay(): void {
        this.flowPath.visible = false;
        this.flowPath.startArrow = "none";
        this.flowPath.endArrow = "none";
        this.flowDotLayer.visible = false;
        for (let index = 0; index < this.flowDots.length; ++index) {
            this.flowDots[index].visible = false;
        }
    }
}
