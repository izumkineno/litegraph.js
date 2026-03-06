import type { Vector2 } from "../types/core-types";
import type { GraphCanvasPalettePort } from "../contracts/canvas";
import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import type { LGraphGroup } from "../models/LGraphGroup";
import type { LGraphNodeCanvasCollab as LGraphNode } from "../models/LGraphNode.canvas-collab";
import type { ContextMenu } from "../ui/ContextMenu";

interface ContextMenuLike extends Pick<ContextMenu, "getFirstEvent"> {}

interface ContextMenuConstructorLike {
    new (
        values: unknown,
        options?: Record<string, unknown>,
        ref_window?: Window
    ): ContextMenuLike;
}

interface LGraphNodeLike
    extends Pick<LGraphNode, "id" | "type" | "title" | "pos" | "size"> {
    graph?: LGraphLike | null;
    optional_inputs?: unknown[];
    optional_outputs?: unknown[];
    flags?: Record<string, unknown>;
    properties?: Record<string, unknown>;
    removable?: boolean;
    clonable?: boolean;
    color?: string;
    bgcolor?: string;
    shape?: string | number;
    constructor?: unknown;
    computeSize?: () => Vector2;
    onResize?: (size: Vector2) => void;
    onNodeInputAdd?: (slotInfo: unknown) => void;
    onNodeOutputAdd?: (slotInfo: unknown) => void;
    onGetInputs?: () => unknown[];
    onGetOutputs?: () => unknown[];
    onMenuNodeInputs?: (entries: MenuEntryLike[]) => MenuEntryLike[] | void;
    onMenuNodeOutputs?: (entries: MenuEntryLike[]) => MenuEntryLike[] | void;
    getPropertyInfo?: (property: string) => Record<string, unknown>;
    addInput?: (name: string, type: unknown, extra?: Record<string, unknown>) => void;
    addOutput?: (name: string, type: unknown, extra?: Record<string, unknown>) => void;
    findOutputSlot?: (name: string) => number;
    findInputSlot?: (name: string) => number;
    collapse?: () => void;
    pin?: () => void;
    changeMode?: (mode: number) => void;
    clone?: () => LGraphNodeLike | null;
    setDirtyCanvas?: (fg: boolean, bg?: boolean) => void;
    buildFromNodes?: (nodes: LGraphNodeLike[]) => void;
}

interface LGraphLike {
    filter?: unknown;
    add: (node: LGraphNodeLike) => void;
    remove: (node: LGraphNodeLike) => void;
    beforeChange?: () => void;
    afterChange?: () => void;
}

interface LGraphCanvasRuntimeLike {
    selected_nodes: Record<string, LGraphNodeLike>;
    graph: LGraphLike;
    filter?: unknown;
    canvas: HTMLCanvasElement;
    getCanvasWindow: () => Window;
    convertEventToCanvasOffset: (event: MouseEvent) => Vector2;
    showEditPropertyValue: (
        node: LGraphNodeLike,
        property: string,
        options?: Record<string, unknown>
    ) => void;
    deselectAllNodes?: () => void;
    selectNodes?: (nodes: Record<string, LGraphNodeLike>) => void;
    dirty_canvas?: boolean;
    dirty_bgcanvas?: boolean;
    closeSubgraph?: () => void;
}

interface NodeTypeLike {
    type: string;
    title: string;
    skip_list?: boolean;
}

interface LiteGraphCanvasStaticHost
    extends Pick<
        LiteGraphConstantsShape,
        | "EVENT"
        | "ACTION"
        | "ALWAYS"
        | "EVENT_LINK_COLOR"
        | "NODE_MODES"
        | "VALID_SHAPES"
        | "do_add_triggers_slots"
        | "dialog_close_on_mouse_leave"
        | "dialog_close_on_mouse_leave_delay"
    > {
    LGraphGroup?: new () => unknown;
    ContextMenu: ContextMenuConstructorLike;
    createNode: (type: string) => LGraphNodeLike | null;
    getNodeTypesCategories: (filter?: unknown) => string[];
    getNodeTypesInCategory: (category: string, filter?: unknown) => NodeTypeLike[];
    slot_types_default_in: Record<string, unknown>;
    slot_types_default_out: Record<string, unknown>;
}

interface MenuEntryLike {
    value?: unknown;
    content?: string;
    has_submenu?: boolean;
    callback?: (...args: unknown[]) => unknown;
    className?: string;
}

class DefaultContextMenu implements ContextMenuLike {
    constructor(
        _values: unknown,
        _options?: Record<string, unknown>,
        _ref_window?: Window
    ) {}

    getFirstEvent(): MouseEvent {
        return {} as MouseEvent;
    }
}

