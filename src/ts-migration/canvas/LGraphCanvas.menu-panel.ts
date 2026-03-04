// TODO: Import LGraph from its future module
// TODO: Import LGraphNode from its future module
// TODO: Import LGraphGroup from its future module
// TODO: Import ContextMenu from its future module
// TODO: Import full LiteGraph runtime host from its future module

import { LGraphCanvas as LGraphCanvasStatic } from "./LGraphCanvas.static";
import { LGraphCanvasRender } from "./LGraphCanvas.render";

interface DialogLike extends HTMLDivElement {
    is_modified: boolean;
    close: () => void;
    modified: () => void;
    _remove_outside_close?: (() => void) | null;
}

interface PanelLike extends HTMLDivElement {
    header: HTMLElement;
    title_element: HTMLElement;
    content: HTMLElement;
    alt_content: HTMLElement;
    footer: HTMLElement;
    close: () => void;
    clear: () => void;
    addHTML: (code: string, className?: string, on_footer?: boolean) => HTMLElement;
    addButton: (
        name: string,
        callback: (e: MouseEvent) => void,
        options?: any
    ) => HTMLButtonElement;
    addSeparator: () => void;
    addWidget: (
        type: string,
        name: string,
        value: any,
        options?: any,
        callback?: (name: string, value: any, options?: any) => void
    ) => HTMLElement;
    toggleAltContent: (force?: boolean) => void;
    toggleFooterVisibility: (force?: boolean) => void;
    inner_showCodePad?: (propname: string) => void;
    node?: any;
    graph?: any;
}

/**
 * LGraphCanvas menu / panel / search layer.
 * Source: `showLinkMenu/showConnectionMenu/showSearchBox/createDialog/createPanel/processContextMenu`.
 */
export class LGraphCanvasMenuPanel extends LGraphCanvasRender {
    [key: string]: any;

    private menuClass(): any {
        return LGraphCanvasStatic as any;
    }

