import type { MenuPanelHost, PanelLike } from "./menu-panel-types";

export interface GraphOptionsPanelCanvasPort extends Record<string, any> {
    closePanels: () => void;
    createPanel: (title: string, options?: any) => PanelLike;
    getCanvasWindow: () => Window;
    canvas: HTMLCanvasElement | null;
    links_render_mode: number;
    options_panel?: PanelLike | null;
    OPTIONPANEL_IS_OPEN?: boolean;
}

export interface GraphOptionsPanelContext {
    host: MenuPanelHost;
    graphcanvas: GraphOptionsPanelCanvasPort;
}

export function showGraphOptionsPanel(context: GraphOptionsPanelContext): void {
    const { graphcanvas, host } = context;

    graphcanvas.closePanels();
    const ref_window = graphcanvas.getCanvasWindow();
    const panel = graphcanvas.createPanel("Options", {
        closable: true,
        window: ref_window,
        onOpen: () => {
            graphcanvas.OPTIONPANEL_IS_OPEN = true;
        },
        onClose: () => {
            graphcanvas.OPTIONPANEL_IS_OPEN = false;
            graphcanvas.options_panel = null;
        },
    });
    graphcanvas.options_panel = panel;
    panel.id = "option-panel";
    panel.classList.add("settings");

    const refresh = (): void => {
        panel.content.innerHTML = "";
        const update = (name: string, value: any, options?: any): void => {
            if (options?.key) {
                name = options.key;
            }
            if (options?.values) {
                value = Object.values(options.values).indexOf(value);
            }
            graphcanvas[name] = value;
        };

        const props = [...((host.availableCanvasOptions || []) as string[])];
        props.sort();
        for (const prop of props) {
            panel.addWidget(
                "boolean",
                prop,
                graphcanvas[prop],
                { key: prop, on: "True", off: "False" },
                update
            );
        }

        const renderModes = (host.LINK_RENDER_MODES || []) as string[];
        panel.addWidget(
            "combo",
            "Render mode",
            renderModes[graphcanvas.links_render_mode],
            { key: "links_render_mode", values: renderModes },
            update
        );
        panel.addSeparator();
        panel.footer.innerHTML = "";
    };

    refresh();
}