const defaultHost: LiteGraphCanvasStaticHost = {
    EVENT: -1,
    ACTION: -1,
    ALWAYS: 0,
    EVENT_LINK_COLOR: "#A86",
    NODE_MODES: ["Always", "On Event", "Never", "On Trigger"],
    VALID_SHAPES: ["default", "box", "round", "card"],
    do_add_triggers_slots: false,
    dialog_close_on_mouse_leave: true,
    dialog_close_on_mouse_leave_delay: 500,
    ContextMenu: DefaultContextMenu,
    createNode: () => null,
    getNodeTypesCategories: () => [],
    getNodeTypesInCategory: () => [],
    slot_types_default_in: {},
    slot_types_default_out: {},
};

/**
 * LGraphCanvas static zone methods and resources.
 * Source: `LGraphCanvas.*` static methods / fields.
 */
export class LGraphCanvas {
    static liteGraph?: Partial<LiteGraphCanvasStaticHost>;

    static DEFAULT_BACKGROUND_IMAGE =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQBJREFUeNrs1rEKwjAUhlETUkj3vP9rdmr1Ysammk2w5wdxuLgcMHyptfawuZX4pJSWZTnfnu/lnIe/jNNxHHGNn//HNbbv+4dr6V+11uF527arU7+u63qfa/bnmh8sWLBgwYJlqRf8MEptXPBXJXa37BSl3ixYsGDBMliwFLyCV/DeLIMFCxYsWLBMwSt4Be/NggXLYMGCBUvBK3iNruC9WbBgwYJlsGApeAWv4L1ZBgsWLFiwYJmCV/AK3psFC5bBggULloJX8BpdwXuzYMGCBctgwVLwCl7Be7MMFixYsGDBsu8FH1FaSmExVfAxBa/gvVmwYMGCZbBg/W4vAQYA5tRF9QYlv/QAAAAASUVORK5CYII=";

    static link_type_colors: Record<string, string> = {
        "-1": defaultHost.EVENT_LINK_COLOR,
        number: "#AAA",
        node: "#DCA",
    };

    static gradients: Record<string, unknown> = {}; // cache of gradients
    static search_limit = -1;

    static node_colors: Record<
        string,
        { color: string; bgcolor: string; groupcolor: string }
    > = {
        red: { color: "#322", bgcolor: "#533", groupcolor: "#A88" },
        brown: { color: "#332922", bgcolor: "#593930", groupcolor: "#b06634" },
        green: { color: "#232", bgcolor: "#353", groupcolor: "#8A8" },
        blue: { color: "#223", bgcolor: "#335", groupcolor: "#88A" },
        pale_blue: {
            color: "#2a363b",
            bgcolor: "#3f5159",
            groupcolor: "#3f789e",
        },
        cyan: { color: "#233", bgcolor: "#355", groupcolor: "#8AA" },
        purple: { color: "#323", bgcolor: "#535", groupcolor: "#a1309b" },
        yellow: { color: "#432", bgcolor: "#653", groupcolor: "#b58b2a" },
        black: { color: "#222", bgcolor: "#000", groupcolor: "#444" },
    };

    static active_canvas: LGraphCanvasRuntimeLike | null = null;
    static active_node: LGraphNodeLike | null = null;

    private static host(): LiteGraphCanvasStaticHost {
        return { ...defaultHost, ...(this.liteGraph || {}) };
    }

    private static callbackHost(): LiteGraphCanvasStaticHost {
        const activeCtor = (
            (LGraphCanvas.active_canvas as unknown as { constructor?: unknown } | null)
                ?.constructor as { host?: () => LiteGraphCanvasStaticHost } | undefined
        );
        if (activeCtor && typeof activeCtor.host === "function") {
            return activeCtor.host();
        }
        return LGraphCanvas.host();
    }

    /** Create menu for `Add Group` */
    static onGroupAdd(_info: unknown, _entry: unknown, mouse_event: MouseEvent): void {
        const canvas = LGraphCanvas.active_canvas;
        if (!canvas) {
            return;
        }
        const canvasRef = canvas;
        const ref_window = canvasRef.getCanvasWindow();
        void ref_window;

        const host = LGraphCanvas.callbackHost();
        const group = new (host.LGraphGroup as new () => LGraphNodeLike)();
        group.pos = canvas.convertEventToCanvasOffset(mouse_event);
        canvas.graph.add(group);
    }