    private menuHost(): any {
        const litegraph = this.getLiteGraphHost() as any;
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
        const node_left = this.graph?.getNodeById?.(link.origin_id);
        const node_right = this.graph?.getNodeById?.(link.target_id);
        const fromType =
            node_left?.outputs?.[link.origin_slot]?.type !== undefined
                ? node_left.outputs[link.origin_slot].type
                : false;
        const destType =
            node_right?.inputs?.[link.target_slot]?.type !== undefined
                ? node_right.inputs[link.target_slot].type
                : false;

        const menu = new host.ContextMenu(
            ["Add Node", null, "Delete", null],
            {
                event: e,
                title: link.data != null ? link.data.constructor?.name || null : null,
                callback: (v: any, _opts: any, menuEvent: MouseEvent) => {
                    if (v === "Add Node") {
                        this.menuClass().onMenuAdd(null, null, menuEvent, menu, (node: any) => {
                            if (!node?.inputs?.length || !node?.outputs?.length) {
                                return;
                            }
                            if (node_left?.connectByType?.(link.origin_slot, node, fromType)) {
                                node.connectByType?.(link.target_slot, node_right, destType);
                                node.pos[0] -= node.size[0] * 0.5;
                            }
                        });
                    } else if (v === "Delete") {
                        this.graph?.removeLink?.(link.id);
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
        if ((!isFrom && !isTo) || !opts.nodeType) {
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

        if (!slotX || iSlotConn === false) {
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
            return false;
        }
        if (nodeNewOpts?.properties) {
            for (const i in nodeNewOpts.properties) {
                newNode.addProperty?.(i, nodeNewOpts.properties[i]);
            }
        }
        if (nodeNewOpts?.title) {
            newNode.title = nodeNewOpts.title;
        }
        if (nodeNewOpts?.json) {
            newNode.configure?.(nodeNewOpts.json);
        }

        this.graph?.add?.(newNode);
        newNode.pos = [
            opts.position[0] +
                opts.posAdd[0] +
                (opts.posSizeFix[0] ? opts.posSizeFix[0] * newNode.size[0] : 0),
            opts.position[1] +
                opts.posAdd[1] +
                (opts.posSizeFix[1] ? opts.posSizeFix[1] * newNode.size[1] : 0),
        ];
        if (isFrom) {
            opts.nodeFrom.connectByType?.(iSlotConn, newNode, fromSlotType);
        } else {
            opts.nodeTo.connectByTypeOutput?.(iSlotConn, newNode, fromSlotType);
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
                            opts.nodeFrom.connectByType?.(iSlotConn, node, fromSlotType);
                        } else {
                            opts.nodeTo.connectByTypeOutput?.(iSlotConn, node, fromSlotType);
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
        let closeTimer: ReturnType<typeof setTimeout> | null = null;
        host.pointerListenerAdd(dialog, "leave", () => {
            if (host.dialog_close_on_mouse_leave && !dialog.is_modified) {
                closeTimer = setTimeout(dialog.close, host.dialog_close_on_mouse_leave_delay);
            }
        });
        host.pointerListenerAdd(dialog, "enter", () => {
            if (closeTimer) {
                clearTimeout(closeTimer);
            }
        });

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
            inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
                dialog.is_modified = true;
                if (e.key === "Escape") {
                    dialog.close();
                } else if (e.key === "Enter" && (e.target as HTMLElement).localName != "textarea") {
                    callback?.(inputEl.value);
                    dialog.close();
                } else {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
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
        const host = this.menuHost();
        const hasSlotTypes = !!(
            (host.slot_types_in && host.slot_types_in.length) ||
            (host.slot_types_out && host.slot_types_out.length)
        );
        const opts = Object.assign(
            {
                slot_from: null,
                node_from: null,
                node_to: null,
                do_type_filter: host.search_filter_enabled && hasSlotTypes,
                type_filter_in: false,
                type_filter_out: false,
                show_all_if_empty: true,
                show_all_on_open: host.search_show_all_on_open,
                hide_on_mouse_leave: host.search_hide_on_mouse_leave,
            },
            options || {}
        );
        if (opts.do_type_filter && !hasSlotTypes) {
            opts.do_type_filter = false;
        }

        const graphcanvas = this.menuClass().active_canvas as any;
        const canvas = graphcanvas?.canvas || this.canvas;
        const root_document = canvas.ownerDocument || document;
        const dialog = document.createElement("div") as DialogLike;
        dialog.is_modified = false;
        dialog.className = "litegraph litesearchbox graphdialog rounded";
        dialog.innerHTML =
            "<span class='name'>Search</span> <input autofocus type='text' class='value rounded'/>";
        if (opts.do_type_filter) {
            dialog.innerHTML += "<select class='slot_in_type_filter'><option value=''></option></select>";
            dialog.innerHTML += "<select class='slot_out_type_filter'><option value=''></option></select>";
        }
        dialog.innerHTML += "<div class='helper'></div>";
        (root_document.fullscreenElement || root_document.body).appendChild(dialog);
        dialog.modified = () => {
            dialog.is_modified = true;
        };
        dialog.close = () => {
            this.search_box = null;
            root_document.body.style.overflow = "";
            if (dialog._remove_outside_close) {
                dialog._remove_outside_close();
            }
            dialog.parentNode?.removeChild(dialog);
        };

        this.search_box?.close?.();
        this.search_box = dialog;
        const helper = dialog.querySelector(".helper") as HTMLDivElement;
        const input = dialog.querySelector("input") as HTMLInputElement;
        const inSel = dialog.querySelector(".slot_in_type_filter") as HTMLSelectElement | null;
        const outSel = dialog.querySelector(".slot_out_type_filter") as HTMLSelectElement | null;

        const addResult = (name: string): void => {
            const div = document.createElement("div");
            div.innerText = name;
            div.className = "litegraph lite-search-item";
            div.addEventListener("click", () => select(name));
            helper.appendChild(div);
        };

        const select = (name: string): void => {
            if (this.onSearchBoxSelection) {
                this.onSearchBoxSelection(name, event, graphcanvas);
            } else {
                const extra = host.searchbox_extras?.[name.toLowerCase()];
                if (extra) {
                    name = extra.type;
                }
                graphcanvas.graph.beforeChange?.();
                const node = host.createNode(name);
                if (node) {
                    node.pos = event
                        ? graphcanvas.convertEventToCanvasOffset(event)
                        : [this.graph_mouse[0], this.graph_mouse[1]];
                    graphcanvas.graph.add(node, false);
                }
                graphcanvas.graph.afterChange?.();
            }
            dialog.close();
        };

        const refresh = (): void => {
            const str = input.value.toLowerCase();
            helper.innerHTML = "";
            if (!str && !opts.show_all_if_empty) {
                return;
            }
            if (this.onSearchBox) {
                const list = this.onSearchBox(helper, str, graphcanvas) as any[] | null;
                if (list && list.length) {
                    for (const r of list) {
                        addResult(String(r));
                    }
                }
                return;
            }

            const all = Object.keys(host.registered_node_types || {});
            const filterBySlot = (type: string): boolean => {
                if (inSel?.value) {
                    const info = host.registered_slot_in_types?.[inSel.value];
                    if (info?.nodes && !info.nodes.includes(type)) {
                        return false;
                    }
                }
                if (outSel?.value) {
                    const info = host.registered_slot_out_types?.[outSel.value];
                    if (info?.nodes && !info.nodes.includes(type)) {
                        return false;
                    }
                }
                return true;
            };

            for (const type of all) {
                if (str && type.toLowerCase().indexOf(str) === -1) {
                    continue;
                }
                if (!filterBySlot(type)) {
                    continue;
                }
                addResult(type);
            }
        };

        input.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                dialog.close();
            } else if (e.key === "Enter") {
                const first = helper.firstElementChild as HTMLElement | null;
                if (first) {
                    select(first.innerText);
                } else {
                    dialog.close();
                }
            } else {
                setTimeout(refresh, 0);
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        });

        if (inSel) {
            host.slot_types_in.forEach((v: string) => {
                const opt = document.createElement("option");
                opt.value = v;
                opt.innerText = v;
                inSel.appendChild(opt);
            });
            inSel.addEventListener("change", refresh);
        }
        if (outSel) {
            host.slot_types_out.forEach((v: string) => {
                const opt = document.createElement("option");
                opt.value = v;
                opt.innerText = v;
                outSel.appendChild(opt);
            });
            outSel.addEventListener("change", refresh);
        }

        const onOutsideDown = (ev: Event): void => {
            if (!dialog.contains(ev.target as Node)) {
                dialog.close();
            }
        };
        root_document.addEventListener("mousedown", onOutsideDown, true);
        root_document.addEventListener("touchstart", onOutsideDown, true);
        dialog._remove_outside_close = () => {
            root_document.removeEventListener("mousedown", onOutsideDown, true);
            root_document.removeEventListener("touchstart", onOutsideDown, true);
        };

        const rect = canvas.getBoundingClientRect();
        dialog.style.left =
            ((event ? event.clientX : rect.left + rect.width * 0.5) - 80) + "px";
        dialog.style.top =
            ((event ? event.clientY : rect.top + rect.height * 0.5) - 20) + "px";

        input.focus();
        if (opts.show_all_on_open) {
            refresh();
        }
        return dialog;
    }

    showEditPropertyValue(node: any, property: any, options: any): DialogLike | void {
        if (!node || node.properties?.[property] === undefined) {
            return;
        }
        const info = node.getPropertyInfo?.(property) || {};
        const type = info.type || "string";
        let input_html = "<input autofocus type='text' class='value'/>";
        if ((type == "enum" || type == "combo") && info.values) {
            input_html = "<select autofocus class='value'>";
            for (const i in info.values) {
                const v = info.values.constructor === Array ? info.values[i] : i;
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
        }

        const dialog = this.createDialog(
            "<span class='name'>" +
                (info.label ? info.label : property) +
                "</span>" +
                input_html +
                "<button>OK</button>",
            options || {}
        );
        const input = dialog.querySelector(".value") as any;
        const setValue = (value: any): void => {
            if (type == "array" || type == "object") {
                value = JSON.parse(value);
            } else if (typeof node.properties[property] == "number") {
                value = Number(value);
            } else if (type == "boolean" || type == "toggle") {
                value = !!value;
            }
            node.properties[property] = value;
            node.graph && (node.graph._version += 1);
            node.onPropertyChanged?.(property, value);
            options?.onclose?.();
            dialog.close();
            node.setDirtyCanvas?.(true, true);
        };

        dialog.querySelector("button")?.addEventListener("click", () => {
            setValue(type == "boolean" || type == "toggle" ? input.checked : input.value);
        });
        input?.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                dialog.close();
            } else if (e.key === "Enter") {
                setValue(type == "boolean" || type == "toggle" ? input.checked : input.value);
            } else {
                dialog.modified();
                return;
            }
            e.preventDefault();
            e.stopPropagation();
        });
        input?.focus();
        return dialog;
    }

    createDialog(html: string, options?: any): DialogLike {
        const host = this.menuHost();
        const opts = Object.assign(
            {
                checkForInput: false,
                closeOnLeave: true,
                closeOnLeave_checkModified: true,
                closeOnClickOutside: true,
            },
            options || {}
        );
        const dialog = document.createElement("div") as DialogLike;
        dialog.className = "graphdialog";
        dialog.innerHTML = html;
        dialog.is_modified = false;
        dialog.modified = () => {
            dialog.is_modified = true;
        };
        dialog.close = () => {
            dialog._remove_outside_close?.();
            dialog.parentNode?.removeChild(dialog);
        };

        const rect = this.canvas.getBoundingClientRect();
        let x = -20;
        let y = -20;
        if (rect) {
            x -= rect.left;
            y -= rect.top;
        }
        if (opts.position) {
            x += opts.position[0];
            y += opts.position[1];
        } else if (opts.event) {
            x += opts.event.clientX;
            y += opts.event.clientY;
        } else {
            x += this.canvas.width * 0.5;
            y += this.canvas.height * 0.5;
        }
        dialog.style.left = x + "px";
        dialog.style.top = y + "px";
        this.canvas.parentNode?.appendChild(dialog);

        if (opts.closeOnLeave && host.dialog_close_on_mouse_leave) {
            let timer: ReturnType<typeof setTimeout> | null = null;
            host.pointerListenerAdd(dialog, "leave", () => {
                if (opts.closeOnLeave_checkModified && dialog.is_modified) {
                    return;
                }
                timer = setTimeout(dialog.close, host.dialog_close_on_mouse_leave_delay);
            });
            host.pointerListenerAdd(dialog, "enter", () => {
                if (timer) {
                    clearTimeout(timer);
                }
            });
        }
        if (opts.closeOnClickOutside) {
            const root = this.canvas.ownerDocument || document;
            const onOutsideDown = (e: Event): void => {
                if (!dialog.contains(e.target as Node)) {
                    dialog.close();
                }
            };
            root.addEventListener("mousedown", onOutsideDown, true);
            root.addEventListener("touchstart", onOutsideDown, true);
            dialog._remove_outside_close = () => {
                root.removeEventListener("mousedown", onOutsideDown, true);
                root.removeEventListener("touchstart", onOutsideDown, true);
            };
        }
        dialog.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                dialog.close();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        return dialog;
    }

    createPanel(title: string, options?: any): PanelLike {
        options = options || {};
        const host = this.menuHost();
        const ref_window = options.window || window;
        const root = document.createElement("div") as PanelLike;
        root.className = "litegraph dialog";
        root.innerHTML =
            "<div class='dialog-header'><span class='dialog-title'></span></div><div class='dialog-content'></div><div style='display:none;' class='dialog-alt-content'></div><div class='dialog-footer'></div>";
        root.header = root.querySelector(".dialog-header") as HTMLElement;
        if (options.width) {
            root.style.width = options.width + (options.width.constructor === Number ? "px" : "");
        }
        if (options.height) {
            root.style.height = options.height + (options.height.constructor === Number ? "px" : "");
        }
        if (options.closable) {
            const close = document.createElement("span");
            close.innerHTML = "&#10005;";
            close.classList.add("close");
            close.addEventListener("click", () => root.close());
            root.header.appendChild(close);
        }
        root.title_element = root.querySelector(".dialog-title") as HTMLElement;
        root.title_element.innerText = title;
        root.content = root.querySelector(".dialog-content") as HTMLElement;
        root.alt_content = root.querySelector(".dialog-alt-content") as HTMLElement;
        root.footer = root.querySelector(".dialog-footer") as HTMLElement;

        root.close = () => {
            (root as any).onClose?.();
            root.parentNode?.removeChild(root);
        };
        root.toggleAltContent = (force?: boolean) => {
            const showAlt =
                typeof force !== "undefined"
                    ? !!force
                    : root.alt_content.style.display !== "block";
            root.alt_content.style.display = showAlt ? "block" : "none";
            root.content.style.display = showAlt ? "none" : "block";
        };
        root.toggleFooterVisibility = (force?: boolean) => {
            const show =
                typeof force !== "undefined"
                    ? !!force
                    : root.footer.style.display !== "block";
            root.footer.style.display = show ? "block" : "none";
        };
        root.clear = () => {
            root.content.innerHTML = "";
        };
        root.addHTML = (code: string, className?: string, on_footer?: boolean) => {
            const elem = document.createElement("div");
            if (className) {
                elem.className = className;
            }
            elem.innerHTML = code;
            if (on_footer) {
                root.footer.appendChild(elem);
            } else {
                root.content.appendChild(elem);
            }
            return elem;
        };
        root.addButton = (name: string, callback: (e: MouseEvent) => void, buttonOptions?: any) => {
            const elem = document.createElement("button");
            elem.innerText = name;
            (elem as any).options = buttonOptions;
            elem.classList.add("btn");
            elem.addEventListener("click", callback);
            root.footer.appendChild(elem);
            return elem;
        };
        root.addSeparator = () => {
            const elem = document.createElement("div");
            elem.className = "separator";
            root.content.appendChild(elem);
        };
        root.addWidget = (
            type: string,
            name: string,
            value: any,
            widgetOptions?: any,
            callback?: (name: string, value: any, options?: any) => void
        ) => {
            const CanvasClass = this.menuClass();
            const localOpts = widgetOptions || {};
            type = String(type || "string").toLowerCase();
            let strValue = String(value);
            if (type === "number" && typeof value === "number") {
                strValue = value.toFixed(3);
            }

            const elem = document.createElement("div") as any;
            elem.className = "property";
            elem.innerHTML = "<span class='property_name'></span><span class='property_value'></span>";
            (elem.querySelector(".property_name") as HTMLElement).innerText =
                localOpts.label || name;
            const valueElement = elem.querySelector(".property_value") as HTMLElement;
            valueElement.innerText = strValue;
            elem.dataset.property = name;
            elem.dataset.type = localOpts.type || type;
            elem.options = localOpts;
            elem.value = value;

            const change = (key: string, v: any): void => {
                localOpts.callback?.(key, v, localOpts);
                callback?.(key, v, localOpts);
            };

            if (type === "code") {
                elem.addEventListener("click", function(this: any) {
                    root.inner_showCodePad?.(this.dataset.property);
                });
            } else if (type === "boolean") {
                elem.classList.add("boolean");
                if (value) {
                    elem.classList.add("bool-on");
                }
                elem.addEventListener("click", function(this: any) {
                    const propname = this.dataset.property;
                    this.value = !this.value;
                    this.classList.toggle("bool-on");
                    (this.querySelector(".property_value") as HTMLElement).innerText = this.value
                        ? "true"
                        : "false";
                    change(propname, this.value);
                });
            } else if (type === "string" || type === "number") {
                valueElement.setAttribute("contenteditable", "true");
                valueElement.addEventListener("keydown", (e: KeyboardEvent) => {
                    if (e.code === "Enter" && (type !== "string" || !e.shiftKey)) {
                        e.preventDefault();
                        valueElement.blur();
                    }
                });
                valueElement.addEventListener("blur", function(this: HTMLElement) {
                    let v: any = this.innerText;
                    const prop = (this.parentNode as HTMLElement).dataset.property as string;
                    if ((this.parentNode as HTMLElement).dataset.type === "number") {
                        v = Number(v);
                    }
                    change(prop, v);
                });
            } else if (type === "enum" || type === "combo") {
                valueElement.innerText = CanvasClass.getPropertyPrintableValue(
                    value,
                    localOpts.values
                );
                valueElement.addEventListener("click", (event: MouseEvent) => {
                    const values = localOpts.values || [];
                    const propname = (valueElement.parentNode as HTMLElement).dataset
                        .property as string;
                    new host.ContextMenu(
                        values,
                        {
                            event,
                            className: "dark",
                            callback: (v: any) => {
                                valueElement.innerText = String(v);
                                change(propname, v);
                                return false;
                            },
                        },
                        ref_window
                    );
                });
            }

            root.content.appendChild(elem);
            return elem;
        };

        (root as any).onOpen?.();
        return root;
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
        this.canvas.parentNode?.appendChild(panel);
    }

    showSubgraphPropertiesDialog(node: any): PanelLike {
        const old_panel = this.canvas.parentNode?.querySelector(".subgraph_dialog") as any;
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
        this.canvas.parentNode?.appendChild(panel);
        return panel;
    }

    showSubgraphPropertiesDialogRight(node: any): PanelLike {
        const old_panel = this.canvas.parentNode?.querySelector(".subgraph_dialog") as any;
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
        addRow.querySelector(".name")?.addEventListener("keydown", function(e: KeyboardEvent) {
            if (e.key === "Enter") {
                addOutput.apply(this as unknown as HTMLElement);
            }
        });
        addRow.querySelector("button")?.addEventListener("click", function() {
            addOutput.apply(this as unknown as HTMLElement);
        });

        refresh();
        this.canvas.parentNode?.appendChild(panel);
        return panel;
    }

    checkPanels(): void {
        if (!this.canvas) {
            return;
        }
        const panels = this.canvas.parentNode?.querySelectorAll(".litegraph.dialog");
        panels?.forEach((panel: any) => {
            if (!panel.node) {
                return;
            }
            if (!panel.node.graph || panel.graph != this.graph) {
                panel.close?.();
            }
        });
    }

    getCanvasMenuOptions(): any[] {
        const CanvasClass = this.menuClass();
        let options: any[] = [];
        if (this.getMenuOptions) {
            options = this.getMenuOptions();
        } else {
            options = [
                { content: "Add Node", has_submenu: true, callback: CanvasClass.onMenuAdd },
                { content: "Add Group", callback: CanvasClass.onGroupAdd },
            ];
            if (Object.keys(this.selected_nodes || {}).length > 1) {
                options.push({
                    content: "Align",
                    has_submenu: true,
                    callback: CanvasClass.onGroupAlign,
                });
            }
            if (this._graph_stack && this._graph_stack.length > 0) {
                options.push(
                    null,
                    { content: "Close subgraph", callback: this.closeSubgraph.bind(this) }
                );
            }
        }
        if (this.getExtraMenuOptions) {
            const extra = this.getExtraMenuOptions(this, options);
            if (extra) {
                options = options.concat(extra);
            }
        }
        return options;
    }

    getNodeMenuOptions(node: any): any[] {
        const CanvasClass = this.menuClass();
        let options: any[] = [];
        if (node.getMenuOptions) {
            options = node.getMenuOptions(this);
        } else {
            options = [
                {
                    content: "Inputs",
                    has_submenu: true,
                    disabled: true,
                    callback: CanvasClass.showMenuNodeOptionalInputs,
                },
                {
                    content: "Outputs",
                    has_submenu: true,
                    disabled: true,
                    callback: CanvasClass.showMenuNodeOptionalOutputs,
                },
                null,
                {
                    content: "Properties",
                    has_submenu: true,
                    callback: CanvasClass.onShowMenuNodeProperties,
                },
                null,
                { content: "Title", callback: CanvasClass.onShowPropertyEditor },
                { content: "Mode", has_submenu: true, callback: CanvasClass.onMenuNodeMode },
            ];
            if (node.resizable !== false) {
                options.push({ content: "Resize", callback: CanvasClass.onMenuResizeNode });
            }
            options.push(
                { content: "Collapse", callback: CanvasClass.onMenuNodeCollapse },
                { content: "Pin", callback: CanvasClass.onMenuNodePin },
                { content: "Colors", has_submenu: true, callback: CanvasClass.onMenuNodeColors },
                { content: "Shapes", has_submenu: true, callback: CanvasClass.onMenuNodeShapes },
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
            const extra = node.getExtraMenuOptions(this, options);
            if (extra) {
                extra.push(null);
                options = extra.concat(options);
            }
        }
        if (node.clonable !== false) {
            options.push({ content: "Clone", callback: CanvasClass.onMenuNodeClone });
        }
        options.push({
            content: "To Subgraph",
            disabled: node.type == "graph/subgraph",
            callback: CanvasClass.onMenuNodeToSubgraph,
        });
        if (Object.keys(this.selected_nodes || {}).length > 1) {
            options.push({
                content: "Align Selected To",
                has_submenu: true,
                callback: CanvasClass.onNodeAlign,
            });
        }
        options.push(
            null,
            {
                content: "Remove",
                disabled: !(node.removable !== false && !node.block_delete),
                callback: CanvasClass.onMenuNodeRemove,
            }
        );
        node.graph?.onGetNodeMenuOptions?.(options, node);
        return options;
    }

    getGroupMenuOptions(_node: any): any[] {
        const CanvasClass = this.menuClass();
        return [
            { content: "Title", callback: CanvasClass.onShowPropertyEditor },
            { content: "Color", has_submenu: true, callback: CanvasClass.onMenuNodeColors },
            {
                content: "Font size",
                property: "font_size",
                type: "Number",
                callback: CanvasClass.onShowPropertyEditor,
            },
            null,
            { content: "Remove", callback: CanvasClass.onMenuNodeRemove },
        ];
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
                node.graph.beforeChange?.();
                if (info.input) {
                    node.removeInput?.(info.slot);
                } else if (info.output) {
                    node.removeOutput?.(info.slot);
                }
                node.graph.afterChange?.();
                return;
            }
            if (v.content == "Disconnect Links") {
                const info = v.slot;
                node.graph.beforeChange?.();
                if (info.output) {
                    node.disconnectOutput?.(info.slot);
                } else if (info.input) {
                    node.disconnectInput?.(info.slot);
                }
                node.graph.afterChange?.();
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
                    node.graph.beforeChange?.();
                    if (input?.value) {
                        if (slot_info) {
                            slot_info.label = input.value;
                        }
                        that.setDirty(true, false);
                    }
                    dialog.close();
                    node.graph.afterChange?.();
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
