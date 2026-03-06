import type { MenuPanelHost } from "./menu-panel-types";

export interface LinkMenuCanvasPort {
    graph: any;
    getCanvasWindow: () => Window;
}

export interface LinkMenuContext {
    host: MenuPanelHost;
    menuClass: Record<string, any>;
    graphcanvas: LinkMenuCanvasPort;
}

export function showLinkMenuController(
    context: LinkMenuContext,
    link: any,
    event: MouseEvent
): false {
    const host = context.host;
    const nodeLeft = context.graphcanvas.graph.getNodeById(link.origin_id);
    const nodeRight = context.graphcanvas.graph.getNodeById(link.target_id);
    let fromType: any = false;
    if (nodeLeft && nodeLeft.outputs && nodeLeft.outputs[link.origin_slot]) {
        fromType = nodeLeft.outputs[link.origin_slot].type;
    }
    let destType: any = false;
    if (nodeRight && nodeRight.outputs && nodeRight.outputs[link.target_slot]) {
        destType = nodeRight.inputs[link.target_slot].type;
    }

    const menu = new (host.ContextMenu as NonNullable<MenuPanelHost["ContextMenu"]>)(
        ["Add Node", null, "Delete", null],
        {
            event,
            title: link.data != null ? link.data.constructor?.name || null : null,
            callback: (value: any, _opts: any, menuEvent: MouseEvent) => {
                if (value === "Add Node") {
                    context.menuClass.onMenuAdd(null, null, menuEvent, menu, (node: any) => {
                        if (!node.inputs || !node.inputs.length || !node.outputs || !node.outputs.length) {
                            return;
                        }
                        if (nodeLeft.connectByType(link.origin_slot, node, fromType)) {
                            node.connectByType(link.target_slot, nodeRight, destType);
                            node.pos[0] -= node.size[0] * 0.5;
                        }
                    });
                } else if (value === "Delete") {
                    context.graphcanvas.graph.removeLink(link.id);
                }
            },
        },
        context.graphcanvas.getCanvasWindow()
    );
    return false;
}
