import { Group, type App } from "leafer-ui";
export interface LeaferLayerRegistry {
    readonly app: App;
    readonly ground: App["ground"];
    readonly tree: App["tree"];
    readonly sky: App["sky"];
    readonly treeZoomLayer: App["tree"]["zoomLayer"];
    readonly groundRoot: Group;
    readonly treeRoot: Group;
    readonly workspaceLayer: Group;
    readonly groupLayer: Group;
    readonly linkLayerBack: Group;
    readonly legacyNodeLayer: Group;
    readonly modernNodeLayer: Group;
    readonly linkLayerFront: Group;
    readonly skyRoot: Group;
    readonly overlayWorld: Group;
    readonly overlayScreen: Group;
}
export declare function createLeaferLayerRegistry(app: App): LeaferLayerRegistry;
