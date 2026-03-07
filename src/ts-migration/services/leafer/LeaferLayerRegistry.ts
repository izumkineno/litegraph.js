import { Group, type App } from "leafer-ui";

export interface LeaferLayerRegistry {
    readonly app: App;
    readonly ground: App["ground"];
    readonly tree: App["tree"];
    readonly sky: App["sky"];
    readonly treeZoomLayer: App["tree"]["zoomLayer"];
    readonly groundRoot: Group;
    readonly treeRoot: Group;
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
    const skyRoot = createLayerGroup("litegraph-sky-root");
    const overlayWorld = createLayerGroup("litegraph-overlay-world");
    const overlayScreen = createLayerGroup("litegraph-overlay-screen");

    app.ground.add(groundRoot);
    app.tree.zoomLayer.add(treeRoot);
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
        skyRoot,
        overlayWorld,
        overlayScreen,
    };
}
