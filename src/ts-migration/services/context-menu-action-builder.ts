import type {
    MenuActionBuilderCanvasPort,
    MenuPanelCanvasClassPort,
} from "./menu-panel-types";

export function buildCanvasMenuOptions(
    canvas: MenuActionBuilderCanvasPort,
    menuClass: MenuPanelCanvasClassPort
): any[] {
    let options: any[] = [];
    if (canvas.getMenuOptions) {
        options = canvas.getMenuOptions();
    } else {
        options = [
            { content: "Add Node", has_submenu: true, callback: menuClass.onMenuAdd },
            { content: "Add Group", callback: menuClass.onGroupAdd },
        ];
        if (Object.keys(canvas.selected_nodes || {}).length > 1) {
            options.push({
                content: "Align",
                has_submenu: true,
                callback: menuClass.onGroupAlign,
            });
        }
        if (canvas._graph_stack && canvas._graph_stack.length > 0) {
            options.push(
                null,
                { content: "Close subgraph", callback: canvas.closeSubgraph.bind(canvas) }
            );
        }
    }
    if (canvas.getExtraMenuOptions) {
        const extra = canvas.getExtraMenuOptions(canvas, options);
        if (extra) {
            options = options.concat(extra);
        }
    }
    return options;
}

export function buildNodeMenuOptions(
    canvas: MenuActionBuilderCanvasPort,
    menuClass: MenuPanelCanvasClassPort,
    node: any
): any[] {
    let options: any[] = [];
    if (node.getMenuOptions) {
        options = node.getMenuOptions(canvas);
    } else {
        options = [
            {
                content: "Inputs",
                has_submenu: true,
                disabled: true,
                callback: menuClass.showMenuNodeOptionalInputs,
            },
            {
                content: "Outputs",
                has_submenu: true,
                disabled: true,
                callback: menuClass.showMenuNodeOptionalOutputs,
            },
            null,
            {
                content: "Properties",
                has_submenu: true,
                callback: menuClass.onShowMenuNodeProperties,
            },
            null,
            { content: "Title", callback: menuClass.onShowPropertyEditor },
            { content: "Mode", has_submenu: true, callback: menuClass.onMenuNodeMode },
        ];
        if (node.resizable !== false) {
            options.push({ content: "Resize", callback: menuClass.onMenuResizeNode });
        }
        options.push(
            { content: "Collapse", callback: menuClass.onMenuNodeCollapse },
            { content: "Pin", callback: menuClass.onMenuNodePin },
            { content: "Colors", has_submenu: true, callback: menuClass.onMenuNodeColors },
            { content: "Shapes", has_submenu: true, callback: menuClass.onMenuNodeShapes },
            null
        );
    }
    if (node.onGetInputs?.()?.length) {
        options[0].disabled = false;
    }
    if (node.onGetOutputs?.()?.length) {
        options[1].disabled = false;
    }
    if (node.getExtraMenuOptions) {
        const extra = node.getExtraMenuOptions(canvas, options);
        if (extra) {
            extra.push(null);
            options = extra.concat(options);
        }
    }
    if (node.clonable !== false) {
        options.push({ content: "Clone", callback: menuClass.onMenuNodeClone });
    }
    options.push({
        content: "To Subgraph",
        disabled: node.type == "graph/subgraph",
        callback: menuClass.onMenuNodeToSubgraph,
    });
    if (Object.keys(canvas.selected_nodes || {}).length > 1) {
        options.push({
            content: "Align Selected To",
            has_submenu: true,
            callback: menuClass.onNodeAlign,
        });
    }
    options.push(
        null,
        {
            content: "Remove",
            disabled: !(node.removable !== false && !node.block_delete),
            callback: menuClass.onMenuNodeRemove,
        }
    );
    node.graph?.onGetNodeMenuOptions?.(options, node);
    return options;
}

export function buildGroupMenuOptions(
    menuClass: MenuPanelCanvasClassPort
): any[] {
    return [
        { content: "Title", callback: menuClass.onShowPropertyEditor },
        { content: "Color", has_submenu: true, callback: menuClass.onMenuNodeColors },
        {
            content: "Font size",
            property: "font_size",
            type: "Number",
            callback: menuClass.onShowPropertyEditor,
        },
        null,
        { content: "Remove", callback: menuClass.onMenuNodeRemove },
    ];
}
