import { Group } from "leafer-ui";
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
    private readonly flowDotLayer;
    private readonly flowDots;
    private readonly getViewportScale;
    constructor(name: string, options?: LinkViewHostOptions);
    update(presentation: LinkViewPresentation): void;
    destroy(): void;
    private createPath;
    private updateFlowOverlay;
    private hideFlowOverlay;
}
export {};
