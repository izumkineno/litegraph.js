import { Group, type App } from "leafer-ui";

export interface LeaferLayerRegistry {
    readonly app: App;
    readonly ground: App["ground"];
    readonly tree: App["tree"];
    readonly sky: App["sky"];
    readonly treeZoomLayer: App["tree"]["zoomLayer"];
    readonly groundRoot: Group;
    readonly treeRoot: Group;
    readonly linkLayerBack: Group;
    readonly legacyNodeLayer: Group;
    readonly modernNodeLayer: Group;
    readonly linkLayerFront: Group;
    readonly skyRoot: Group;
    readonly overlayWorld: Group;
    readonly overlayScreen: Group;
}

function createLayerGroup(name: string): Group {
    return new Group({
        name,
        hittable: false,
    });
}

export function createLeaferLayerRegistry(app: App): LeaferLayerRegistry {
    const groundRoot = createLayerGroup("litegraph-ground-root");
    const treeRoot = createLayerGroup("litegraph-tree-root");
    const linkLayerBack = createLayerGroup("litegraph-link-layer-back");
    const legacyNodeLayer = createLayerGroup("litegraph-legacy-node-layer");
    const modernNodeLayer = createLayerGroup("litegraph-modern-node-layer");
    const linkLayerFront = createLayerGroup("litegraph-link-layer-front");
    const skyRoot = createLayerGroup("litegraph-sky-root");
    const overlayWorld = createLayerGroup("litegraph-overlay-world");
    const overlayScreen = createLayerGroup("litegraph-overlay-screen");

    app.ground.add(groundRoot);
    app.tree.zoomLayer.add(treeRoot);
    treeRoot.add([
        linkLayerBack,
        legacyNodeLayer,
        modernNodeLayer,
        linkLayerFront,
    ]);
    app.sky.add(skyRoot);
    skyRoot.add([overlayWorld, overlayScreen]);

    return {
        app,
        ground: app.ground,
        tree: app.tree,
        sky: app.sky,
        treeZoomLayer: app.tree.zoomLayer,
        groundRoot,
        treeRoot,
        linkLayerBack,
        legacyNodeLayer,
        modernNodeLayer,
        linkLayerFront,
        skyRoot,
        overlayWorld,
        overlayScreen,
    };
}
