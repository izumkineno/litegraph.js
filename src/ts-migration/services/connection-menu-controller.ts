import type { LGraphNodeCanvasCollab as LGraphNode } from "../models/LGraphNode.canvas-collab";
import type {
    ConnectionNodeLike,
    DefaultNodeDescriptor,
    DefaultNodeType,
    DialogLike,
    MenuPanelEntry,
    MenuPanelEntryList,
    MenuPanelHost,
    MenuPanelValue,
    ResolvedMenuPanelCanvasClassPort,
    SlotDefinition,
    SlotSelector,
} from "./menu-panel-types";

export interface CreateDefaultNodeForSlotOptions {
    nodeFrom?: ConnectionNodeLike | null;
    slotFrom?: SlotSelector | null;
    nodeTo?: ConnectionNodeLike | null;
    slotTo?: SlotSelector | null;
    position?: [number, number];
    nodeType?: DefaultNodeType | "AUTO" | null;
    posAdd?: [number, number];
    posSizeFix?: [number, number];
}

export interface ShowConnectionMenuOptions
    extends Omit<CreateDefaultNodeForSlotOptions, "position" | "nodeType" | "posAdd" | "posSizeFix"> {
    e?: (MouseEvent & { canvasX: number; canvasY: number }) | null;
}

export interface ConnectionMenuCanvasPort {
    graph: { add: (node: LGraphNode) => void };
    allow_searchbox?: boolean;
    getCanvasWindow: () => Window;
    showSearchBox: (event?: MouseEvent, options?: Record<string, ConnectionNodeLike | SlotDefinition | string | number>) => DialogLike;
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
    const opts: Required<CreateDefaultNodeForSlotOptions> = Object.assign(
        {
            nodeFrom: null,
            slotFrom: null,
            nodeTo: null,
            slotTo: null,
            position: [0, 0] as [number, number],
            nodeType: null,
            posAdd: [0, 0] as [number, number],
            posSizeFix: [0, 0] as [number, number],
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

    const nodeX = (isFrom ? opts.nodeFrom : opts.nodeTo) as ConnectionNodeLike;
    let slotX: SlotSelector | SlotDefinition | false | undefined = isFrom ? opts.slotFrom : opts.slotTo;
    let slotIndex: number | false = false;
    if (typeof slotX === "string") {
        const foundSlot = isFrom
            ? nodeX.findOutputSlot(slotX, false)
            : nodeX.findInputSlot(slotX, false);
        slotIndex = typeof foundSlot === "number" ? foundSlot : false;
        slotX = typeof slotIndex === "number" ? (isFrom ? nodeX.outputs?.[slotIndex] : nodeX.inputs?.[slotIndex]) : false;
    } else if (typeof slotX === "object") {
        const foundSlot = isFrom
            ? nodeX.findOutputSlot(slotX.name)
            : nodeX.findInputSlot(slotX.name);
        slotIndex = typeof foundSlot === "number" ? foundSlot : false;
    } else if (typeof slotX === "number") {
        slotIndex = slotX;
        slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX];
    } else {
        console.warn("Cant get slot information " + slotX);
        return false;
    }

    if (slotX === false || slotIndex === false) {
        console.warn("createDefaultNodeForSlot bad slotX " + slotX + " " + slotIndex);
        return false;
    }
    const fromSlotType = slotX.type == host.EVENT ? "_event_" : slotX.type;
    const slotTypesDefault = isFrom
        ? host.slot_types_default_out
        : host.slot_types_default_in;
    const slotDefault = slotTypesDefault?.[fromSlotType];
    if (!slotDefault) {
        return false;
    }

    let nodeNewType: DefaultNodeType | false = false;
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

    let nodeNewOpts: DefaultNodeDescriptor | null = null;
    if (typeof nodeNewType === "object" && nodeNewType.node) {
        nodeNewOpts = nodeNewType;
        nodeNewType = nodeNewType.node;
    }
    const nodeNewTypeName = typeof nodeNewType === "string" ? nodeNewType : nodeNewType.node;
    const newNode = host.createNode?.(nodeNewTypeName);
    if (!newNode) {
        console.log("failed creating " + nodeNewTypeName);
        return false;
    }
    if (nodeNewOpts) {
        if (nodeNewOpts.properties) {
            const legacyPropertyNode = newNode as LGraphNode & {
                addProperty: (name: string, value: MenuPanelValue) => void;
            };
            for (const key in nodeNewOpts.properties) {
                legacyPropertyNode.addProperty(key, nodeNewOpts.properties[key]);
            }
        }
        if (nodeNewOpts.inputs) {
            newNode.inputs = [];
            for (const key in nodeNewOpts.inputs) {
                newNode.addOutput(nodeNewOpts.inputs[key][0], nodeNewOpts.inputs[key][1]);
            }
        }
        if (nodeNewOpts.outputs) {
            newNode.outputs = [];
            for (const key in nodeNewOpts.outputs) {
                newNode.addOutput(nodeNewOpts.outputs[key][0], nodeNewOpts.outputs[key][1]);
            }
        }
        if (nodeNewOpts.title) {
            newNode.title = nodeNewOpts.title;
        }
        if (nodeNewOpts.json) {
            newNode.configure(nodeNewOpts.json);
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
    optPass?: ShowConnectionMenuOptions
): false {
    const host = context.host;
    const opts: Required<ShowConnectionMenuOptions> = Object.assign(
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
    const nodeX = (isFrom ? opts.nodeFrom : opts.nodeTo) as ConnectionNodeLike;
    let slotX: SlotSelector | SlotDefinition | false | undefined = isFrom ? opts.slotFrom : opts.slotTo;
    let slotIndex: number | false = false;
    if (typeof slotX === "string") {
        const foundSlot = isFrom
            ? nodeX.findOutputSlot(slotX, false)
            : nodeX.findInputSlot(slotX, false);
        slotIndex = typeof foundSlot === "number" ? foundSlot : false;
        slotX = typeof slotIndex === "number" ? (isFrom ? nodeX.outputs?.[slotIndex] : nodeX.inputs?.[slotIndex]) : false;
    } else if (typeof slotX === "object") {
        const foundSlot = isFrom
            ? nodeX.findOutputSlot(slotX.name)
            : nodeX.findInputSlot(slotX.name);
        slotIndex = typeof foundSlot === "number" ? foundSlot : false;
    } else if (typeof slotX === "number") {
        slotIndex = slotX;
        slotX = isFrom ? nodeX.outputs?.[slotX] : nodeX.inputs?.[slotX];
    } else {
        return false;
    }

    if (slotX === false || slotIndex === false) {
        return false;
    }
    const fromSlotType = slotX.type == host.EVENT ? "_event_" : slotX.type;
    const options: MenuPanelEntryList = ["Add Node", null];
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
            callback: (value: MenuPanelEntry | null, _menuOpt, e: MouseEvent) => {
                if (value === "Add Node") {
                    context.menuClass.onMenuAdd(null, null, e, menu, (node: LGraphNode) => {
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
                            position: [opts.e?.canvasX || 0, opts.e?.canvasY || 0] as [number, number],
                            nodeType: typeof value === "string" || (value && "node" in value) ? value : null,
                        })
                    );
                }
            },
        },
        context.graphcanvas.getCanvasWindow()
    );
    return false;
}
