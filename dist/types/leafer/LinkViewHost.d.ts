import "@leafer-in/arrow";
import { Group } from "leafer-ui";
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
export declare class LinkViewHost {
    readonly view: Group;
    private readonly borderPath;
    private readonly strokePath;
    private readonly flowPath;
    private flowOverlayActive;
    constructor(name: string, options?: LinkViewHostOptions);
    update(presentation: LinkViewPresentation): void;
    destroy(): void;
    private createPath;
    private updateFlowOverlay;
    private hideFlowOverlay;
}
export {};
