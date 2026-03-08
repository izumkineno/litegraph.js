import "@leafer-in/state";
import { App } from "leafer-ui";

import {
    createLeaferLayerRegistry,
    type LeaferLayerRegistry,
} from "./LeaferLayerRegistry";

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
export class LeaferAppHost {
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

    private readonly backgroundColorLayer: HTMLDivElement;
    private readonly backgroundPatternLayer: HTMLDivElement;
    private backgroundImage: string | null;
    private backgroundTileSize: number;
    private backgroundAlpha: number;
    private zoomModifyBackgroundAlpha: boolean;

    constructor(view: HTMLElement, options: LeaferAppHostOptions = {}) {
        this.view = view;
        this.prepareView();
        this.backgroundImage = options.backgroundImage || null;
        this.backgroundTileSize = Math.max(1, options.backgroundTileSize || 100);
        this.backgroundAlpha = this.clampAlpha(options.backgroundAlpha ?? 1);
        this.zoomModifyBackgroundAlpha =
            options.zoomModifyBackgroundAlpha !== false;
        this.backgroundColorLayer = this.createBackgroundLayer(
            "lgraph-leafer-background-color"
        );
        this.backgroundPatternLayer = this.createBackgroundLayer(
            "lgraph-leafer-background-pattern"
        );
        this.view.insertBefore(this.backgroundPatternLayer, this.view.firstChild);
        this.view.insertBefore(this.backgroundColorLayer, this.view.firstChild);
        this.backgroundColorLayer.style.backgroundColor =
            options.backgroundColor || "#222";
        this.backgroundPatternLayer.style.backgroundImage = this.backgroundImage
            ? `url("${this.backgroundImage}")`
            : "none";
        this.backgroundPatternLayer.style.backgroundRepeat = "repeat";
        this.backgroundPatternLayer.style.imageRendering = "pixelated";

        this.app = new App({
            view: this.view,
            fill: options.fill ?? "transparent",
            pixelSnap: true,
            usePartRender: true,
            usePartLayout: true,
            ground: {
                hittable: false,
            },
            tree: {},
            sky: {
                hittable: false,
            },
        });

        this.layers = createLeaferLayerRegistry(this.app);
        this.ground = this.layers.ground;
        this.tree = this.layers.tree;
        this.sky = this.layers.sky;
        this.treeZoomLayer = this.layers.treeZoomLayer;
        this.groundRoot = this.layers.groundRoot;
        this.treeRoot = this.layers.treeRoot;
        this.groupLayer = this.layers.groupLayer;
        this.linkLayerBack = this.layers.linkLayerBack;
        this.legacyNodeLayer = this.layers.legacyNodeLayer;
        this.modernNodeLayer = this.layers.modernNodeLayer;
        this.linkLayerFront = this.layers.linkLayerFront;
        this.skyRoot = this.layers.skyRoot;
        this.overlayWorld = this.layers.overlayWorld;
        this.overlayScreen = this.layers.overlayScreen;
        this.syncBackgroundViewport(0, 0, 1);
    }

    resize(): void {
        this.app.forceRender();
    }

    configureBackground(options: Partial<LeaferAppHostOptions>): void {
        if (options.backgroundColor !== undefined) {
            this.backgroundColorLayer.style.backgroundColor =
                options.backgroundColor || "#222";
        }
        if (options.backgroundImage !== undefined) {
            this.backgroundImage = options.backgroundImage || null;
            this.backgroundPatternLayer.style.backgroundImage = this.backgroundImage
                ? `url("${this.backgroundImage}")`
                : "none";
        }
        if (options.backgroundTileSize !== undefined) {
            this.backgroundTileSize = Math.max(1, options.backgroundTileSize || 100);
        }
        if (options.backgroundAlpha !== undefined) {
            this.backgroundAlpha = this.clampAlpha(options.backgroundAlpha);
        }
        if (options.zoomModifyBackgroundAlpha !== undefined) {
            this.zoomModifyBackgroundAlpha = !!options.zoomModifyBackgroundAlpha;
        }
        this.syncBackgroundViewport(
            this.treeZoomLayer.x || 0,
            this.treeZoomLayer.y || 0,
            this.treeZoomLayer.scaleX || 1
        );
    }

    syncBackgroundViewport(
        screenOffsetX: number,
        screenOffsetY: number,
        scale: number
    ): void {
        const resolvedScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
        const offsetX = Number.isFinite(screenOffsetX) ? screenOffsetX : 0;
        const offsetY = Number.isFinite(screenOffsetY) ? screenOffsetY : 0;
        const tileSize = this.backgroundTileSize * resolvedScale;
        this.backgroundPatternLayer.style.backgroundSize = `${tileSize}px ${tileSize}px`;
        this.backgroundPatternLayer.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
        this.backgroundPatternLayer.style.opacity = this.resolvePatternAlpha(
            resolvedScale
        ).toString();
        this.backgroundPatternLayer.style.display =
            this.backgroundImage && resolvedScale > 0.5 ? "" : "none";
    }

    destroy(): void {
        this.app.destroy();
        this.backgroundPatternLayer.remove();
        this.backgroundColorLayer.remove();
        this.view.removeAttribute("data-render-runtime");
    }

    private prepareView(): void {
        this.view.classList.add("graphview", "lgraph-leafer-view");
        this.view.setAttribute("data-render-runtime", "leafer");

        if (!this.view.style.position) {
            this.view.style.position = "relative";
        }
        if (!this.view.style.width) {
            this.view.style.width = "100%";
        }
        if (!this.view.style.height) {
            this.view.style.height = "100%";
        }
        if (!this.view.style.overflow) {
            this.view.style.overflow = "hidden";
        }
    }

    private createBackgroundLayer(className: string): HTMLDivElement {
        const element = this.view.ownerDocument.createElement("div");
        element.className = className;
        element.setAttribute("aria-hidden", "true");
        element.style.position = "absolute";
        element.style.inset = "0";
        element.style.pointerEvents = "none";
        element.style.zIndex = "0";
        return element;
    }

    private resolvePatternAlpha(scale: number): number {
        if (!this.zoomModifyBackgroundAlpha) {
            return this.backgroundAlpha;
        }
        if (scale <= 0.5) {
            return 0;
        }
        return this.clampAlpha((1 - 0.5 / scale) * this.backgroundAlpha);
    }

    private clampAlpha(value: number): number {
        if (!Number.isFinite(value)) {
            return 1;
        }
        return Math.max(0, Math.min(1, value));
    }
}