    /**
     * Determines the furthest nodes in each direction
     * @param nodes {LGraphNode[]} the nodes to from which boundary nodes will be extracted
     * @return {{left: LGraphNode, top: LGraphNode, right: LGraphNode, bottom: LGraphNode}}
     */
    static getBoundaryNodes(nodes: Record<string, LGraphNodeLike> | LGraphNodeLike[]): {
        top: LGraphNodeLike | null;
        right: LGraphNodeLike | null;
        bottom: LGraphNodeLike | null;
        left: LGraphNodeLike | null;
    } {
        let top: LGraphNodeLike | null = null;
        let right: LGraphNodeLike | null = null;
        let bottom: LGraphNodeLike | null = null;
        let left: LGraphNodeLike | null = null;
        const source = nodes as Record<string, LGraphNodeLike>;
        for (const nID in source) {
            const node = source[nID];
            const [x, y] = node.pos;
            const [width, height] = node.size;

            if (top === null || y < top.pos[1]) {
                top = node;
            }
            if (right === null || x + width > right.pos[0] + right.size[0]) {
                right = node;
            }
            if (bottom === null || y + height > bottom.pos[1] + bottom.size[1]) {
                bottom = node;
            }
            if (left === null || x < left.pos[0]) {
                left = node;
            }
        }
        return { top, right, bottom, left };
    }

    /**
     *
     * @param nodes {LGraphNode[]} a list of nodes
     * @param direction {"top"|"bottom"|"left"|"right"} Direction to align the nodes
     * @param align_to {LGraphNode?} Node to align to (if null, align to the furthest node in the given direction)
     */
    static alignNodes(
        nodes: Record<string, LGraphNodeLike> | LGraphNodeLike[],
        direction: "top" | "bottom" | "left" | "right",
        align_to?: LGraphNodeLike
    ): void {
        if (!nodes) {
            return;
        }
        const canvas = LGraphCanvas.active_canvas as LGraphCanvasRuntimeLike;
        let boundaryNodes: {
            top: LGraphNodeLike;
            right: LGraphNodeLike;
            bottom: LGraphNodeLike;
            left: LGraphNodeLike;
        };

        if (align_to === undefined) {
            boundaryNodes = LGraphCanvas.getBoundaryNodes(nodes) as {
                top: LGraphNodeLike;
                right: LGraphNodeLike;
                bottom: LGraphNodeLike;
                left: LGraphNodeLike;
            };
        } else {
            boundaryNodes = {
                top: align_to,
                right: align_to,
                bottom: align_to,
                left: align_to,
            };
        }

        for (const [, node] of Object.entries(canvas.selected_nodes || {})) {
            switch (direction) {
                case "right":
                    node.pos[0] =
                        boundaryNodes.right.pos[0] +
                        boundaryNodes.right.size[0] -
                        node.size[0];
                    break;
                case "left":
                    node.pos[0] = boundaryNodes.left.pos[0];
                    break;
                case "top":
                    node.pos[1] = boundaryNodes.top.pos[1];
                    break;
                case "bottom":
                    node.pos[1] =
                        boundaryNodes.bottom.pos[1] +
                        boundaryNodes.bottom.size[1] -
                        node.size[1];
                    break;
            }
        }

        canvas.dirty_canvas = true;
        canvas.dirty_bgcanvas = true;
    }

    static onNodeAlign(
        _value: unknown,
        _options: unknown,
        event: MouseEvent,
        prev_menu: unknown,
        node: LGraphNodeLike
    ): void {
        const host = LGraphCanvas.callbackHost();
        new host.ContextMenu(["Top", "Bottom", "Left", "Right"], {
            event,
            callback: inner_clicked,
            parentMenu: prev_menu,
        });

        function inner_clicked(value: unknown): void {
            LGraphCanvas.alignNodes(
                (LGraphCanvas.active_canvas as LGraphCanvasRuntimeLike).selected_nodes,
                (value as string).toLowerCase() as "top" | "bottom" | "left" | "right",
                node
            );
        }
    }

    static onGroupAlign(
        _value: unknown,
        _options: unknown,
        event: MouseEvent,
        prev_menu: unknown
    ): void {
        const host = LGraphCanvas.callbackHost();
        new host.ContextMenu(["Top", "Bottom", "Left", "Right"], {
            event,
            callback: inner_clicked,
            parentMenu: prev_menu,
        });

        function inner_clicked(value: unknown): void {
            LGraphCanvas.alignNodes(
                (LGraphCanvas.active_canvas as LGraphCanvasRuntimeLike).selected_nodes,
                (value as string).toLowerCase() as "top" | "bottom" | "left" | "right"
            );
        }
    }

