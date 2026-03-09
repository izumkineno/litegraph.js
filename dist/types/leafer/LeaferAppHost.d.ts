import "@leafer-in/state";
import { App } from "leafer-ui";
import { type LeaferLayerRegistry } from "./LeaferLayerRegistry";
export interface LeaferAppHostOptions {
    fill?: string;
    backgroundColor?: string;
    backgroundImage?: string | null;
    backgroundTileSize?: number;
    backgroundAlpha?: number;
    zoomModifyBackgroundAlpha?: boolean;
}
/**
 * Phase 2 shell only.
 * This host owns the Leafer App root and prepares an empty layer tree for
 * future phases to populate.
 */
export declare class LeaferAppHost {
    readonly view: HTMLElement;
    readonly app: App;
    readonly layers: LeaferLayerRegistry;
    readonly ground: LeaferLayerRegistry["ground"];
    readonly tree: LeaferLayerRegistry["tree"];
    readonly sky: LeaferLayerRegistry["sky"];
    readonly treeZoomLayer: LeaferLayerRegistry["treeZoomLayer"];
    readonly groundRoot: LeaferLayerRegistry["groundRoot"];
    readonly treeRoot: LeaferLayerRegistry["treeRoot"];
    readonly groupLayer: LeaferLayerRegistry["groupLayer"];
    readonly linkLayerBack: LeaferLayerRegistry["linkLayerBack"];
    readonly legacyNodeLayer: LeaferLayerRegistry["legacyNodeLayer"];
    readonly modernNodeLayer: LeaferLayerRegistry["modernNodeLayer"];
    readonly linkLayerFront: LeaferLayerRegistry["linkLayerFront"];
    readonly skyRoot: LeaferLayerRegistry["skyRoot"];
    readonly overlayWorld: LeaferLayerRegistry["overlayWorld"];
    readonly overlayScreen: LeaferLayerRegistry["overlayScreen"];
    private readonly backgroundColorLayer;
    private readonly backgroundPatternLayer;
    private backgroundImage;
    private backgroundTileSize;
    private backgroundAlpha;
    private zoomModifyBackgroundAlpha;
    constructor(view: HTMLElement, options?: LeaferAppHostOptions);
    resize(): void;
    configureBackground(options: Partial<LeaferAppHostOptions>): void;
    syncBackgroundViewport(screenOffsetX: number, screenOffsetY: number, scale: number): void;
    destroy(): void;
    private prepareView;
    private createBackgroundLayer;
    private resolvePatternAlpha;
    private clampAlpha;
}
