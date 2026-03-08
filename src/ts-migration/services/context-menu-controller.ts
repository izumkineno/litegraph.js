import {
    buildCanvasMenuOptions,
    buildNodeMenuOptions,
    buildSlotMenuOptions,
} from "./context-menu-action-builder";
import type {
    DialogLike,
    MenuActionBuilderCanvasPort,
    MenuPanelHost,
    ResolvedMenuPanelCanvasClassPort,
} from "./menu-panel-types";

export interface ContextMenuControllerCanvasPort
    extends MenuActionBuilderCanvasPort {
    graph: any;
    getCanvasWindow: () => Window;
    createDialog: (html: string, options?: any) => DialogLike;
    setDirty: (fgcanvas: boolean, bgcanvas: boolean) => void;
    sceneSyncController?: {
        syncGroupChanged?: (group: unknown) => void;
        repaintGroupHost?: (group: unknown) => void;
    } | null;
}

export interface ContextMenuControllerContext {
    host: MenuPanelHost;
    menuClass: ResolvedMenuPanelCanvasClassPort;
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
                        options: buildRuntimeGroupMenuOptions(
                            context,
                            group,
                            event
                        ),
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

function buildRuntimeGroupMenuOptions(
    context: ContextMenuControllerContext,
    group: any,
    event: any
): any[] {
    return [
        {
            content: "Title",
            callback: () =>
                showGroupPropertyDialog(context, group, "title", "Title", event),
        },
        {
            content: "Color",
            has_submenu: true,
            callback: (_value: any, _options: any, e: MouseEvent, menu: any) =>
                showGroupColorMenu(context, group, e || event, menu),
        },
        {
            content: "Font size",
            callback: () =>
                showGroupPropertyDialog(
                    context,
                    group,
                    "font_size",
                    "Font size",
                    event,
                    "Number"
                ),
        },
        null,
        {
            content: "Remove",
            callback: () => {
                group?.graph?.beforeChange?.();
                context.graphcanvas.graph.remove?.(group);
                group?.graph?.afterChange?.();
                refreshGroupRuntime(context, group);
            },
        },
    ];
}

function showGroupColorMenu(
    context: ContextMenuControllerContext,
    group: any,
    event: MouseEvent,
    menu: any
): void {
    const { host, menuClass } = context;
    const values: any[] = [
        {
            value: null,
            content:
                "<span style='display: block; padding-left: 4px;'>No color</span>",
        },
    ];

    for (const key in menuClass.node_colors) {
        const color = menuClass.node_colors[key];
        values.push({
            value: key,
            content:
                "<span style='display: block; color: #999; padding-left: 4px; border-left: 8px solid " +
                (color.color || "#999") +
                "; background-color:" +
                (color.bgcolor || "transparent") +
                "'>" +
                key +
                "</span>",
        });
    }

    new (host.ContextMenu as NonNullable<MenuPanelHost["ContextMenu"]>)(
        values,
        {
            event,
            parentMenu: menu,
            extra: group,
            callback: (value: { value?: string } | null | undefined) => {
                const paletteKey = value?.value;
                group.graph?.beforeChange?.();
                group.color = paletteKey
                    ? menuClass.node_colors[paletteKey]?.groupcolor ||
                      group.color
                    : undefined;
                group.graph?.afterChange?.();
                refreshGroupRuntime(context, group);
            },
        },
        context.graphcanvas.getCanvasWindow()
    );
}

function showGroupPropertyDialog(
    context: ContextMenuControllerContext,
    group: any,
    property: "title" | "font_size",
    label: string,
    event: any,
    type: "String" | "Number" = "String"
): void {
    const dialog = context.graphcanvas.createDialog(
        "<span class='name'>" +
            label +
            "</span><input autofocus type='text' class='value'/><button>OK</button>",
        {
            event,
            checkForInput: false,
        }
    );
    const input = dialog.querySelector("input") as HTMLInputElement | null;
    if (input) {
        input.value = String(group?.[property] ?? "");
        input.focus();
        input.addEventListener("blur", function(this: HTMLInputElement) {
            this.focus();
        });
        input.addEventListener("keydown", (e: KeyboardEvent) => {
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
    }

    dialog.querySelector("button")?.addEventListener("click", commit);

    function commit(): void {
        let nextValue: unknown = input?.value ?? "";
        if (type === "Number") {
            nextValue = Number(nextValue);
        }
        group.graph?.beforeChange?.();
        group[property] = nextValue;
        group.graph?.afterChange?.();
        refreshGroupRuntime(context, group);
        dialog.close();
    }
}

function refreshGroupRuntime(
    context: ContextMenuControllerContext,
    group: any
): void {
    if (context.graphcanvas.sceneSyncController) {
        context.graphcanvas.sceneSyncController.syncGroupChanged?.(group);
        context.graphcanvas.sceneSyncController.repaintGroupHost?.(group);
        return;
    }

    context.graphcanvas.setDirty(true, true);
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