    /** Create menu for `Add Node` */
    static onMenuAdd(
        _node: unknown,
        _options: unknown,
        e: MouseEvent,
        prev_menu: unknown,
        callback?: (node: LGraphNodeLike | null) => void
    ): false | void {
        const canvas = LGraphCanvas.active_canvas;
        if (!canvas) {
            return;
        }
        const canvasRef = canvas;
        const ref_window = canvasRef.getCanvasWindow();
        const graph = canvasRef.graph;
        const host = LGraphCanvas.callbackHost();

        function inner_onMenuAdded(base_category: string, menuRef: unknown): void {
            const categories = host
                .getNodeTypesCategories(canvasRef.filter || graph.filter)
                .filter((category) => category.startsWith(base_category));
            const entries: MenuEntryLike[] = [];

            categories.map((category) => {
                if (!category) {
                    return;
                }
                const base_category_regex = new RegExp("^(" + base_category + ")");
                const category_name = category
                    .replace(base_category_regex, "")
                    .split("/")[0];
                const category_path =
                    base_category === ""
                        ? category_name + "/"
                        : base_category + category_name + "/";

                let name = category_name;
                if (name.indexOf("::") != -1) {
                    name = name.split("::")[1];
                }

                const index = entries.findIndex((entry) => entry.value === category_path);
                if (index === -1) {
                    entries.push({
                        value: category_path,
                        content: name,
                        has_submenu: true,
                        callback: (value: unknown, _event: unknown, _mouseEvent: unknown, contextMenu: unknown) => {
                            const selected = value as { value?: string };
                            inner_onMenuAdded(selected.value || "", contextMenu);
                        },
                    });
                }
            });

            const nodes = host.getNodeTypesInCategory(
                base_category.slice(0, -1),
                canvasRef.filter || graph.filter
            );
            nodes.map((nodeType) => {
                if (nodeType.skip_list) {
                    return;
                }
                entries.push({
                    value: nodeType.type,
                    content: nodeType.title,
                    has_submenu: false,
                    callback: (value: unknown, _event: unknown, _mouseEvent: unknown, contextMenu: unknown) => {
                        const selected = value as { value?: string };
                        const first_event =
                            (contextMenu as ContextMenuLike).getFirstEvent!() as MouseEvent;
                        canvasRef.graph.beforeChange!();
                        const newNode = host.createNode(selected.value || "");
                        if (newNode) {
                            newNode.pos = canvasRef.convertEventToCanvasOffset(first_event);
                            canvasRef.graph.add(newNode);
                        }
                        if (callback) {
                            callback(newNode);
                        }
                        canvasRef.graph.afterChange!();
                    },
                });
            });

            new host.ContextMenu(entries, { event: e, parentMenu: menuRef }, ref_window);
        }

        inner_onMenuAdded("", prev_menu);
        return false;
    }

    static onMenuCollapseAll(): void {}
    static onMenuNodeEdit(): void {}

    static showMenuNodeOptionalInputs(
        _v: unknown,
        _options: unknown,
        e: MouseEvent,
        prev_menu: unknown,
        node: LGraphNodeLike
    ): false | void {
        if (!node) {
            return;
        }

        const that = this;
        const canvas = LGraphCanvas.active_canvas;
        if (!canvas) {
            return;
        }
        const canvasRef = canvas;
        const ref_window = canvasRef.getCanvasWindow();
        const host = LGraphCanvas.callbackHost();

        let optInputs = node.optional_inputs;
        if (node.onGetInputs) {
            optInputs = node.onGetInputs();
        }

        let entries: (MenuEntryLike | null)[] = [];
        if (optInputs) {
            for (let i = 0; i < optInputs.length; i++) {
                const entry = optInputs[i] as [string, unknown, Record<string, unknown>?] | null;
                if (!entry) {
                    entries.push(null);
                    continue;
                }
                let label = entry[0];
                if (!entry[2]) {
                    entry[2] = {};
                }
                if (entry[2].label) {
                    label = String(entry[2].label);
                }
                entry[2].removable = true;
                const data: MenuEntryLike = { content: label, value: entry };
                if (entry[1] == host.ACTION) {
                    data.className = "event";
                }
                entries.push(data);
            }
        }

        if (node.onMenuNodeInputs) {
            const retEntries = node.onMenuNodeInputs(entries as MenuEntryLike[]);
            if (retEntries) {
                entries = retEntries;
            }
        }

        if (!entries.length) {
            return;
        }

        new host.ContextMenu(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                node,
            },
            ref_window
        );

        function inner_clicked(v: unknown, _e: unknown, prev: unknown): void {
            if (!node) {
                return;
            }
            const valueObj = v as MenuEntryLike;
            if (valueObj.callback) {
                valueObj.callback.call(that, node, valueObj, e, prev);
            }

            if (valueObj.value) {
                node.graph!.beforeChange!();
                const addEntry = valueObj.value as [
                    string,
                    unknown,
                    Record<string, unknown>?
                ];
                node.addInput!(addEntry[0], addEntry[1], addEntry[2]);
                if (node.onNodeInputAdd) {
                    node.onNodeInputAdd(valueObj.value);
                }
                node.setDirtyCanvas!(true, true);
                node.graph!.afterChange!();
            }
        }

