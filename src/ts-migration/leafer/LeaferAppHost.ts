import "@leafer-in/state";
import { App, Group } from "leafer-ui";

import {
    createLeaferLayerRegistry,
    type LeaferLayerRegistry,
} from "./LeaferLayerRegistry";
import { LeaferTaskWorker } from "./LeaferTaskWorker";
import { getSharedLeaferTextMetrics } from "./LeaferTextMetrics";

export interface LeaferAppHostOptions {
    fill?: string;
    backgroundColor?: string;
    backgroundImage?: string | null;
    backgroundTileSize?: number;
    backgroundAlpha?: number;
    zoomModifyBackgroundAlpha?: boolean;
    useTaskWorker?: boolean;
    maxFPS?: number;
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
    readonly workspaceLayer: LeaferLayerRegistry["workspaceLayer"];
    readonly groupLayer: LeaferLayerRegistry["groupLayer"];
    readonly linkLayerBack: LeaferLayerRegistry["linkLayerBack"];
    readonly legacyNodeLayer: LeaferLayerRegistry["legacyNodeLayer"];
    readonly modernNodeLayer: LeaferLayerRegistry["modernNodeLayer"];
    readonly linkLayerFront: LeaferLayerRegistry["linkLayerFront"];
    readonly skyRoot: LeaferLayerRegistry["skyRoot"];
    readonly overlayWorld: LeaferLayerRegistry["overlayWorld"];
    readonly overlayScreen: LeaferLayerRegistry["overlayScreen"];
    readonly measurementRoot: Group;
    readonly taskWorker: LeaferTaskWorker;

    private readonly backgroundColorLayer: HTMLDivElement;
    private readonly backgroundPatternLayer: HTMLDivElement;
    private backgroundImage: string | null;
    private backgroundTileSize: number;
    private backgroundAlpha: number;
    private zoomModifyBackgroundAlpha: boolean;
    private vsyncCalibrationHandle: number | null;

    constructor(view: HTMLElement, options: LeaferAppHostOptions = {}) {
        this.view = view;
        this.prepareView();
        this.backgroundImage = options.backgroundImage || null;
        this.backgroundTileSize = Math.max(1, options.backgroundTileSize || 100);
        this.backgroundAlpha = this.clampAlpha(options.backgroundAlpha ?? 1);
        this.zoomModifyBackgroundAlpha =
            options.zoomModifyBackgroundAlpha !== false;
        this.vsyncCalibrationHandle = null;
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
        this.workspaceLayer = this.layers.workspaceLayer;
        this.groupLayer = this.layers.groupLayer;
        this.linkLayerBack = this.layers.linkLayerBack;
        this.legacyNodeLayer = this.layers.legacyNodeLayer;
        this.modernNodeLayer = this.layers.modernNodeLayer;
        this.linkLayerFront = this.layers.linkLayerFront;
        this.skyRoot = this.layers.skyRoot;
        this.overlayWorld = this.layers.overlayWorld;
        this.overlayScreen = this.layers.overlayScreen;
        this.measurementRoot = new Group({
            name: "litegraph-text-metrics-root",
            visible: false,
            hittable: false,
        });
        this.skyRoot.add(this.measurementRoot);
        getSharedLeaferTextMetrics().attachRoot(this.measurementRoot);
        this.taskWorker = new LeaferTaskWorker(options.useTaskWorker !== false);
        this.applyMaxFPS(options.maxFPS || 60);
        this.scheduleVSyncCalibration();
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
        if (this.vsyncCalibrationHandle !== null) {
            this.getViewWindow().cancelAnimationFrame(this.vsyncCalibrationHandle);
            this.vsyncCalibrationHandle = null;
        }
        getSharedLeaferTextMetrics().detachRoot(this.measurementRoot);
        this.taskWorker.destroy();
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

    private scheduleVSyncCalibration(): void {
        if (this.vsyncCalibrationHandle !== null) {
            return;
        }

        const windowRef = this.getViewWindow();
        const frameRates: number[] = [];
        let previousTimestamp = 0;
        const collect = (timestamp: number): void => {
            if (previousTimestamp > 0) {
                const delta = timestamp - previousTimestamp;
                if (delta > 0 && delta < 100) {
                    frameRates.push(1000 / delta);
                }
            }
            previousTimestamp = timestamp;

            if (frameRates.length < 12) {
                this.vsyncCalibrationHandle =
                    windowRef.requestAnimationFrame(collect);
                return;
            }

            this.vsyncCalibrationHandle = null;
            this.applyMaxFPS(this.resolveVSyncFPS(frameRates));
        };

        this.vsyncCalibrationHandle = windowRef.requestAnimationFrame(collect);
    }

    private resolveVSyncFPS(samples: readonly number[]): number {
        if (!samples.length) {
            return 60;
        }

        const sorted = [...samples].sort((left, right) => left - right);
        const median = sorted[Math.floor(sorted.length / 2)];
        if (!Number.isFinite(median) || median < 45 || median > 260) {
            return 60;
        }

        const candidates = [60, 72, 75, 90, 100, 120, 144, 165, 180, 200, 240];
        let best = candidates[0];
        let bestDistance = Math.abs(candidates[0] - median);
        for (let i = 1; i < candidates.length; ++i) {
            const distance = Math.abs(candidates[i] - median);
            if (distance < bestDistance) {
                best = candidates[i];
                bestDistance = distance;
            }
        }
        return best;
    }

    private applyMaxFPS(maxFPS: number): void {
        const resolved = Math.max(1, Math.round(maxFPS));
        const targets: Array<{ config?: { maxFPS?: number } } | null | undefined> = [
            this.app as unknown as { config?: { maxFPS?: number } },
            this.ground as unknown as { config?: { maxFPS?: number } },
            this.tree as unknown as { config?: { maxFPS?: number } },
            this.sky as unknown as { config?: { maxFPS?: number } },
        ];
        for (let i = 0; i < targets.length; ++i) {
            const config = targets[i]?.config;
            if (!config) {
                continue;
            }
            config.maxFPS = resolved;
        }
    }

    private getViewWindow(): Window {
        const doc = this.view.ownerDocument as Document & {
            parentWindow?: Window;
        };
        return (doc.defaultView || doc.parentWindow || window) as Window;
    }
}
