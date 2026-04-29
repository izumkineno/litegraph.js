import {
    buildCanvasMenuOptions,
    buildGroupMenuOptions,
    buildNodeMenuOptions,
    buildSlotMenuOptions,
} from "./context-menu-action-builder";
import type {
    CanvasPointerEventLike,
    ContextMenuNodeLike,
    ContextMenuOptionsLike,
    DialogLike,
    MenuActionBuilderCanvasPort,
    MenuPanelEntry,
    MenuPanelEntryList,
    MenuPanelHost,
    ResolvedMenuPanelCanvasClassPort,
    SlotMenuInfo,
} from "./menu-panel-types";

export interface ContextMenuControllerCanvasPort
    extends MenuActionBuilderCanvasPort {
    graph: { getGroupOnPos?: (x: number, y: number) => object | null };
    getCanvasWindow: () => Window;
    createDialog: (html: string, options?: ContextMenuOptionsLike) => DialogLike;
    setDirty: (fgcanvas: boolean, bgcanvas: boolean) => void;
}

export interface ContextMenuControllerContext {
    host: MenuPanelHost;
    menuClass: ResolvedMenuPanelCanvasClassPort;
    graphcanvas: ContextMenuControllerCanvasPort;
}

export function processContextMenuController(
    context: ContextMenuControllerContext,
    node: ContextMenuNodeLike | null,
    event: CanvasPointerEventLike
): void {
    const { host, menuClass, graphcanvas } = context;
    const options: ContextMenuOptionsLike = {
        event,
        callback: (value: MenuPanelEntry | null, callbackOptions: ContextMenuOptionsLike) => {
            handleContextMenuAction(context, node, value, callbackOptions);
        },
        extra: node,
    };
    if (node) {
        options.title = node.type;
    }

    let menuInfo: MenuPanelEntryList | null = null;
    let slot: SlotMenuInfo | null = null;
    if (node) {
        slot = node.getSlotInPosition?.(event.canvasX, event.canvasY);
        menuClass.active_node = node;
    }

    if (slot) {
        menuInfo = buildSlotMenuOptions(node, slot);
        options.title = String((slot.input ? slot.input.type : slot.output?.type) || "*");
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
    node: ContextMenuNodeLike | null,
    value: MenuPanelEntry | null,
    options: ContextMenuOptionsLike
): void {
    if (!value || typeof value === "string" || !("content" in value)) {
        return;
    }
    if (!node) {
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
    node: ContextMenuNodeLike,
    info: SlotMenuInfo,
    options: ContextMenuOptionsLike
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
