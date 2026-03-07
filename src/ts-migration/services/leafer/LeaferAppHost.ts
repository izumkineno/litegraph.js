import { App } from "leafer-ui";

import {
    createLeaferLayerRegistry,
    type LeaferLayerRegistry,
} from "./LeaferLayerRegistry";

export interface LeaferAppHostOptions {
    fill?: string;
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
    readonly skyRoot: LeaferLayerRegistry["skyRoot"];
    readonly overlayWorld: LeaferLayerRegistry["overlayWorld"];
    readonly overlayScreen: LeaferLayerRegistry["overlayScreen"];

    constructor(view: HTMLElement, options: LeaferAppHostOptions = {}) {
        this.view = view;
        this.prepareView();

        this.app = new App({
            view: this.view,
            fill: options.fill ?? "transparent",
            pixelSnap: true,
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
        this.skyRoot = this.layers.skyRoot;
        this.overlayWorld = this.layers.overlayWorld;
        this.overlayScreen = this.layers.overlayScreen;
    }

    resize(): void {
        this.app.forceRender();
    }

    destroy(): void {
        this.app.destroy();
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
}
