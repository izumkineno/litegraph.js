import type { GraphCanvasWidgetPort } from "../contracts/canvas";
import type { LGraphPersistence as LGraph } from "../models/LGraph.persistence";
import {
    buildCanvasMenuOptions,
    buildGroupMenuOptions,
    buildNodeMenuOptions,
} from "../services/context-menu-action-builder";
import { createDialog } from "../services/dialog-factory";
import {
    type DialogLike,
    type MenuPanelHost,
    type PanelLike,
    type SearchBoxControllerPort,
} from "../services/menu-panel-types";
import { createPanel } from "../services/panel-factory";
import { showSearchBoxController } from "../services/searchbox-controller";
import { LGraphCanvas as LGraphCanvasStatic } from "./LGraphCanvas.static";
import { LGraphCanvasRender } from "./LGraphCanvas.render";

/**
 * LGraphCanvas menu / panel / search layer.
 * Source: `showLinkMenu/showConnectionMenu/showSearchBox/createDialog/createPanel/processContextMenu`.
 */
export class LGraphCanvasMenuPanel
    extends LGraphCanvasRender
    implements GraphCanvasWidgetPort {
    [key: string]: any;

    private menuClass(): any {
        return LGraphCanvasStatic as any;
    }

    private menuHost(): any {
        const litegraph = this.getLiteGraphHost() as unknown as MenuPanelHost;
        return {
            ...litegraph,
            ContextMenu:
                litegraph.ContextMenu ||
                this.menuClass().ContextMenu ||
                class {
                    constructor(_v: any, _o: any, _w?: any) {}
                },
            ACTION: litegraph.ACTION ?? -1,
            EVENT: litegraph.EVENT ?? -1,
            NODE_MODES:
                litegraph.NODE_MODES || ["Always", "On Event", "Never", "On Trigger"],
            LINK_RENDER_MODES:
                litegraph.LINK_RENDER_MODES || ["Straight", "Linear", "Spline"],
            availableCanvasOptions: litegraph.availableCanvasOptions || [],
            slot_types_default_in: litegraph.slot_types_default_in || {},
            slot_types_default_out: litegraph.slot_types_default_out || {},
            slot_types_in: litegraph.slot_types_in || [],
            slot_types_out: litegraph.slot_types_out || [],
            registered_node_types: litegraph.registered_node_types || {},
            registered_slot_in_types: litegraph.registered_slot_in_types || {},
            registered_slot_out_types: litegraph.registered_slot_out_types || {},
            searchbox_extras: litegraph.searchbox_extras || {},
            search_filter_enabled: !!litegraph.search_filter_enabled,
            search_hide_on_mouse_leave: !!litegraph.search_hide_on_mouse_leave,
            search_show_all_on_open: !!litegraph.search_show_all_on_open,
            dialog_close_on_mouse_leave: litegraph.dialog_close_on_mouse_leave ?? true,
            dialog_close_on_mouse_leave_delay:
                litegraph.dialog_close_on_mouse_leave_delay ?? 500,
            getTime: litegraph.getTime || (() => Date.now()),
            createNode: litegraph.createNode || ((_: string) => null),
            pointerListenerAdd:
                litegraph.pointerListenerAdd ||
                ((dom: EventTarget, ev: string, cb: EventListenerOrEventListenerObject, capture?: boolean) => {
                    if ("addEventListener" in dom) {
                        (dom as any).addEventListener(ev, cb, !!capture);
                    }
                }),
            pointerListenerRemove:
                litegraph.pointerListenerRemove ||
                ((dom: EventTarget, ev: string, cb: EventListenerOrEventListenerObject, capture?: boolean) => {
                    if ("removeEventListener" in dom) {
                        (dom as any).removeEventListener(ev, cb, !!capture);
                    }
                }),
        };
    }

    private setActiveCanvas(): void {
        this.menuClass().active_canvas = this as any;
    }

    showLinkMenu(link: any, e: MouseEvent): false {
        this.setActiveCanvas();
        const host = this.menuHost();
        const node_left = this.graph.getNodeById(link.origin_id);
        const node_right = this.graph.getNodeById(link.target_id);
        let fromType: any = false;
        if (node_left && node_left.outputs && node_left.outputs[link.origin_slot]) {
            fromType = node_left.outputs[link.origin_slot].type;
        }
        let destType: any = false;
        if (node_right && node_right.outputs && node_right.outputs[link.target_slot]) {
            destType = node_right.inputs[link.target_slot].type;
        }

        const menu = new host.ContextMenu(
            ["Add Node", null, "Delete", null],
            {
                event: e,
                title: link.data != null ? link.data.constructor?.name || null : null,
                callback: (v: any, _opts: any, menuEvent: MouseEvent) => {
                    if (v === "Add Node") {
                        this.menuClass().onMenuAdd(null, null, menuEvent, menu, (node: any) => {
                            if (!node.inputs || !node.inputs.length || !node.outputs || !node.outputs.length) {
                                return;
                            }
                            if (node_left.connectByType(link.origin_slot, node, fromType)) {
                                node.connectByType(link.target_slot, node_right, destType);
                                node.pos[0] -= node.size[0] * 0.5;
                            }
                        });
                    } else if (v === "Delete") {
                        this.graph.removeLink(link.id);
                    }
                },
            },
            this.getCanvasWindow()
        );
        return false;
    }

    createDefaultNodeForSlot(optPass?: any): boolean {
        const host = this.menuHost();
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
            console.warn("No data passed to createDefaultNodeForSlot " + opts.nodeFrom + " " + opts.slotFrom + " " + opts.nodeTo + " " + opts.slotTo);
            return false;
        }
        if (!opts.nodeType) {
            console.warn("No type to createDefaultNodeForSlot");
            return false;
        }

        const nodeX = isFrom ? opts.nodeFrom : opts.nodeTo;
        let slotX: any = isFrom ? opts.slotFrom : opts.slotTo;
        let iSlotConn: any = false;
        if (typeof slotX === "string") {
            iSlotConn = isFrom
                ? nodeX.findOutputSlot(slotX, false)
                : nodeX.findInputSlot(slotX, false);
            slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX];
        } else if (typeof slotX === "object") {
            iSlotConn = isFrom
                ? nodeX.findOutputSlot(slotX.name)
                : nodeX.findInputSlot(slotX.name);
        } else if (typeof slotX === "number") {
            iSlotConn = slotX;
            slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX];
        } else {
            console.warn("Cant get slot information " + slotX);
            return false;
        }

        if (slotX === false || iSlotConn === false) {
            console.warn("createDefaultNodeForSlot bad slotX " + slotX + " " + iSlotConn);
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
            for (const i in slotDefault) {
                if (opts.nodeType == slotDefault[i] || opts.nodeType == "AUTO") {
                    nodeNewType = slotDefault[i];
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
        const newNode = host.createNode(nodeNewType);
        if (!newNode) {
            console.log("failed creating " + nodeNewType);
            return false;
        }
        if (nodeNewOpts) {
            if (nodeNewOpts.properties) {
                for (const i in nodeNewOpts.properties) {
                    newNode.addProperty(i, nodeNewOpts.properties[i]);
                }
            }
            if (nodeNewOpts.inputs) {
                newNode.inputs = [];
                for (const i in nodeNewOpts.inputs) {
                    newNode.addOutput(
                        nodeNewOpts.inputs[i][0],
                        nodeNewOpts.inputs[i][1]
                    );
                }
            }
            if (nodeNewOpts.outputs) {
                newNode.outputs = [];
                for (const i in nodeNewOpts.outputs) {
                    newNode.addOutput(
                        nodeNewOpts.outputs[i][0],
                        nodeNewOpts.outputs[i][1]
                    );
                }
            }
            if (nodeNewOpts.title) {
                newNode.title = nodeNewOpts.title;
            }
            if (nodeNewOpts.json) {
                newNode.configure(nodeNewOpts.json);
            }
        }

        this.graph.add(newNode);
        newNode.pos = [
            opts.position[0] +
                opts.posAdd[0] +
                (opts.posSizeFix[0] ? opts.posSizeFix[0] * newNode.size[0] : 0),
            opts.position[1] +
                opts.posAdd[1] +
                (opts.posSizeFix[1] ? opts.posSizeFix[1] * newNode.size[1] : 0),
        ];
        if (isFrom) {
            opts.nodeFrom.connectByType(iSlotConn, newNode, fromSlotType);
        } else {
            opts.nodeTo.connectByTypeOutput(iSlotConn, newNode, fromSlotType);
        }

        if (isFrom && isTo) {
            // TODO
        }
        return true;
    }

    showConnectionMenu(optPass?: any): false {
        this.setActiveCanvas();
        const host = this.menuHost();
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
        let iSlotConn: any = false;
        if (typeof slotX === "string") {
            iSlotConn = isFrom
                ? nodeX.findOutputSlot?.(slotX, false)
                : nodeX.findInputSlot?.(slotX, false);
            slotX = isFrom ? nodeX.outputs?.[iSlotConn] : nodeX.inputs?.[iSlotConn];
        } else if (typeof slotX === "object") {
            iSlotConn = isFrom
                ? nodeX.findOutputSlot?.(slotX.name)
                : nodeX.findInputSlot?.(slotX.name);
        } else if (typeof slotX === "number") {
            iSlotConn = slotX;
            slotX = isFrom ? nodeX.outputs?.[slotX] : nodeX.inputs?.[slotX];
        } else {
            return false;
        }

        const fromSlotType = slotX.type == host.EVENT ? "_event_" : slotX.type;
        const options: any[] = ["Add Node", null];
        if (this.allow_searchbox) {
            options.push("Search", null);
        }
        const slotTypesDefault = isFrom
            ? host.slot_types_default_out
            : host.slot_types_default_in;
        if (slotTypesDefault?.[fromSlotType]) {
            if (typeof slotTypesDefault[fromSlotType] === "object") {
                for (const i in slotTypesDefault[fromSlotType]) {
                    options.push(slotTypesDefault[fromSlotType][i]);
                }
            } else {
                options.push(slotTypesDefault[fromSlotType]);
            }
        }

        const menu = new host.ContextMenu(options, {
            event: opts.e,
            title:
                (slotX?.name ? slotX.name + (fromSlotType ? " | " : "") : "") +
                (fromSlotType || ""),
                callback: (v: any, _menuOpt: any, e: any) => {
                    if (v === "Add Node") {
                        this.menuClass().onMenuAdd(null, null, e, menu, (node: any) => {
                            if (isFrom) {
                                opts.nodeFrom.connectByType(iSlotConn, node, fromSlotType);
                            } else {
                                opts.nodeTo.connectByTypeOutput(iSlotConn, node, fromSlotType);
                            }
                        });
                    } else if (v === "Search") {
                    if (isFrom) {
                        this.showSearchBox(e, {
                            node_from: opts.nodeFrom,
                            slot_from: slotX,
                            type_filter_in: fromSlotType,
                        });
                    } else {
                        this.showSearchBox(e, {
                            node_to: opts.nodeTo,
                            slot_from: slotX,
                            type_filter_out: fromSlotType,
                        });
                    }
                } else {
                    this.createDefaultNodeForSlot(
                        Object.assign(opts, {
                            position: [opts.e.canvasX, opts.e.canvasY],
                            nodeType: v,
                        })
                    );
                }
            },
        });
        return false;
    }

    prompt(
        title: string,
        value: any,
        callback: ((value: any) => void) | null,
        event?: MouseEvent,
        multiline?: boolean
    ): DialogLike {
        this.setActiveCanvas();
        const host = this.menuHost();
        title = title || "";
        const dialog = document.createElement("div") as DialogLike;
        dialog.is_modified = false;
        dialog.className = "graphdialog rounded";
        dialog.innerHTML = multiline
            ? "<span class='name'></span> <textarea autofocus class='value'></textarea><button class='rounded'>OK</button>"
            : "<span class='name'></span> <input autofocus type='text' class='value'/><button class='rounded'>OK</button>";
        dialog.modified = () => {
            dialog.is_modified = true;
        };
        dialog.close = () => {
            this.prompt_box = null;
            dialog.parentNode?.removeChild(dialog);
        };

        const canvas = (this.menuClass().active_canvas as any)?.canvas || this.canvas;
        canvas.parentNode?.appendChild(dialog);
        if (this.ds.scale > 1) {
            dialog.style.transform = "scale(" + this.ds.scale + ")";
        }

        let closeTimer: ReturnType<typeof setTimeout> | null = null;
        let prevent_timeout: any = false;
        host.pointerListenerAdd(dialog, "leave", () => {
            if (prevent_timeout) {
                return;
            }
            if (host.dialog_close_on_mouse_leave && !dialog.is_modified) {
                closeTimer = setTimeout(dialog.close, host.dialog_close_on_mouse_leave_delay);
            }
        });
        host.pointerListenerAdd(dialog, "enter", () => {
            if (closeTimer) {
                clearTimeout(closeTimer);
            }
        });
        const selInDia = dialog.querySelectorAll("select");
        if (selInDia) {
            selInDia.forEach((selIn) => {
                selIn.addEventListener("click", () => {
                    prevent_timeout++;
                });
                selIn.addEventListener("blur", () => {
                    prevent_timeout = 0;
                });
                selIn.addEventListener("change", () => {
                    prevent_timeout = -1;
                });
            });
        }

        if (this.prompt_box) {
            this.prompt_box.close();
        }
        this.prompt_box = dialog;

        const nameEl = dialog.querySelector(".name") as HTMLElement | null;
        const inputEl = dialog.querySelector(".value") as
            | HTMLInputElement
            | HTMLTextAreaElement
            | null;
        if (nameEl) {
            nameEl.innerText = title || "";
        }
        if (inputEl) {
            inputEl.value = value;
            inputEl.addEventListener("keydown", (e: Event) => {
                const keyEvent = e as KeyboardEvent;
                dialog.is_modified = true;
                if (keyEvent.key === "Escape") {
                    dialog.close();
                } else if (
                    keyEvent.key === "Enter" &&
                    (keyEvent.target as HTMLElement).localName != "textarea"
                ) {
                    callback?.(inputEl.value);
                    dialog.close();
                } else {
                    return;
                }
                keyEvent.preventDefault();
                keyEvent.stopPropagation();
            });
        }
        dialog.querySelector("button")?.addEventListener("click", () => {
            callback?.(inputEl?.value);
            this.setDirty(true, false);
            dialog.close();
        });

        const rect = canvas.getBoundingClientRect();
        let x = -20;
        let y = -20;
        if (rect) {
            x -= rect.left;
            y -= rect.top;
        }
        if (event) {
            x += event.clientX;
            y += event.clientY;
        } else {
            x += canvas.width * 0.5;
            y += canvas.height * 0.5;
        }
        dialog.style.left = x + "px";
        dialog.style.top = y + "px";
        setTimeout(() => inputEl?.focus(), 10);
        return dialog;
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
        if (!node || node.properties[property] === undefined) {
            return;
        }

        options = options || {};

        const info = node.getPropertyInfo(property);
        const type = info.type;

        let input_html = "";

        if (type == "string" || type == "number" || type == "array" || type == "object") {
            input_html = "<input autofocus type='text' class='value'/>";
        } else if ((type == "enum" || type == "combo") && info.values) {
            input_html = "<select autofocus type='text' class='value'>";
            for (const i in info.values) {
                let v: any = i;
                if (info.values.constructor === Array) {
                    v = info.values[i];
                }

                input_html +=
                    "<option value='" +
                    v +
                    "' " +
                    (v == node.properties[property] ? "selected" : "") +
                    ">" +
                    info.values[i] +
                    "</option>";
            }
            input_html += "</select>";
        } else if (type == "boolean" || type == "toggle") {
            input_html =
                "<input autofocus type='checkbox' class='value' " +
                (node.properties[property] ? "checked" : "") +
                "/>";
        } else {
            console.warn("unknown type: " + type);
            return;
        }

        const dialog = this.createDialog(
            "<span class='name'>" +
                (info.label ? info.label : property) +
                "</span>" +
                input_html +
                "<button>OK</button>",
            options
        );

        let input: any = false;
        if ((type == "enum" || type == "combo") && info.values) {
            input = dialog.querySelector("select");
            input.addEventListener("change", function(e: Event) {
                dialog.modified();
                setValue((e.target as HTMLSelectElement).value);
            });
        } else if (type == "boolean" || type == "toggle") {
            input = dialog.querySelector("input");
            if (input) {
                input.addEventListener("click", function() {
                    dialog.modified();
                    setValue(!!input.checked);
                });
            }
        } else {
            input = dialog.querySelector("input");
            if (input) {
                input.addEventListener("blur", function(this: HTMLInputElement) {
                    this.focus();
                });

                let v = node.properties[property] !== undefined ? node.properties[property] : "";
                if (type !== "string") {
                    v = JSON.stringify(v);
                }

                input.value = v;
                input.addEventListener("keydown", function(e: KeyboardEvent) {
                    if (e.keyCode == 27) {
                        dialog.close();
                    } else if (e.keyCode == 13) {
                        inner();
                    } else if (e.keyCode != 13) {
                        dialog.modified();
                        return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                });
            }
        }
        if (input) input.focus();

        const button = dialog.querySelector("button");
        button?.addEventListener("click", inner);

        function inner() {
            setValue(input.value);
        }

        function setValue(value: any) {
            if (info && info.values && info.values.constructor === Object && info.values[value] != undefined) {
                value = info.values[value];
            }

            if (typeof node.properties[property] == "number") {
                value = Number(value);
            }
            if (type == "array" || type == "object") {
                value = JSON.parse(value);
            }
            node.properties[property] = value;
            if (node.graph) {
                node.graph._version++;
            }
            if (node.onPropertyChanged) {
                node.onPropertyChanged(property, value);
            }
            if (options.onclose) {
                options.onclose();
            }
            dialog.close();
            node.setDirtyCanvas(true, true);
        }

        return dialog;
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
        const host = this.menuHost();
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
            const props = [...host.availableCanvasOptions];
            props.sort();
            for (const p of props) {
                panel.addWidget(
                    "boolean",
                    p,
                    graphcanvas[p],
                    { key: p, on: "True", off: "False" },
                    update
                );
            }
            panel.addWidget(
                "combo",
                "Render mode",
                host.LINK_RENDER_MODES[graphcanvas.links_render_mode],
                { key: "links_render_mode", values: host.LINK_RENDER_MODES },
                update
            );
            panel.addSeparator();
            panel.footer.innerHTML = "";
        };
        refresh();
        graphcanvas.canvas.parentNode?.appendChild(panel);
    }

    showShowNodePanel(node: any): void {
        this.SELECTED_NODE = node;
        this.closePanels();
        const host = this.menuHost();
        const panel = this.createPanel(node.title || "", {
            closable: true,
            window: this.getCanvasWindow(),
            onOpen: () => {
                this.NODEPANEL_IS_OPEN = true;
            },
            onClose: () => {
                this.NODEPANEL_IS_OPEN = false;
                this.node_panel = null;
            },
        });
        this.node_panel = panel;
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
                this.graph.beforeChange?.(node);
                if (name === "Title") {
                    node.title = value;
                } else if (name === "Mode") {
                    const idx = Object.values(host.NODE_MODES).indexOf(value);
                    if (idx >= 0) {
                        node.changeMode?.(idx);
                    }
                } else if (name === "Color") {
                    const color = this.menuClass().node_colors?.[value];
                    if (color) {
                        node.color = color.color;
                        node.bgcolor = color.bgcolor;
                    }
                } else {
                    node.setProperty?.(name, value);
                }
                this.graph.afterChange?.();
                this.dirty_canvas = true;
            };
            panel.addWidget("string", "Title", node.title, {}, update);
            panel.addWidget(
                "combo",
                "Mode",
                host.NODE_MODES[node.mode],
                { values: host.NODE_MODES },
                update
            );
            const nodeCol =
                node.color !== undefined
                    ? Object.keys(this.menuClass().node_colors || {}).filter(
                          (k) => this.menuClass().node_colors[k].color == node.color
                      )
                    : "";
            panel.addWidget(
                "combo",
                "Color",
                nodeCol,
                { values: Object.keys(this.menuClass().node_colors || {}) },
                update
            );
            for (const pName in node.properties) {
                const value = node.properties[pName];
                const info = node.getPropertyInfo?.(pName) || {};
                if (node.onAddPropertyToPanel?.(pName, panel)) {
                    continue;
                }
                panel.addWidget(info.widget || info.type || "string", pName, value, info, update);
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

        panel.inner_showCodePad = (propname: string) => {
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
            textarea.value = node.properties[propname];
            textarea.addEventListener("keydown", (e: KeyboardEvent) => {
                if (e.code === "Enter" && e.ctrlKey) {
                    node.setProperty?.(propname, textarea.value);
                    done();
                }
            });
            panel.toggleAltContent(true);
            panel.toggleFooterVisibility(false);
            textarea.style.height = "calc(100% - 40px)";
            const assign = panel.addButton("Assign", () => {
                node.setProperty?.(propname, textarea.value);
                done();
            });
            panel.alt_content.appendChild(assign);
            const close = panel.addButton("Close", done);
            close.style.float = "right";
            panel.alt_content.appendChild(close);
        };

        refresh();
        this.canvas?.parentNode?.appendChild(panel);
    }

    showSubgraphPropertiesDialog(node: any): PanelLike {
        const old_panel = this.canvas?.parentNode?.querySelector(".subgraph_dialog") as any;
        old_panel?.close?.();
        const panel = this.createPanel("Subgraph Inputs", { closable: true, width: 500 });
        panel.node = node;
        panel.classList.add("subgraph_dialog");

        const refresh = (): void => {
            panel.clear();
            if (!node.inputs) {
                return;
            }
            for (let i = 0; i < node.inputs.length; ++i) {
                const input = node.inputs[i];
                if (input.not_subgraph_input) {
                    continue;
                }
                const html =
                    "<button>&#10005;</button> <span class='bullet_icon'></span><span class='name'></span><span class='type'></span>";
                const elem = panel.addHTML(html, "subgraph_property");
                (elem.dataset as any).name = input.name;
                (elem.dataset as any).slot = String(i);
                (elem.querySelector(".name") as HTMLElement).innerText = input.name;
                (elem.querySelector(".type") as HTMLElement).innerText = input.type;
                elem.querySelector("button")?.addEventListener("click", function(this: HTMLButtonElement) {
                    node.removeInput?.(Number((this.parentNode as any).dataset.slot));
                    refresh();
                });
            }
        };

        const html =
            " + <span class='label'>Name</span><input class='name'/><span class='label'>Type</span><input class='type'></input><button>+</button>";
        const addRow = panel.addHTML(html, "subgraph_property extra", true);
        addRow.querySelector("button")?.addEventListener("click", function(this: HTMLButtonElement) {
            const p = this.parentNode as HTMLElement;
            const name = (p.querySelector(".name") as HTMLInputElement).value;
            const type = (p.querySelector(".type") as HTMLInputElement).value;
            if (!name || node.findInputSlot?.(name) != -1) {
                return;
            }
            node.addInput?.(name, type);
            (p.querySelector(".name") as HTMLInputElement).value = "";
            (p.querySelector(".type") as HTMLInputElement).value = "";
            refresh();
        });

        refresh();
        this.canvas?.parentNode?.appendChild(panel);
        return panel;
    }

    showSubgraphPropertiesDialogRight(node: any): PanelLike {
        const old_panel = this.canvas?.parentNode?.querySelector(".subgraph_dialog") as any;
        old_panel?.close?.();
        const panel = this.createPanel("Subgraph Outputs", { closable: true, width: 500 });
        panel.node = node;
        panel.classList.add("subgraph_dialog");

        const refresh = (): void => {
            panel.clear();
            if (!node.outputs) {
                return;
            }
            for (let i = 0; i < node.outputs.length; ++i) {
                const output = node.outputs[i];
                if (output.not_subgraph_output) {
                    continue;
                }
                const html =
                    "<button>&#10005;</button> <span class='bullet_icon'></span><span class='name'></span><span class='type'></span>";
                const elem = panel.addHTML(html, "subgraph_property");
                (elem.dataset as any).name = output.name;
                (elem.dataset as any).slot = String(i);
                (elem.querySelector(".name") as HTMLElement).innerText = output.name;
                (elem.querySelector(".type") as HTMLElement).innerText = output.type;
                elem.querySelector("button")?.addEventListener("click", function(this: HTMLButtonElement) {
                    node.removeOutput?.(Number((this.parentNode as any).dataset.slot));
                    refresh();
                });
            }
        };

        const html =
            " + <span class='label'>Name</span><input class='name'/><span class='label'>Type</span><input class='type'></input><button>+</button>";
        const addRow = panel.addHTML(html, "subgraph_property extra", true);
        const addOutput = function(this: HTMLElement): void {
            const p = this.parentNode as HTMLElement;
            const name = (p.querySelector(".name") as HTMLInputElement).value;
            const type = (p.querySelector(".type") as HTMLInputElement).value;
            if (!name || node.findOutputSlot?.(name) != -1) {
                return;
            }
            node.addOutput?.(name, type);
            (p.querySelector(".name") as HTMLInputElement).value = "";
            (p.querySelector(".type") as HTMLInputElement).value = "";
            refresh();
        };
        addRow
            .querySelector(".name")
            ?.addEventListener("keydown", function(this: HTMLElement, e: Event) {
            const keyEvent = e as KeyboardEvent;
            if (keyEvent.key === "Enter") {
                addOutput.apply(this as unknown as HTMLElement);
            }
        });
        addRow
            .querySelector("button")
            ?.addEventListener("click", function(this: HTMLElement) {
            addOutput.apply(this as unknown as HTMLElement);
        });

        refresh();
        this.canvas?.parentNode?.appendChild(panel);
        return panel;
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
        const host = this.menuHost();
        const CanvasClass = this.menuClass();
        const ref_window = this.getCanvasWindow();
        let menu_info: any[] | null = null;
        const options: any = {
            event,
            callback: inner_option_clicked,
            extra: node,
        };
        if (node) {
            options.title = node.type;
        }

        let slot: any = null;
        if (node) {
            slot = node.getSlotInPosition?.(event.canvasX, event.canvasY);
            CanvasClass.active_node = node;
        }

        if (slot) {
            menu_info = [];
            if (node.getSlotMenuOptions) {
                menu_info = node.getSlotMenuOptions(slot);
            } else {
                if (slot?.output?.links?.length) {
                    menu_info.push({ content: "Disconnect Links", slot });
                }
                const s = slot.input || slot.output;
                if (s?.removable) {
                    menu_info.push(s.locked ? "Cannot remove" : { content: "Remove Slot", slot });
                }
                if (!s?.nameLocked) {
                    menu_info.push({ content: "Rename Slot", slot });
                }
            }
            options.title = (slot.input ? slot.input.type : slot.output.type) || "*";
            if (slot.input?.type == host.ACTION) {
                options.title = "Action";
            }
            if (slot.output?.type == host.EVENT) {
                options.title = "Event";
            }
        } else if (node) {
            menu_info = this.getNodeMenuOptions(node);
        } else {
            menu_info = this.getCanvasMenuOptions();
            const group = this.graph.getGroupOnPos?.(event.canvasX, event.canvasY);
            if (group) {
                menu_info.push(
                    null,
                    {
                        content: "Edit Group",
                        has_submenu: true,
                        submenu: {
                            title: "Group",
                            extra: group,
                            options: this.getGroupMenuOptions(group),
                        },
                    }
                );
            }
        }
        if (!menu_info) {
            return;
        }
        new host.ContextMenu(menu_info, options, ref_window);

        const that = this;
        function inner_option_clicked(v: any, opts: any): void {
            if (!v) {
                return;
            }
            if (v.content == "Remove Slot") {
                const info = v.slot;
                node.graph.beforeChange();
                if (info.input) {
                    node.removeInput(info.slot);
                } else if (info.output) {
                    node.removeOutput(info.slot);
                }
                node.graph.afterChange();
                return;
            }
            if (v.content == "Disconnect Links") {
                const info = v.slot;
                node.graph.beforeChange();
                if (info.output) {
                    node.disconnectOutput(info.slot);
                } else if (info.input) {
                    node.disconnectInput(info.slot);
                }
                node.graph.afterChange();
                return;
            }
            if (v.content == "Rename Slot") {
                const info = v.slot;
                const slot_info = info.input
                    ? node.getInputInfo?.(info.slot)
                    : node.getOutputInfo?.(info.slot);
                const dialog = that.createDialog(
                    "<span class='name'>Name</span><input autofocus type='text'/><button>OK</button>",
                    opts
                );
                const input = dialog.querySelector("input") as HTMLInputElement | null;
                if (input && slot_info) {
                    input.value = slot_info.label || "";
                }
                const inner = (): void => {
                    node.graph.beforeChange();
                    if (input?.value) {
                        if (slot_info) {
                            slot_info.label = input.value;
                        }
                        that.setDirty(true, false);
                    }
                    dialog.close();
                    node.graph.afterChange();
                };
                dialog.querySelector("button")?.addEventListener("click", inner);
                input?.addEventListener("keydown", (e: KeyboardEvent) => {
                    dialog.is_modified = true;
                    if (e.key === "Escape") {
                        dialog.close();
                    } else if (e.key === "Enter") {
                        inner();
                    } else {
                        return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                });
                input?.focus();
            }
        }
    }
}

