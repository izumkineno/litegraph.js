import type {
    MenuPanelHost,
    PanelLike,
    ResolvedMenuPanelCanvasClassPort,
} from "./menu-panel-types";

export interface NodePanelCanvasPort {
    closePanels: () => void;
    createPanel: (title: string, options?: any) => PanelLike;
    getCanvasWindow: () => Window;
    canvas: HTMLCanvasElement | null;
    graph: {
        beforeChange?: (node?: any) => void;
        afterChange?: () => void;
    };
}

export interface NodePanelStatePort {
    setSelectedNode: (node: any) => void;
    setNodePanel: (panel: PanelLike | null) => void;
    setNodePanelOpen: (open: boolean) => void;
    markDirty: () => void;
}

export interface NodePanelPresenterContext {
    host: MenuPanelHost;
    menuClass: ResolvedMenuPanelCanvasClassPort;
    graphcanvas: NodePanelCanvasPort;
    state: NodePanelStatePort;
}

export function showNodePanel(
    context: NodePanelPresenterContext,
    node: any
): void {
    const { graphcanvas, host, menuClass, state } = context;

    state.setSelectedNode(node);
    graphcanvas.closePanels();

    const panel = graphcanvas.createPanel(node.title || "", {
        closable: true,
        window: graphcanvas.getCanvasWindow(),
        onOpen: () => {
            state.setNodePanelOpen(true);
        },
        onClose: () => {
            state.setNodePanelOpen(false);
            state.setNodePanel(null);
        },
    });
    state.setNodePanel(panel);
    panel.id = "node-panel";
    panel.node = node;
    panel.classList.add("settings");

    const refresh = (): void => {
        panel.content.innerHTML = "";
        panel.addHTML(
            "<span class='node_type'>" +
                node.type +
                "</span><span class='node_desc'>" +
                (node.constructor.desc || "") +
                "</span><span class='separator'></span>"
        );
        panel.addHTML("<h3>Properties</h3>");

        const update = (name: string, value: any): void => {
            graphcanvas.graph.beforeChange?.(node);
            if (name === "Title") {
                node.title = value;
            } else if (name === "Mode") {
                const idx = Object.values(host.NODE_MODES || {}).indexOf(value);
                if (idx >= 0) {
                    node.changeMode?.(idx);
                }
            } else if (name === "Color") {
                const color = menuClass.node_colors?.[value];
                if (color) {
                    node.color = color.color;
                    node.bgcolor = color.bgcolor;
                }
            } else {
                node.setProperty?.(name, value);
            }
            graphcanvas.graph.afterChange?.();
            state.markDirty();
        };

        panel.addWidget("string", "Title", node.title, {}, update);
        panel.addWidget(
            "combo",
            "Mode",
            (host.NODE_MODES as any)?.[node.mode],
            { values: host.NODE_MODES },
            update
        );
        const nodeColor =
            node.color !== undefined
                ? Object.keys(menuClass.node_colors || {}).filter(
                      (key) => menuClass.node_colors?.[key].color == node.color
                  )
                : "";
        panel.addWidget(
            "combo",
            "Color",
            nodeColor,
            { values: Object.keys(menuClass.node_colors || {}) },
            update
        );

        for (const propertyName in node.properties) {
            const value = node.properties[propertyName];
            const info = node.getPropertyInfo?.(propertyName) || {};
            if (node.onAddPropertyToPanel?.(propertyName, panel)) {
                continue;
            }
            panel.addWidget(
                info.widget || info.type || "string",
                propertyName,
                value,
                info,
                update
            );
        }

        panel.addSeparator();
        node.onShowCustomPanelInfo?.(panel);
        panel.footer.innerHTML = "";
        panel
            .addButton("Delete", () => {
                if (node.block_delete) {
                    return;
                }
                node.graph.remove?.(node);
                panel.close();
            })
            .classList.add("delete");
    };

    panel.inner_showCodePad = (propertyName: string) => {
        panel.classList.remove("settings");
        panel.classList.add("centered");
        panel.alt_content.innerHTML = "<textarea class='code'></textarea>";
        const textarea = panel.alt_content.querySelector("textarea") as HTMLTextAreaElement;
        const done = (): void => {
            panel.toggleAltContent(false);
            panel.toggleFooterVisibility(true);
            textarea.parentNode?.removeChild(textarea);
            panel.classList.add("settings");
            panel.classList.remove("centered");
            refresh();
        };
        textarea.value = node.properties[propertyName];
        textarea.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.code === "Enter" && e.ctrlKey) {
                node.setProperty?.(propertyName, textarea.value);
                done();
            }
        });
        panel.toggleAltContent(true);
        panel.toggleFooterVisibility(false);
        textarea.style.height = "calc(100% - 40px)";
        const assign = panel.addButton("Assign", () => {
            node.setProperty?.(propertyName, textarea.value);
            done();
        });
        panel.alt_content.appendChild(assign);
        const close = panel.addButton("Close", done);
        close.style.float = "right";
        panel.alt_content.appendChild(close);
    };

    refresh();
    graphcanvas.canvas?.parentNode?.appendChild(panel);
}
