import type { Vector2 } from "../types/core-types";
import type { GraphCanvasViewportPort } from "../contracts/canvas";
import { LGraphNodeConnectGeometry } from "./LGraphNode.connect-geometry";
type ReadyImage = HTMLImageElement & {
    ready: boolean;
};
/**
 * LGraphNode canvas-collaboration methods.
 * Source: `alignToGrid/trace/setDirtyCanvas/loadImage/executeAction/captureInput/collapse/pin/localToScreen`.
 */
export declare class LGraphNodeCanvasCollab extends LGraphNodeConnectGeometry {
    console?: string[];
    private canvasGraphRef;
    private routeDirtySignalToLeaferRuntime;
    alignToGrid(): void;
    trace(msg: string): void;
    setDirtyCanvas(dirty_foreground: boolean, dirty_background?: boolean): void;
    loadImage(url: string): ReadyImage;
    captureInput(v: any): void;
    /**
     * Collapse the node to make it smaller on the canvas
     * @method collapse
     **/
    collapse(force: boolean): void;
    /**
     * Forces the node to do not move or realign on Z
     * @method pin
     **/
    pin(v?: boolean): void;
    localToScreen(x: number, y: number, graphCanvas: GraphCanvasViewportPort): Vector2;
}
export {};
