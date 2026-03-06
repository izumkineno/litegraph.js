import {
    buildCanvasMenuOptions,
    buildGroupMenuOptions,
    buildNodeMenuOptions,
    buildSlotMenuOptions,
} from "./context-menu-action-builder";
import type {
    DialogLike,
    MenuActionBuilderCanvasPort,
    MenuPanelCanvasClassPort,
    MenuPanelHost,
} from "./menu-panel-types";

export interface ContextMenuControllerCanvasPort
    extends MenuActionBuilderCanvasPort {
    graph: any;
    getCanvasWindow: () => Window;
    createDialog: (html: string, options?: any) => DialogLike;
    setDirty: (fgcanvas: boolean, bgcanvas: boolean) => void;
}

export interface ContextMenuControllerContext {
    host: MenuPanelHost;
    menuClass: MenuPanelCanvasClassPort;
    graphcanvas: ContextMenuControllerCanvasPort;
}

export function processContextMenuController(
    context: ContextMenuControllerContext,
    node: any,
    event: any
): void {
    const { host, menuClass, graphcanvas } = context;
    const options: any = {
        event,
        callback: (value: any, callbackOptions: any) => {
            handleContextMenuAction(context, node, value, callbackOptions);
        },
        extra: node,
    };
    if (node) {
        options.title = node.type;
    }

    let menuInfo: any[] | null = null;
    let slot: any = null;
    if (node) {
        slot = node.getSlotInPosition?.(event.canvasX, event.canvasY);
        menuClass.active_node = node;
    }

    if (slot) {
        menuInfo = buildSlotMenuOptions(node, slot);
        options.title = (slot.input ? slot.input.type : slot.output.type) || "*";
        if (slot.input?.type == host.ACTION) {
            options.title = "Action";
        }
        if (slot.output?.type == host.EVENT) {
            options.title = "Event";
        }
    } else if (node) {
        menuInfo = buildNodeMenuOptions(graphcanvas, menuClass, node);
    } else {
        menuInfo = buildCanvasMenuOptions(graphcanvas, menuClass);
        const group = graphcanvas.graph.getGroupOnPos?.(event.canvasX, event.canvasY);
        if (group) {
            menuInfo.push(
                null,
                {
                    content: "Edit Group",
                    has_submenu: true,
                    submenu: {
                        title: "Group",
                        extra: group,
                        options: buildGroupMenuOptions(menuClass),
                    },
                }
            );
        }
    }

    if (!menuInfo) {
        return;
    }
    new (host.ContextMenu as NonNullable<MenuPanelHost["ContextMenu"]>)(
        menuInfo,
        options,
        graphcanvas.getCanvasWindow()
    );
}

function handleContextMenuAction(
    context: ContextMenuControllerContext,
    node: any,
    value: any,
    options: any
): void {
    if (!value) {
        return;
    }
    if (value.content == "Remove Slot") {
        const info = value.slot;
        node.graph.beforeChange();
        if (info.input) {
            node.removeInput(info.slot);
        } else if (info.output) {
            node.removeOutput(info.slot);
        }
        node.graph.afterChange();
        return;
    }
    if (value.content == "Disconnect Links") {
        const info = value.slot;
        node.graph.beforeChange();
        if (info.output) {
            node.disconnectOutput(info.slot);
        } else if (info.input) {
            node.disconnectInput(info.slot);
        }
        node.graph.afterChange();
        return;
    }
    if (value.content == "Rename Slot") {
        showRenameSlotDialog(context, node, value.slot, options);
    }
}

function showRenameSlotDialog(
    context: ContextMenuControllerContext,
    node: any,
    info: any,
    options: any
): void {
    const slotInfo = info.input
        ? node.getInputInfo?.(info.slot)
        : node.getOutputInfo?.(info.slot);
    const dialog = context.graphcanvas.createDialog(
        "<span class='name'>Name</span><input autofocus type='text'/><button>OK</button>",
        options
    );
    const input = dialog.querySelector("input") as HTMLInputElement | null;
    if (input && slotInfo) {
        input.value = slotInfo.label || "";
    }

    const commit = (): void => {
        node.graph.beforeChange();
        if (input?.value) {
            if (slotInfo) {
                slotInfo.label = input.value;
            }
            context.graphcanvas.setDirty(true, false);
        }
        dialog.close();
        node.graph.afterChange();
    };

    dialog.querySelector("button")?.addEventListener("click", commit);
    input?.addEventListener("keydown", (e: KeyboardEvent) => {
        dialog.is_modified = true;
        if (e.key === "Escape") {
            dialog.close();
        } else if (e.key === "Enter") {
            commit();
        } else {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
    });
    input?.focus();
}
