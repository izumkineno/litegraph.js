import "@leafer-in/arrow";

import { Group, Path } from "leafer-ui";
import type { IArrowStyle } from "@leafer-ui/interface";

import type { LinkCurveGeometry } from "./NodePortAdapter";

export interface LinkFlowPresentation {
    active?: boolean;
    color?: string;
    opacity?: number;
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
function isSameAttrValue(current: unknown, next: unknown): boolean {
    return Object.is(current, next);
}

function setAttrIfChanged(
    target: Record<string, unknown>,
    key: string,
    value: unknown
): void {
    if (isSameAttrValue(target[key], value)) {
        return;
    }
    target[key] = value;
}

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
    private flowOverlayActive = false;

    constructor(name: string, options: LinkViewHostOptions = {}) {
        void options;

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
        this.borderPath.visible = false;
        this.strokePath = this.createPath(`${name}:stroke`, "#9A9");
        this.flowPath = this.createPath(`${name}:flow`, "#FFF");
        this.flowPath.visible = false;
        this.view.add([this.borderPath, this.strokePath, this.flowPath]);
    }

    update(presentation: LinkViewPresentation): void {
        const curve = presentation.curve;
        const visible = presentation.visible !== false && Boolean(curve);
        const viewRecord = this.view as unknown as Record<string, unknown>;
        setAttrIfChanged(viewRecord, "visible", visible);

        if (!visible || !curve) {
            this.hideFlowOverlay();
            return;
        }

        const strokeWidth = Math.max(
            1,
            toFiniteNumber(presentation.strokeWidth, 3)
        );
        const stroke = presentation.stroke || "#9A9";
        const path = curve.path;
        const startArrow = presentation.startArrow || "none";
        const endArrow = presentation.endArrow || "none";
        const strokeRecord = this.strokePath as unknown as Record<string, unknown>;
        setAttrIfChanged(strokeRecord, "path", path);
        setAttrIfChanged(strokeRecord, "stroke", stroke);
        setAttrIfChanged(strokeRecord, "strokeWidth", strokeWidth);
        setAttrIfChanged(strokeRecord, "startArrow", startArrow);
        setAttrIfChanged(strokeRecord, "endArrow", endArrow);

        this.updateFlowOverlay(path, strokeWidth, presentation.flow);
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
        flow?: LinkFlowPresentation
    ): void {
        if (!flow?.active) {
            this.hideFlowOverlay();
            return;
        }

        const flowColor = flow.color || "#FFF";
        const flowOpacity = toOpacity(flow.opacity, 1);
        const flowPathRecord = this.flowPath as unknown as Record<string, unknown>;

        setAttrIfChanged(flowPathRecord, "visible", true);
        setAttrIfChanged(flowPathRecord, "path", path);
        setAttrIfChanged(flowPathRecord, "stroke", flowColor);
        setAttrIfChanged(flowPathRecord, "strokeWidth", strokeWidth);
        setAttrIfChanged(flowPathRecord, "opacity", flowOpacity);
        this.flowOverlayActive = true;
    }

    private hideFlowOverlay(): void {
        if (!this.flowOverlayActive) {
            return;
        }

        const flowPathRecord = this.flowPath as unknown as Record<string, unknown>;
        setAttrIfChanged(flowPathRecord, "visible", false);
        this.flowOverlayActive = false;
    }
}
