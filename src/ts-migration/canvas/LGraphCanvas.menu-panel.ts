import type { GraphCanvasWidgetPort } from "../contracts/canvas";
import {
    buildCanvasMenuOptions,
    buildGroupMenuOptions,
    buildNodeMenuOptions,
} from "../services/context-menu-action-builder";
import {
    createDefaultNodeForSlotController,
    showConnectionMenuController,
} from "../services/connection-menu-controller";
import { processContextMenuController } from "../services/context-menu-controller";
import { createDialog } from "../services/dialog-factory";
import { showLinkMenuController } from "../services/link-menu-controller";
import {
    type DialogLike,
    type PanelLike,
    type ResolvedMenuPanelCanvasClassPort,
    type ResolvedMenuPanelHost,
    type SearchBoxControllerPort,
} from "../services/menu-panel-types";
import { resolveMenuPanelCanvasClass } from "../services/menu-class-resolver";
import { resolveMenuPanelHost } from "../services/menu-host-resolver";
import { showGraphOptionsPanel } from "../services/graph-options-panel-presenter";
import { showNodePanel } from "../services/node-panel-presenter";
import { createPanel } from "../services/panel-factory";
import { showEditPropertyValueDialog } from "../services/property-value-dialog-controller";
import { showPromptDialog } from "../services/prompt-dialog-controller";
import { showSearchBoxController } from "../services/searchbox-controller";
import { showSubgraphIoPanel } from "../services/subgraph-io-panel-presenter";
import { LGraphCanvasRender } from "./LGraphCanvas.render";

/**
 * LGraphCanvas menu / panel / search layer.
 * Source: `showLinkMenu/showConnectionMenu/showSearchBox/createDialog/createPanel/processContextMenu`.
 */