        return false;
    }

    static showMenuNodeOptionalOutputs(
        _v: unknown,
        _options: unknown,
        e: MouseEvent,
        prev_menu: unknown,
        node: LGraphNodeLike
    ): false | void {
        if (!node) {
            return;
        }

        const that = this;
        const canvas = LGraphCanvas.active_canvas;
        if (!canvas) {
            return;
        }
        const canvasRef = canvas;
        const ref_window = canvasRef.getCanvasWindow();
        const host = LGraphCanvas.callbackHost();

        let optOutputs = node.optional_outputs;
        if (node.onGetOutputs) {
            optOutputs = node.onGetOutputs();
        }

        let entries: (MenuEntryLike | null)[] = [];
        if (optOutputs) {
            for (let i = 0; i < optOutputs.length; i++) {
                const entry = optOutputs[i] as [string, unknown, Record<string, unknown>?] | null;
                if (!entry) {
                    entries.push(null);
                    continue;
                }
                if (
                    node.flags &&
                    node.flags.skip_repeated_outputs &&
                    node.findOutputSlot &&
                    node.findOutputSlot(entry[0]) != -1
                ) {
                    continue;
                }

                let label = entry[0];
                if (!entry[2]) {
                    entry[2] = {};
                }
                if (entry[2].label) {
                    label = String(entry[2].label);
                }
                entry[2].removable = true;
                const data: MenuEntryLike = { content: label, value: entry };
                if (entry[1] == host.EVENT) {
                    data.className = "event";
                }
                entries.push(data);
            }
        }

        const thisLike = this as unknown as {
            onMenuNodeOutputs?: (entries: MenuEntryLike[]) => MenuEntryLike[];
        };
        if (thisLike.onMenuNodeOutputs) {
            entries = thisLike.onMenuNodeOutputs(entries as MenuEntryLike[]);
        }
        if (host.do_add_triggers_slots && node.findOutputSlot && node.findOutputSlot("onExecuted") == -1) {
            entries.push({
                content: "On Executed",
                value: ["onExecuted", host.EVENT, { nameLocked: true }],
                className: "event",
            });
        }
        if (node.onMenuNodeOutputs) {
            const retEntries = node.onMenuNodeOutputs(entries as MenuEntryLike[]);
            if (retEntries) {
                entries = retEntries;
            }
        }

        if (!entries.length) {
            return;
        }

        new host.ContextMenu(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                node,
            },
            ref_window
        );

        function inner_clicked(v: unknown, _e: unknown, prev: unknown): false | void {
            if (!node) {
                return;
            }

            const valueObj = v as MenuEntryLike;
            if (valueObj.callback) {
                valueObj.callback.call(that, node, valueObj, e, prev);
            }
            if (!valueObj.value) {
                return;
            }

            const packed = valueObj.value as [string, unknown, Record<string, unknown>?];
            const value = packed[1];
            if (value && (Array.isArray(value) || (value as { constructor?: unknown }).constructor === Object)) {
                const submenuEntries: MenuEntryLike[] = [];
                for (const i in value as Record<string, unknown>) {
                    submenuEntries.push({
                        content: i,
                        value: (value as Record<string, unknown>)[i],
                    });
                }
                new host.ContextMenu(submenuEntries, {
                    event: e,
                    callback: inner_clicked,
                    parentMenu: prev,
                    node,
                });
                return false;
            }

            node.graph!.beforeChange!();
            node.addOutput!(packed[0], packed[1], packed[2]);
            if (node.onNodeOutputAdd) {
                node.onNodeOutputAdd(valueObj.value);
            }
            node.setDirtyCanvas!(true, true);
            node.graph!.afterChange!();
        }

        return false;
    }

    static onShowMenuNodeProperties(
        _value: unknown,
        _options: unknown,
        e: MouseEvent,
        prev_menu: unknown,
        node: LGraphNodeLike
    ): false | void {
        if (!node || !node.properties) {
            return;
        }

        const canvas = LGraphCanvas.active_canvas;
        if (!canvas) {
            return;
        }
        const canvasRef = canvas;
        const ref_window = canvasRef.getCanvasWindow();

        const entries: MenuEntryLike[] = [];
        for (const i in node.properties) {
            let value = node.properties[i] !== undefined ? node.properties[i] : " ";
            if (typeof value == "object") {
                value = JSON.stringify(value);
            }
            const info = node.getPropertyInfo!(i);
            if (info.type == "enum" || info.type == "combo") {
                value = LGraphCanvas.getPropertyPrintableValue(
                    value,
                    info.values as Record<string, unknown> | unknown[]
                );
            }
            value = LGraphCanvas.decodeHTML(String(value));
            entries.push({
                content:
                    "<span class='property_name'>" +
                    (info.label ? info.label : i) +
                    "</span>" +
                    "<span class='property_value'>" +
                    value +
                    "</span>",
                value: i,
            });
        }
        if (!entries.length) {
            return;
        }

        new (LGraphCanvas.callbackHost().ContextMenu)(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                allow_html: true,
                node,
            },
            ref_window
        );

        function inner_clicked(this: Element, v: unknown): void {
            if (!node) {
                return;
            }
            const valueObj = v as MenuEntryLike;
            const rect = this.getBoundingClientRect();
            canvasRef.showEditPropertyValue(node, String(valueObj.value || ""), {
                position: [rect.left, rect.top],
            });
        }

        return false;
    }

    static decodeHTML(str: string): string {
        const e = document.createElement("div");
        e.innerText = str;
        return e.innerHTML;
    }

    static onMenuResizeNode(
        _value: unknown,
        _options: unknown,
        _e: MouseEvent,
        _menu: unknown,
        node: LGraphNodeLike
    ): void {
        if (!node) {
            return;
        }

        const fApplyMultiNode = (target: LGraphNodeLike): void => {
            target.size = target.computeSize!();
            if (target.onResize) {
                target.onResize(target.size);
            }
        };

        const graphcanvas = LGraphCanvas.active_canvas as LGraphCanvasRuntimeLike;
        if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
            fApplyMultiNode(node);
        } else {
            for (const i in graphcanvas.selected_nodes) {
                fApplyMultiNode(graphcanvas.selected_nodes[i]);
            }
        }

        node.setDirtyCanvas!(true, true);
    }

    static onResizeNode(
        value: unknown,
        options: unknown,
        e: MouseEvent,
        menu: unknown,
        node: LGraphNodeLike
    ): void {
        LGraphCanvas.onMenuResizeNode(value, options, e, menu, node);
    }

    // TODO refactor :: this is used fot title but not for properties!
    static onShowPropertyEditor(
        item: { property?: string; type?: string },
        _options: unknown,
        e: MouseEvent | undefined,
        _menu: unknown,
        node: Record<string, unknown> & { setDirtyCanvas?: (fg: boolean, bg: boolean) => void }
    ): void {
        const property = item.property || "title";
        const value = node[property];

        const dialog = document.createElement("div") as HTMLDivElement & {
            is_modified?: boolean;
            close?: () => void;
        };
        dialog.is_modified = false;
        dialog.className = "graphdialog";
        dialog.innerHTML =
            "<span class='name'></span><input autofocus type='text' class='value'/><button>OK</button>";
        dialog.close = function() {
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        };

        const title = dialog.querySelector(".name");
        if (title) {
            title.textContent = property;
        }
        const input = dialog.querySelector(".value") as HTMLInputElement | null;
        if (input) {
            input.value = String(value ?? "");
            input.addEventListener("blur", function(this: HTMLInputElement) {
                this.focus();
            });
            input.addEventListener("keydown", function(ev: KeyboardEvent) {
                dialog.is_modified = true;
                if (ev.keyCode == 27) {
                    dialog.close?.();
                } else if (ev.keyCode == 13) {
                    inner();
                } else if (ev.keyCode != 13 && (ev.target as HTMLElement).localName != "textarea") {
                    return;
                }
                ev.preventDefault();
                ev.stopPropagation();
            });
        }

        const graphcanvas = LGraphCanvas.active_canvas;
        if (!graphcanvas) {
            return;
        }
        const canvas = graphcanvas.canvas;

        const rect = canvas.getBoundingClientRect();
        let offsetx = -20;
        let offsety = -20;
        if (rect) {
            offsetx -= rect.left;
            offsety -= rect.top;
        }

        const evt = e || (globalThis as unknown as { event?: MouseEvent }).event;
        if (evt) {
            dialog.style.left = evt.clientX + offsetx + "px";
            dialog.style.top = evt.clientY + offsety + "px";
        } else {
            dialog.style.left = canvas.width * 0.5 + offsetx + "px";
            dialog.style.top = canvas.height * 0.5 + offsety + "px";
        }

        const button = dialog.querySelector("button");
        if (button) {
            button.addEventListener("click", inner);
        }
        canvas.parentNode?.appendChild(dialog);
        input?.focus();

        const host = LGraphCanvas.callbackHost();
        let dialogCloseTimer: ReturnType<typeof setTimeout> | null = null;
        dialog.addEventListener("mouseleave", function() {
            if (host.dialog_close_on_mouse_leave) {
                if (!dialog.is_modified && host.dialog_close_on_mouse_leave) {
                    dialogCloseTimer = setTimeout(
                        () => dialog.close?.(),
                        host.dialog_close_on_mouse_leave_delay
                    );
                }
            }
        });
        dialog.addEventListener("mouseenter", function() {
            if (host.dialog_close_on_mouse_leave) {
                if (dialogCloseTimer) {
                    clearTimeout(dialogCloseTimer);
                }
            }
        });

        function inner(): void {
            if (input) {
                setValue(input.value);
            }
        }

        function setValue(nextValue: unknown): void {
            let safeValue = nextValue;
            if (item.type == "Number") {
                safeValue = Number(safeValue);
            } else if (item.type == "Boolean") {
                safeValue = Boolean(safeValue);
            }
            node[property] = safeValue;
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
            node.setDirtyCanvas?.(true, true);
        }
    }

    static getPropertyPrintableValue(
        value: unknown,
        values?: Record<string, unknown> | unknown[]
    ): string {
        if (!values) {
            return String(value);
        }

        if (Array.isArray(values)) {
            return String(value);
        }

        if ((values as { constructor?: unknown }).constructor === Object) {
            let desc_value = "";
            for (const k in values) {
                if ((values as Record<string, unknown>)[k] != value) {
                    continue;
                }
                desc_value = k;
                break;
            }
            return String(value) + " (" + desc_value + ")";
        }

        return String(value);
    }

    static onMenuNodeCollapse(
        _value: unknown,
        _options: unknown,
        _e: MouseEvent,
        _menu: unknown,
        node: LGraphNodeLike
    ): void {
        node.graph!.beforeChange!();
        const fApplyMultiNode = (target: LGraphNodeLike): void => {
            target.collapse!();
        };
        const graphcanvas = LGraphCanvas.active_canvas as LGraphCanvasRuntimeLike;
        if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
            fApplyMultiNode(node);
        } else {
            for (const i in graphcanvas.selected_nodes) {
                fApplyMultiNode(graphcanvas.selected_nodes[i]);
            }
        }
        node.graph!.afterChange!();
    }

    static onMenuNodePin(
        _value: unknown,
        _options: unknown,
        _e: MouseEvent,
        _menu: unknown,
        node: LGraphNodeLike
    ): void {
        node.pin!();
    }

    static onMenuNodeMode(
        _value: unknown,
        _options: unknown,
        e: MouseEvent,
        menu: unknown,
        node: LGraphNodeLike
    ): false {
        const host = LGraphCanvas.callbackHost();
        new host.ContextMenu(host.NODE_MODES, {
            event: e,
            callback: inner_clicked,
            parentMenu: menu,
            node,
        });

        function inner_clicked(v: unknown): void {
            if (!node) {
                return;
            }
            const kV = Object.values(host.NODE_MODES).indexOf(String(v));
            const fApplyMultiNode = (target: LGraphNodeLike): void => {
                if (typeof target.changeMode !== "function") {
                    return;
                }
                if (kV >= 0 && Object.values(host.NODE_MODES)[kV]) {
                    target.changeMode(kV);
                } else {
                    target.changeMode(host.ALWAYS);
                }
            };
            const graphcanvas = LGraphCanvas.active_canvas as LGraphCanvasRuntimeLike;
            if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
                fApplyMultiNode(node);
            } else {
                for (const i in graphcanvas.selected_nodes) {
                    fApplyMultiNode(graphcanvas.selected_nodes[i]);
                }
            }
        }

        return false;
    }

    static onMenuNodeColors(
        _value: unknown,
        _options: unknown,
        e: MouseEvent,
        menu: unknown,
        node: LGraphNodeLike
    ): false {
        if (!node) {
            throw "no node for color";
        }

        const host = LGraphCanvas.callbackHost();
        const values: MenuEntryLike[] = [];
        values.push({
            value: null,
            content: "<span style='display: block; padding-left: 4px;'>No color</span>",
        });

        for (const i in LGraphCanvas.node_colors) {
            const color = LGraphCanvas.node_colors[i];
            values.push({
                value: i,
                content:
                    "<span style='display: block; color: #999; padding-left: 4px; border-left: 8px solid " +
                    color.color +
                    "; background-color:" +
                    color.bgcolor +
                    "'>" +
                    i +
                    "</span>",
            });
        }
        new host.ContextMenu(values, {
            event: e,
            callback: inner_clicked,
            parentMenu: menu,
            node,
        });

        function inner_clicked(v: unknown): void {
            if (!node) {
                return;
            }
            const valueObj = v as { value?: string };
            const color = valueObj.value ? LGraphCanvas.node_colors[valueObj.value] : null;
            const fApplyColor = (target: LGraphNodeLike): void => {
                if (color) {
                    if (host.LGraphGroup && target.constructor === host.LGraphGroup) {
                        target.color = color.groupcolor;
                    } else {
                        target.color = color.color;
                        target.bgcolor = color.bgcolor;
                    }
                } else {
                    delete target.color;
                    delete target.bgcolor;
                }
            };

            const graphcanvas = LGraphCanvas.active_canvas as LGraphCanvasRuntimeLike;
            if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
                fApplyColor(node);
            } else {
                for (const i in graphcanvas.selected_nodes) {
                    fApplyColor(graphcanvas.selected_nodes[i]);
                }
            }
            node.setDirtyCanvas!(true, true);
        }

        return false;
    }

    static onMenuNodeShapes(
        _value: unknown,
        _options: unknown,
        e: MouseEvent,
        menu: unknown,
        node: LGraphNodeLike
    ): false {
        if (!node) {
            throw "no node passed";
        }
        const host = LGraphCanvas.callbackHost();
        new host.ContextMenu(host.VALID_SHAPES, {
            event: e,
            callback: inner_clicked,
            parentMenu: menu,
            node,
        });

        function inner_clicked(v: unknown): void {
            if (!node) {
                return;
            }
            node.graph!.beforeChange!();
            const fApplyMultiNode = (target: LGraphNodeLike): void => {
                target.shape = v as string;
            };
            const graphcanvas = LGraphCanvas.active_canvas as LGraphCanvasRuntimeLike;
            if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
                fApplyMultiNode(node);
            } else {
                for (const i in graphcanvas.selected_nodes) {
                    fApplyMultiNode(graphcanvas.selected_nodes[i]);
                }
            }
            node.graph!.afterChange!();
            node.setDirtyCanvas!(true);
        }
        return false;
    }

    static onMenuNodeRemove(
        _value: unknown,
        _options: unknown,
        _e: MouseEvent,
        _menu: unknown,
        node: LGraphNodeLike
    ): void {
        if (!node) {
            throw "no node passed";
        }

        const graph = node.graph;
        graph!.beforeChange!();
        const fApplyMultiNode = (target: LGraphNodeLike): void => {
            if (target.removable === false) {
                return;
            }
            graph!.remove(target);
        };
        const graphcanvas = LGraphCanvas.active_canvas as LGraphCanvasRuntimeLike;
        if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
            fApplyMultiNode(node);
        } else {
            for (const i in graphcanvas.selected_nodes) {
                fApplyMultiNode(graphcanvas.selected_nodes[i]);
            }
        }
        graph!.afterChange!();
        node.setDirtyCanvas!(true, true);
    }

    static onMenuNodeToSubgraph(
        _value: unknown,
        _options: unknown,
        _e: MouseEvent,
        _menu: unknown,
        node: LGraphNodeLike
    ): void {
        const graph = node.graph!;
        const graphcanvas = LGraphCanvas.active_canvas;
        if (!graphcanvas) {
            return;
        }

        let nodes_list = Object.values(graphcanvas.selected_nodes || {});
        if (!nodes_list.length) {
            nodes_list = [node];
        }

        const subgraph_node = LGraphCanvas.callbackHost().createNode("graph/subgraph");
        if (!subgraph_node) {
            return;
        }
        subgraph_node.pos = [node.pos[0], node.pos[1]] as Vector2;
        graph.add(subgraph_node);
        subgraph_node.buildFromNodes!(nodes_list);
        graphcanvas.deselectAllNodes!();
        node.setDirtyCanvas!(true, true);
    }

    static onMenuNodeClone(
        _value: unknown,
        _options: unknown,
        _e: MouseEvent,
        _menu: unknown,
        node: LGraphNodeLike
    ): void {
        node.graph!.beforeChange!();

        const newSelected: Record<string, LGraphNodeLike> = {};
        const fApplyMultiNode = (target: LGraphNodeLike): void => {
            if (target.clonable === false) {
                return;
            }
            const newnode = target.clone!();
            if (!newnode) {
                return;
            }
            newnode.pos = [target.pos[0] + 5, target.pos[1] + 5];
            target.graph!.add(newnode);
            newSelected[String(newnode.id)] = newnode;
        };

        const graphcanvas = LGraphCanvas.active_canvas as LGraphCanvasRuntimeLike;
        if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
            fApplyMultiNode(node);
        } else {
            for (const i in graphcanvas.selected_nodes) {
                fApplyMultiNode(graphcanvas.selected_nodes[i]);
            }
        }

        if (Object.keys(newSelected).length) {
            graphcanvas.selectNodes!(newSelected);
        }
        node.graph!.afterChange!();
        node.setDirtyCanvas!(true, true);
    }

    static getFileExtension(url: string): string {
        const question = url.indexOf("?");
        if (question != -1) {
            url = url.substr(0, question);
        }
        const point = url.lastIndexOf(".");
        if (point == -1) {
            return "";
        }
        return url.substr(point + 1).toLowerCase();
    }
}

const graphCanvasPalettePortCheck: GraphCanvasPalettePort = LGraphCanvas;
void graphCanvasPalettePortCheck;
