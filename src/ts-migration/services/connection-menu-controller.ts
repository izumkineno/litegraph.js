import type {
    DialogLike,
    MenuPanelHost,
    ResolvedMenuPanelCanvasClassPort,
} from "./menu-panel-types";

export interface CreateDefaultNodeForSlotOptions {
    nodeFrom?: any;
    slotFrom?: any;
    nodeTo?: any;
    slotTo?: any;
    position?: [number, number];
    nodeType?: any;
    posAdd?: [number, number];
    posSizeFix?: [number, number];
}

export interface ConnectionMenuCanvasPort {
    graph: any;
    allow_searchbox?: boolean;
    getCanvasWindow: () => Window;
    showSearchBox: (event?: MouseEvent, options?: any) => DialogLike;
}

export interface ConnectionMenuContext {
    host: MenuPanelHost;
    menuClass: ResolvedMenuPanelCanvasClassPort;
    graphcanvas: ConnectionMenuCanvasPort;
}

export function createDefaultNodeForSlotController(
    context: ConnectionMenuContext,
    optPass?: CreateDefaultNodeForSlotOptions
): boolean {
    const host = context.host;
    const opts = Object.assign(
        {
            nodeFrom: null,
            slotFrom: null,
            nodeTo: null,
            slotTo: null,
            position: [0, 0],
            nodeType: null,
            posAdd: [0, 0],
            posSizeFix: [0, 0],
        },
        optPass || {}
    );

    const isFrom = !!(opts.nodeFrom && opts.slotFrom !== null);
    const isTo = !isFrom && !!(opts.nodeTo && opts.slotTo !== null);
    if (!isFrom && !isTo) {
        console.warn(
            "No data passed to createDefaultNodeForSlot " +
                opts.nodeFrom +
                " " +
                opts.slotFrom +
                " " +
                opts.nodeTo +
                " " +
                opts.slotTo
        );
        return false;
    }
    if (!opts.nodeType) {
        console.warn("No type to createDefaultNodeForSlot");
        return false;
    }

    const nodeX = isFrom ? opts.nodeFrom : opts.nodeTo;
    let slotX: any = isFrom ? opts.slotFrom : opts.slotTo;
    let slotIndex: any = false;
    if (typeof slotX === "string") {
        slotIndex = isFrom
            ? nodeX.findOutputSlot(slotX, false)
            : nodeX.findInputSlot(slotX, false);
        slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX];
    } else if (typeof slotX === "object") {
        slotIndex = isFrom
            ? nodeX.findOutputSlot(slotX.name)
            : nodeX.findInputSlot(slotX.name);
    } else if (typeof slotX === "number") {
        slotIndex = slotX;
        slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX];
    } else {
        console.warn("Cant get slot information " + slotX);
        return false;
    }

    if (slotX === false || slotIndex === false) {
        console.warn("createDefaultNodeForSlot bad slotX " + slotX + " " + slotIndex);
    }
    const fromSlotType = slotX.type == host.EVENT ? "_event_" : slotX.type;
    const slotTypesDefault = isFrom
        ? host.slot_types_default_out
        : host.slot_types_default_in;
    const slotDefault = slotTypesDefault?.[fromSlotType];
    if (!slotDefault) {
        return false;
    }

    let nodeNewType: any = false;
    if (typeof slotDefault === "object") {
        for (const key in slotDefault) {
            if (opts.nodeType == slotDefault[key] || opts.nodeType == "AUTO") {
                nodeNewType = slotDefault[key];
                break;
            }
        }
    } else if (opts.nodeType == slotDefault || opts.nodeType == "AUTO") {
        nodeNewType = slotDefault;
    }
    if (!nodeNewType) {
        return false;
    }

    let nodeNewOpts: any = null;
    if (typeof nodeNewType === "object" && nodeNewType.node) {
        nodeNewOpts = nodeNewType;
        nodeNewType = nodeNewType.node;
    }
    const newNode = host.createNode?.(nodeNewType);
    if (!newNode) {
        console.log("failed creating " + nodeNewType);
        return false;
    }
    if (nodeNewOpts) {
        const nodeCompat = newNode as any;
        if (nodeNewOpts.properties) {
            for (const key in nodeNewOpts.properties) {
                nodeCompat.addProperty(key, nodeNewOpts.properties[key]);
            }
        }
        if (nodeNewOpts.inputs) {
            nodeCompat.inputs = [];
            for (const key in nodeNewOpts.inputs) {
                nodeCompat.addOutput(nodeNewOpts.inputs[key][0], nodeNewOpts.inputs[key][1]);
            }
        }
        if (nodeNewOpts.outputs) {
            nodeCompat.outputs = [];
            for (const key in nodeNewOpts.outputs) {
                nodeCompat.addOutput(nodeNewOpts.outputs[key][0], nodeNewOpts.outputs[key][1]);
            }
        }
        if (nodeNewOpts.title) {
            nodeCompat.title = nodeNewOpts.title;
        }
        if (nodeNewOpts.json) {
            nodeCompat.configure(nodeNewOpts.json);
        }
    }

    context.graphcanvas.graph.add(newNode);
    newNode.pos = [
        opts.position[0] +
            opts.posAdd[0] +
            (opts.posSizeFix[0] ? opts.posSizeFix[0] * newNode.size[0] : 0),
        opts.position[1] +
            opts.posAdd[1] +
            (opts.posSizeFix[1] ? opts.posSizeFix[1] * newNode.size[1] : 0),
    ];
    if (isFrom) {
        opts.nodeFrom.connectByType(slotIndex, newNode, fromSlotType);
    } else {
        opts.nodeTo.connectByTypeOutput(slotIndex, newNode, fromSlotType);
    }

    if (isFrom && isTo) {
        // TODO
    }
    return true;
}

