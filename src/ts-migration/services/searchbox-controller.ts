import type {
    DialogLike,
    MenuPanelCanvasClassPort,
    MenuPanelHost,
    SearchBoxControllerPort,
} from "./menu-panel-types";

export interface SearchBoxControllerContext {
    host: MenuPanelHost;
    menuClass: MenuPanelCanvasClassPort;
    graphcanvas: SearchBoxControllerPort;
}

export function showSearchBoxController(
    context: SearchBoxControllerContext,
    event?: MouseEvent,
    options?: any
): DialogLike {
    const host = context.host;
    const menuClass = context.menuClass;
    const graphcanvas = context.graphcanvas;
    const canvas = graphcanvas.canvas;
    const getSearchBox = (): DialogLike | null => graphcanvas.getSearchBox();
    const setSearchBox = (dialog: DialogLike | null): void => {
        graphcanvas.setSearchBox(dialog);
    };
    const has_slot_types = !!(
        (host.slot_types_in && host.slot_types_in.length) ||
        (host.slot_types_out && host.slot_types_out.length)
    );
    const def_options = {
        slot_from: null,
        node_from: null,
        node_to: null,
        do_type_filter: host.search_filter_enabled && has_slot_types,
        type_filter_in: false,
        type_filter_out: false,
        show_general_if_none_on_typefilter: true,
        show_general_after_typefiltered: true,
        hide_on_mouse_leave: host.search_hide_on_mouse_leave,
        show_all_if_empty: true,
        show_all_on_open: host.search_show_all_on_open,
    };
    const opts = Object.assign(def_options, options || {});
    if (opts.do_type_filter && !has_slot_types) {
        opts.do_type_filter = false;
    }

    const root_document = canvas?.ownerDocument || document;
    const dialog = root_document.createElement("div") as DialogLike;
    dialog.className = "litegraph litesearchbox graphdialog rounded";
    dialog.innerHTML =
        "<span class='name'>Search</span> <input autofocus type='text' class='value rounded'/>";
    if (opts.do_type_filter) {
        dialog.innerHTML +=
            "<select class='slot_in_type_filter'><option value=''></option></select>";
        dialog.innerHTML +=
            "<select class='slot_out_type_filter'><option value=''></option></select>";
    }
    dialog.innerHTML += "<div class='helper'></div>";

    if (root_document.fullscreenElement) {
        root_document.fullscreenElement.appendChild(dialog);
    } else {
        root_document.body.appendChild(dialog);
        root_document.body.style.overflow = "hidden";
    }

    const selIn = opts.do_type_filter
        ? (dialog.querySelector(".slot_in_type_filter") as HTMLSelectElement)
        : null;
    const selOut = opts.do_type_filter
        ? (dialog.querySelector(".slot_out_type_filter") as HTMLSelectElement)
        : null;

    dialog.close = () => {
        setSearchBox(null);
        dialog.blur();
        canvas?.focus();
        root_document.body.style.overflow = "";
        if (dialog._remove_outside_close) {
            dialog._remove_outside_close();
            dialog._remove_outside_close = null;
        }

        setTimeout(() => {
            graphcanvas.focusCanvas();
        }, 20);
        if (dialog.parentNode) {
            dialog.parentNode.removeChild(dialog);
        }
    };

    if (graphcanvas.ds.scale > 1) {
        dialog.style.transform = "scale(" + graphcanvas.ds.scale + ")";
    }

    const open_time = host.getTime ? host.getTime() : Date.now();
    const bindOutsideClose = (): void => {
        const onOutsideDown = (e: Event): void => {
            if (!dialog || !getSearchBox()) {
                return;
            }
            const now = host.getTime ? host.getTime() : Date.now();
            if (now - open_time < 60) {
                return;
            }
            if (dialog.contains(e.target as Node)) {
                return;
            }
            dialog.close();
        };

        root_document.addEventListener("mousedown", onOutsideDown, true);
        root_document.addEventListener("touchstart", onOutsideDown, {
            capture: true,
            passive: true,
        });
        dialog._remove_outside_close = () => {
            root_document.removeEventListener("mousedown", onOutsideDown, true);
            root_document.removeEventListener("touchstart", onOutsideDown, true);
        };
    };
    bindOutsideClose();

    if (opts.hide_on_mouse_leave) {
        let prevent_timeout: any = false;
        let timeout_close: ReturnType<typeof setTimeout> | null = null;
        host.pointerListenerAdd?.(dialog, "enter", () => {
            if (timeout_close) {
                clearTimeout(timeout_close);
                timeout_close = null;
            }
        });
        host.pointerListenerAdd?.(dialog, "leave", () => {
            if (prevent_timeout) {
                return;
            }
            timeout_close = setTimeout(() => {
                dialog.close();
            }, 500);
        });
        if (opts.do_type_filter && selIn && selOut) {
            selIn.addEventListener("click", () => {
                prevent_timeout++;
            });
            selIn.addEventListener("blur", () => {
                prevent_timeout = 0;
            });
            selIn.addEventListener("change", () => {
                prevent_timeout = -1;
            });
            selOut.addEventListener("click", () => {
                prevent_timeout++;
            });
            selOut.addEventListener("blur", () => {
                prevent_timeout = 0;
            });
            selOut.addEventListener("change", () => {
                prevent_timeout = -1;
            });
        }
    }

    if (getSearchBox()) {
        getSearchBox()?.close();
    }
    setSearchBox(dialog);

    const helper = dialog.querySelector(".helper") as HTMLDivElement;
    let first: any = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let selected: any = null;

    const input = dialog.querySelector("input") as HTMLInputElement;
    if (input) {
        input.addEventListener("blur", function(this: HTMLInputElement) {
            if (getSearchBox() && !opts.hide_on_mouse_leave) {
                setTimeout(function() {
                    if (!getSearchBox()) {
                        return;
                    }
                    const active_element = root_document.activeElement;
                    if (!active_element || !dialog.contains(active_element)) {
                        dialog.close();
                    }
                }, 0);
                return;
            }
            if (getSearchBox() && opts.hide_on_mouse_leave) {
                this.focus();
            }
        });
        input.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.keyCode == 38) {
                changeSelection(false);
            } else if (e.keyCode == 40) {
                changeSelection(true);
            } else if (e.keyCode == 27) {
                dialog.close();
            } else if (e.keyCode == 13) {
                refreshHelper();
                if (selected) {
                    select(selected.innerHTML);
                } else if (first) {
                    select(first);
                } else {
                    dialog.close();
                }
            } else {
                if (timeout) {
                    clearInterval(timeout as any);
                }
                timeout = setTimeout(refreshHelper, 250);
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        });
    }

    if (opts.do_type_filter && selIn && selOut) {
        const slotsIn = host.slot_types_in || [];
        let inType = opts.type_filter_in;
        if (inType == host.EVENT || inType == host.ACTION) {
            inType = "_event_";
        }
        for (let i = 0; i < slotsIn.length; i++) {
            const opt = document.createElement("option");
            opt.value = slotsIn[i];
            opt.innerHTML = slotsIn[i];
            selIn.appendChild(opt);
            if (
                inType !== false &&
                (inType + "").toLowerCase() == (slotsIn[i] + "").toLowerCase()
            ) {
                opt.selected = true;
            }
        }
        selIn.addEventListener("change", refreshHelper);

        const slotsOut = host.slot_types_out || [];
        let outType = opts.type_filter_out;
        if (outType == host.EVENT || outType == host.ACTION) {
            outType = "_event_";
        }
        for (let i = 0; i < slotsOut.length; i++) {
            const opt = document.createElement("option");
            opt.value = slotsOut[i];
            opt.innerHTML = slotsOut[i];
            selOut.appendChild(opt);
            if (
                outType !== false &&
                (outType + "").toLowerCase() == (slotsOut[i] + "").toLowerCase()
            ) {
                opt.selected = true;
            }
        }
        selOut.addEventListener("change", refreshHelper);
    }

    const rect = canvas?.getBoundingClientRect();
    const left = ((event ? event.clientX : (rect?.left || 0) + (rect?.width || 0) * 0.5) - 80);
    const top = ((event ? event.clientY : (rect?.top || 0) + (rect?.height || 0) * 0.5) - 20);
    dialog.style.left = left + "px";
    dialog.style.top = top + "px";

    if (event && rect && (event as any).layerY > rect.height - 200) {
        helper.style.maxHeight = rect.height - (event as any).layerY - 20 + "px";
    }

    input.focus();
    if (opts.show_all_on_open) {
        refreshHelper();
    }

    function select(name: string) {
        if (name) {
            if (graphcanvas.onSearchBoxSelection) {
                graphcanvas.onSearchBoxSelection(name, event, graphcanvas);
            } else {
                const extra = host.searchbox_extras?.[name.toLowerCase()];
                if (extra) {
                    name = extra.type;
                }

                graphcanvas.graph.beforeChange?.();
                const node = host.createNode?.(name);
                if (node) {
                    node.pos = graphcanvas.convertEventToCanvasOffset(event);
                    graphcanvas.graph.add(node, false);
                }

                if (extra && extra.data && node) {
                    const nodeCompat = node as any;
                    if (extra.data.properties) {
                        for (const i in extra.data.properties) {
                            nodeCompat.addProperty(i, extra.data.properties[i]);
                        }
                    }
                    if (extra.data.inputs) {
                        nodeCompat.inputs = [];
                        for (const i in extra.data.inputs) {
                            nodeCompat.addOutput(extra.data.inputs[i][0], extra.data.inputs[i][1]);
                        }
                    }
                    if (extra.data.outputs) {
                        nodeCompat.outputs = [];
                        for (const i in extra.data.outputs) {
                            nodeCompat.addOutput(extra.data.outputs[i][0], extra.data.outputs[i][1]);
                        }
                    }
                    if (extra.data.title) {
                        nodeCompat.title = extra.data.title;
                    }
                    if (extra.data.json) {
                        nodeCompat.configure(extra.data.json);
                    }
                }

                if (opts.node_from && node) {
                    let iS: any = false;
                    switch (typeof opts.slot_from) {
                        case "string":
                            iS = opts.node_from.findOutputSlot(opts.slot_from);
                            break;
                        case "object":
                            if (opts.slot_from.name) {
                                iS = opts.node_from.findOutputSlot(opts.slot_from.name);
                            } else {
                                iS = -1;
                            }
                            if (
                                iS == -1 &&
                                typeof opts.slot_from.slot_index !== "undefined"
                            ) {
                                iS = opts.slot_from.slot_index;
                            }
                            break;
                        case "number":
                            iS = opts.slot_from;
                            break;
                        default:
                            iS = 0;
                    }
                    if (typeof opts.node_from.outputs[iS] !== "undefined") {
                        if (iS !== false && iS > -1) {
                            opts.node_from.connectByType(
                                iS,
                                node,
                                opts.node_from.outputs[iS].type
                            );
                        }
                    }
                }
                if (opts.node_to && node) {
                    let iS: any = false;
                    switch (typeof opts.slot_from) {
                        case "string":
                            iS = opts.node_to.findInputSlot(opts.slot_from);
                            break;
                        case "object":
                            if (opts.slot_from.name) {
                                iS = opts.node_to.findInputSlot(opts.slot_from.name);
                            } else {
                                iS = -1;
                            }
                            if (
                                iS == -1 &&
                                typeof opts.slot_from.slot_index !== "undefined"
                            ) {
                                iS = opts.slot_from.slot_index;
                            }
                            break;
                        case "number":
                            iS = opts.slot_from;
                            break;
                        default:
                            iS = 0;
                    }
                    if (typeof opts.node_to.inputs[iS] !== "undefined") {
                        if (iS !== false && iS > -1) {
                            opts.node_to.connectByTypeOutput(
                                iS,
                                node,
                                opts.node_to.inputs[iS].type
                            );
                        }
                    }
                }

                graphcanvas.graph.afterChange?.();
            }
        }

        dialog.close();
    }

    function changeSelection(forward: boolean) {
        const prev = selected;
        if (selected) {
            selected.classList.remove("selected");
        }
        if (!selected) {
            selected = forward
                ? helper.childNodes[0]
                : helper.childNodes[helper.childNodes.length];
        } else {
            selected = forward ? selected.nextSibling : selected.previousSibling;
            if (!selected) {
                selected = prev;
            }
        }
        if (!selected) {
            return;
        }
        selected.classList.add("selected");
        selected.scrollIntoView({ block: "end", behavior: "smooth" });
    }

    function refreshHelper() {
        timeout = null;
        let str = input.value;
        first = null;
        helper.innerHTML = "";
        if (!str && !opts.show_all_if_empty) {
            return;
        }

        if (graphcanvas.onSearchBox) {
            const list = graphcanvas.onSearchBox(helper, str, graphcanvas) as any[] | null;
            if (list) {
                for (let i = 0; i < list.length; ++i) {
                    addResult(list[i]);
                }
            }
        } else {
            let c = 0;
            str = str.toLowerCase();
            const filter = graphcanvas.filter || graphcanvas.graph.filter;
            const currentSearchBox = getSearchBox();
            const sIn = opts.do_type_filter && currentSearchBox
                ? (currentSearchBox.querySelector(
                      ".slot_in_type_filter"
                  ) as HTMLSelectElement)
                : null;
            const sOut = opts.do_type_filter && currentSearchBox
                ? (currentSearchBox.querySelector(
                      ".slot_out_type_filter"
                  ) as HTMLSelectElement)
                : null;
            const search_limit =
                menuClass.search_limit !== undefined ? menuClass.search_limit : -1;
            const inner_test_filter = (type: string, optsIn?: any): boolean => {
                const optsDef = {
                    skipFilter: false,
                    inTypeOverride: false,
                    outTypeOverride: false,
                };
                const local = Object.assign(optsDef, optsIn || {});
                const ctor = host.registered_node_types?.[type];
                if (filter && ctor.filter != filter) {
                    return false;
                }
                if (
                    (!opts.show_all_if_empty || str) &&
                    type.toLowerCase().indexOf(str) === -1
                ) {
                    return false;
                }
                if (opts.do_type_filter && !local.skipFilter) {
                    let sV: any = sIn?.value;
                    if (local.inTypeOverride !== false) sV = local.inTypeOverride;
                    if (sIn && sV) {
                        if (
                            host.registered_slot_in_types?.[sV] &&
                            host.registered_slot_in_types[sV].nodes
                        ) {
                            const doesInc =
                                host.registered_slot_in_types[sV].nodes.includes(type);
                            if (doesInc === false) {
                                return false;
                            }
                        }
                    }

                    sV = sOut?.value;
                    if (local.outTypeOverride !== false) sV = local.outTypeOverride;
                    if (sOut && sV) {
                        if (
                            host.registered_slot_out_types?.[sV] &&
                            host.registered_slot_out_types[sV].nodes
                        ) {
                            const doesInc =
                                host.registered_slot_out_types[sV].nodes.includes(type);
                            if (doesInc === false) {
                                return false;
                            }
                        }
                    }
                }
                return true;
            };

            for (const i in host.searchbox_extras || {}) {
                const extra = host.searchbox_extras[i];
                if (
                    (!opts.show_all_if_empty || str) &&
                    extra.desc.toLowerCase().indexOf(str) === -1
                ) {
                    continue;
                }
                const ctor = host.registered_node_types?.[extra.type];
                if (ctor && ctor.filter != filter) {
                    continue;
                }
                if (!inner_test_filter(extra.type)) {
                    continue;
                }
                addResult(extra.desc, "searchbox_extra");
                if (search_limit !== -1 && c++ > search_limit) {
                    break;
                }
            }

            const keys = Object.keys(host.registered_node_types || {});
            const filtered = keys.filter((type) => inner_test_filter(type));
            for (let i = 0; i < filtered.length; i++) {
                addResult(filtered[i]);
                if (search_limit !== -1 && c++ > search_limit) {
                    break;
                }
            }
        }

        function addResult(type: string, className?: string) {
            const help = document.createElement("div");
            if (!first) {
                first = type;
            }
            help.innerText = type;
            help.dataset["type"] = escape(type);
            help.className = "litegraph lite-search-item";
            if (className) {
                help.className += " " + className;
            }
            help.addEventListener("click", function(this: HTMLDivElement) {
                select(unescape(this.dataset["type"] as string));
            });
            helper.appendChild(help);
        }
    }

    return dialog;
}