export class LGraphCanvasMenuPanel
    extends LGraphCanvasRender
    implements GraphCanvasWidgetPort {
    [key: string]: any;

    private menuClass(): ResolvedMenuPanelCanvasClassPort {
        return resolveMenuPanelCanvasClass();
    }

    private menuHost(): ResolvedMenuPanelHost {
        return resolveMenuPanelHost(
            this.getLiteGraphHost(),
            this.menuClass()
        );
    }

    private setActiveCanvas(): void {
        this.menuClass().active_canvas = this as any;
    }

    showLinkMenu(link: any, e: MouseEvent): false {
        this.setActiveCanvas();
        return showLinkMenuController(
            {
                host: this.menuHost(),
                menuClass: this.menuClass(),
                graphcanvas: this as any,
            },
            link,
            e
        );
    }

    createDefaultNodeForSlot(optPass?: any): boolean {
        return createDefaultNodeForSlotController(
            {
                host: this.menuHost(),
                menuClass: this.menuClass(),
                graphcanvas: this as any,
            },
            optPass
        );
    }

    showConnectionMenu(optPass?: any): false {
        this.setActiveCanvas();
        return showConnectionMenuController(
            {
                host: this.menuHost(),
                menuClass: this.menuClass(),
                graphcanvas: this as any,
            },
            optPass
        );
    }

    prompt(
        title: string,
        value: any,
        callback: ((value: any) => void) | null,
        event?: MouseEvent,
        multiline?: boolean
    ): DialogLike {
        this.setActiveCanvas();
        return showPromptDialog(
            {
                host: this.menuHost(),
                canvas: (this.menuClass().active_canvas as any)?.canvas || this.canvas,
                scale: this.ds.scale,
                graphcanvas: this as any,
                getPromptBox: () => this.prompt_box || null,
                setPromptBox: (dialog: DialogLike | null) => {
                    this.prompt_box = dialog;
                },
            },
            title || "",
            value,
            callback,
            event,
            multiline
        );
    }

    showSearchBox(event?: MouseEvent, options?: any): DialogLike {
        this.setActiveCanvas();
        return showSearchBoxController(
            {
                host: this.menuHost(),
                menuClass: this.menuClass(),
                graphcanvas: {
                    canvas: this.canvas,
                    ds: this.ds,
                    graph: this.graph,
                    filter: this.filter,
                    getSearchBox: () => this.search_box || null,
                    setSearchBox: (dialog: DialogLike | null) => {
                        this.search_box = dialog;
                    },
                    onSearchBoxSelection: this.onSearchBoxSelection,
                    onSearchBox: this.onSearchBox,
                    convertEventToCanvasOffset: this.convertEventToCanvasOffset.bind(this),
                    focusCanvas: () => {
                        this.canvas?.focus();
                    },
                } as SearchBoxControllerPort,
            },
            event,
            options
        );
    }

    showEditPropertyValue(node: any, property: any, options: any): DialogLike | void {
        return showEditPropertyValueDialog(
            {
                createDialog: this.createDialog.bind(this),
            },
            node,
            property,
            options
        );
    }

    createDialog(html: string, options?: any): DialogLike {
        return createDialog(
            {
                canvas: this.canvas,
                host: this.menuHost(),
            },
            html,
            options
        );
    }

    createPanel(title: string, options?: any): PanelLike {
        return createPanel(
            {
                host: this.menuHost(),
                menuClass: this.menuClass(),
                window: this.getCanvasWindow(),
                mount: (this.canvas?.parentNode as HTMLElement | null) || null,
            },
            title,
            options
        );
    }

    closePanels(): void {
        const nodePanel = document.querySelector("#node-panel") as any;
        nodePanel?.close?.();
        const optionPanel = document.querySelector("#option-panel") as any;
        optionPanel?.close?.();
    }

    showShowGraphOptionsPanel(_refOpts?: any, obEv?: any): void {
        let graphcanvas: any;
        if ((this as any).constructor?.name === "HTMLDivElement") {
            if (!obEv?.event?.target?.lgraphcanvas) {
                return;
            }
            graphcanvas = obEv.event.target.lgraphcanvas;
        } else {
            graphcanvas = this;
        }
        showGraphOptionsPanel({
            host: this.menuHost(),
            graphcanvas,
        });
    }

    showShowNodePanel(node: any): void {
        showNodePanel(
            {
                host: this.menuHost(),
                menuClass: this.menuClass(),
                graphcanvas: {
                    closePanels: this.closePanels.bind(this),
                    createPanel: this.createPanel.bind(this),
                    getCanvasWindow: this.getCanvasWindow.bind(this),
                    canvas: this.canvas,
                    graph: this.graph,
                },
                state: {
                    setSelectedNode: (selectedNode: any) => {
                        this.SELECTED_NODE = selectedNode;
                    },
                    setNodePanel: (panel: PanelLike | null) => {
                        this.node_panel = panel;
                    },
                    setNodePanelOpen: (open: boolean) => {
                        this.NODEPANEL_IS_OPEN = open;
                    },
                    markDirty: () => {
                        this.dirty_canvas = true;
                    },
                },
            },
            node
        );
    }

    showSubgraphPropertiesDialog(node: any): PanelLike {
        return showSubgraphIoPanel(
            {
                createPanel: this.createPanel.bind(this),
                canvas: this.canvas,
            },
            node,
            "inputs"
        );
    }

    showSubgraphPropertiesDialogRight(node: any): PanelLike {
        return showSubgraphIoPanel(
            {
                createPanel: this.createPanel.bind(this),
                canvas: this.canvas,
            },
            node,
            "outputs"
        );
    }

    checkPanels(): void {
        const parent = this.canvas?.parentNode;
        if (!parent) {
            return;
        }
        const panels = parent.querySelectorAll(".litegraph.dialog");
        panels.forEach((panel: any) => {
            if (!panel.node) {
                return;
            }
            if (!panel.node.graph || panel.graph != this.graph) {
                panel.close();
            }
        });
    }

    getCanvasMenuOptions(): any[] {
        return buildCanvasMenuOptions(this, this.menuClass());
    }
    getNodeMenuOptions(node: any): any[] {
        return buildNodeMenuOptions(this, this.menuClass(), node);
    }
    getGroupMenuOptions(_node: any): any[] {
        return buildGroupMenuOptions(this.menuClass());
    }

    processContextMenu(node: any, event: any): void {
        this.setActiveCanvas();
        processContextMenuController(
            {
                host: this.menuHost(),
                menuClass: this.menuClass(),
                graphcanvas: this as any,
            },
            node,
            event
        );
    }
}