export function showConnectionMenuController(
    context: ConnectionMenuContext,
    optPass?: any
): false {
    const host = context.host;
    const opts = Object.assign(
        {
            nodeFrom: null,
            slotFrom: null,
            nodeTo: null,
            slotTo: null,
            e: null,
        },
        optPass || {}
    );
    const isFrom = !!(opts.nodeFrom && opts.slotFrom != null);
    const isTo = !isFrom && !!(opts.nodeTo && opts.slotTo != null);
    if (!isFrom && !isTo) {
        return false;
    }
    const nodeX = isFrom ? opts.nodeFrom : opts.nodeTo;
    let slotX: any = isFrom ? opts.slotFrom : opts.slotTo;
    let slotIndex: any = false;
    if (typeof slotX === "string") {
        slotIndex = isFrom
            ? nodeX.findOutputSlot?.(slotX, false)
            : nodeX.findInputSlot?.(slotX, false);
        slotX = isFrom ? nodeX.outputs?.[slotIndex] : nodeX.inputs?.[slotIndex];
    } else if (typeof slotX === "object") {
        slotIndex = isFrom
            ? nodeX.findOutputSlot?.(slotX.name)
            : nodeX.findInputSlot?.(slotX.name);
    } else if (typeof slotX === "number") {
        slotIndex = slotX;
        slotX = isFrom ? nodeX.outputs?.[slotX] : nodeX.inputs?.[slotX];
    } else {
        return false;
    }

    const fromSlotType = slotX.type == host.EVENT ? "_event_" : slotX.type;
    const options: any[] = ["Add Node", null];
    if (context.graphcanvas.allow_searchbox) {
        options.push("Search", null);
    }
    const slotTypesDefault = isFrom
        ? host.slot_types_default_out
        : host.slot_types_default_in;
    if (slotTypesDefault?.[fromSlotType]) {
        if (typeof slotTypesDefault[fromSlotType] === "object") {
            for (const key in slotTypesDefault[fromSlotType]) {
                options.push(slotTypesDefault[fromSlotType][key]);
            }
        } else {
            options.push(slotTypesDefault[fromSlotType]);
        }
    }

    const menu = new (host.ContextMenu as NonNullable<MenuPanelHost["ContextMenu"]>)(
        options,
        {
            event: opts.e,
            title:
                (slotX?.name ? slotX.name + (fromSlotType ? " | " : "") : "") +
                (fromSlotType || ""),
            callback: (value: any, _menuOpt: any, e: any) => {
                if (value === "Add Node") {
                    context.menuClass.onMenuAdd(null, null, e, menu, (node: any) => {
                        if (isFrom) {
                            opts.nodeFrom.connectByType(slotIndex, node, fromSlotType);
                        } else {
                            opts.nodeTo.connectByTypeOutput(slotIndex, node, fromSlotType);
                        }
                    });
                } else if (value === "Search") {
                    if (isFrom) {
                        context.graphcanvas.showSearchBox(e, {
                            node_from: opts.nodeFrom,
                            slot_from: slotX,
                            type_filter_in: fromSlotType,
                        });
                    } else {
                        context.graphcanvas.showSearchBox(e, {
                            node_to: opts.nodeTo,
                            slot_from: slotX,
                            type_filter_out: fromSlotType,
                        });
                    }
                } else {
                    createDefaultNodeForSlotController(
                        context,
                        Object.assign(opts, {
                            position: [opts.e.canvasX, opts.e.canvasY],
                            nodeType: value,
                        })
                    );
                }
            },
        },
        context.graphcanvas.getCanvasWindow()
    );
    return false;
}
