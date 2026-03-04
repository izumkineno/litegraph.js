// TODO: Import full LiteGraph runtime host from its future module

import type { INodeInputSlot, INodeOutputSlot, Vector2, Vector4 } from "../types/core-types";
import { LLink } from "./LLink";
import { LGraphNodePortsWidgets } from "./LGraphNode.ports-widgets";

function isInsideRectangle(
    x: number,
    y: number,
    left: number,
    top: number,
    width: number,
    height: number
): boolean {
    return left < x && left + width > x && top < y && top + height > y;
}

type SlotId = number | string;
type InSlot = INodeInputSlot & { link: number | null; pos?: Vector2 };
type OutSlot = INodeOutputSlot & { links: number[] | null; pos?: Vector2; _data?: unknown };
type LinkLike = {
    id: number | string;
    type?: string | number;
    origin_id: number | string;
    origin_slot: number;
    target_id: number | string;
    target_slot: number;
    _last_time?: number;
    data?: unknown;
};
type NodeLike = {
    id: number | string;
    mode?: number;
    inputs?: InSlot[];
    outputs?: OutSlot[];
    graph: GraphLike | null;
    findInputSlot?: (name: string, returnObj?: boolean) => number | InSlot;
    findInputSlotByType?: (
        type: string | number,
        returnObj?: boolean,
        preferFreeSlot?: boolean,
        doNotUseOccupied?: boolean
    ) => number | InSlot;
    findOutputSlotByType?: (
        type: string | number,
        returnObj?: boolean,
        preferFreeSlot?: boolean,
        doNotUseOccupied?: boolean
    ) => number | OutSlot;
    findInputSlotFree?: (opts?: { returnObj?: boolean; typesNotAccepted?: unknown[] }) => number | InSlot;
    findOutputSlotFree?: (opts?: { returnObj?: boolean; typesNotAccepted?: unknown[] }) => number | OutSlot;
    onBeforeConnectInput?: (target_slot: number) => number | false | null;
    onConnectInput?: (
        target_slot: number,
        outputType: unknown,
        output: OutSlot,
        originNode: LGraphNodeConnectGeometry,
        originSlot: number
    ) => boolean | void;
    onConnectOutput?: (
        slot: number,
        inputType: unknown,
        input: InSlot,
        targetNode: NodeLike,
        targetSlot: number
    ) => boolean | void;
    onConnectionsChange?: (
        io: number,
        slot: number,
        connected: boolean,
        link: LinkLike,
        slotInfo: InSlot | OutSlot
    ) => void;
    connect?: (slot: SlotId, target: NodeLike, targetSlot: SlotId) => LinkLike | null;
    disconnectInput?: (slot: SlotId, _opts?: unknown) => boolean;
    disconnectOutput?: (slot: SlotId, target?: NodeLike | number | false | null, _opts?: unknown) => boolean;
    addOnExecutedOutput?: () => number;
    changeMode?: (mode: number) => boolean;
};
type GraphLike = {
    links: Record<string, LinkLike>;
    last_link_id: number;
    _version: number;
    isLive?: () => boolean;
    beforeChange?: () => void;
    afterChange?: () => void;
    connectionChange?: (node: NodeLike, link?: LinkLike) => void;
    onNodeConnectionChange?: (
        io: number,
        node: NodeLike | null,
        slot: number,
        otherNode?: NodeLike,
        otherSlot?: number
    ) => void;
    getNodeById: (id: number | string) => NodeLike | null;
};

interface Host {
    NODE_TITLE_HEIGHT: number;
    NODE_COLLAPSED_WIDTH: number;
    NODE_SLOT_HEIGHT: number;
    INPUT: number;
    OUTPUT: number;
    EVENT: number | string;
    ON_TRIGGER: number;
    do_add_triggers_slots: boolean;
    allow_multi_output_for_events: boolean;
    use_uuids: boolean;
    uuidv4: () => string;
    debug: boolean;
    isValidConnection: (a: unknown, b: unknown) => boolean;
    getTime: () => number;
}

const hostDefaults: Host = {
    NODE_TITLE_HEIGHT: 30,
    NODE_COLLAPSED_WIDTH: 80,
    NODE_SLOT_HEIGHT: 20,
    INPUT: 1,
    OUTPUT: 2,
    EVENT: -1,
    ON_TRIGGER: 3,
    do_add_triggers_slots: false,
    allow_multi_output_for_events: true,
    use_uuids: false,
    uuidv4: () => "",
    debug: false,
    isValidConnection: () => true,
    getTime: () => Date.now(),
};

/**
 * LGraphNode connection and geometry methods.
 * Source: `find*Slot*`、`connect*`、`disconnect*`、`getConnectionPos/getBounding/isPointInside`.
 */
export class LGraphNodeConnectGeometry extends LGraphNodePortsWidgets {
    _collapsed_width?: number;
    onBounding?: (out: Vector4) => void;
    onConnectOutput?: (
        slot: number,
        inputType: unknown,
        input: InSlot,
        targetNode: NodeLike,
        targetSlot: number
    ) => boolean | void;

    private host(): Host {
        const classHost = (LGraphNodeConnectGeometry as typeof LGraphNodeConnectGeometry & {
            liteGraph?: Partial<Host>;
        }).liteGraph;
        const ctorHost = (this.constructor as typeof LGraphNodeConnectGeometry & { liteGraph?: Partial<Host> })
            .liteGraph;
        return { ...hostDefaults, ...(classHost || {}), ...(ctorHost || {}) };
    }

    private graphRef(): GraphLike | null {
        return (this.graph as GraphLike) || null;
    }

    private toNode(node: NodeLike | number | null | undefined): NodeLike | null {
        if (node == null || node === (false as unknown as number)) {
            return null;
        }
        return typeof node === "number" ? this.graphRef()?.getNodeById(node) || null : node;
    }

    /** returns the bounding of the object, used for rendering purposes */
    getBounding(out?: Vector4, compute_outer?: boolean): Vector4 {
        const h = this.host();
        const o = (out || (new Float32Array(4) as unknown as Vector4)) as Vector4;
        const isCollapsed = !!this.flags.collapsed;
        const p = this.pos;
        const s = this.size;

        let left = 0;
        let right = 1;
        let top = 0;
        let bottom = 0;
        if (compute_outer) {
            left = 4;
            right = 6 + left;
            top = 4;
            bottom = 5 + top;
        }

        o[0] = p[0] - left;
        o[1] = p[1] - h.NODE_TITLE_HEIGHT - top;
        o[2] = isCollapsed ? (this._collapsed_width || h.NODE_COLLAPSED_WIDTH) + right : s[0] + right;
        o[3] = isCollapsed ? h.NODE_TITLE_HEIGHT + bottom : s[1] + h.NODE_TITLE_HEIGHT + bottom;
        this.onBounding?.(o);
        return o;
    }

    /** checks if a point is inside the shape of a node */
    isPointInside(x: number, y: number, margin?: number, skip_title?: boolean): boolean {
        const h = this.host();
        const m = margin || 0;
        let margin_top = this.graphRef()?.isLive?.() ? 0 : h.NODE_TITLE_HEIGHT;
        if (skip_title) {
            margin_top = 0;
        }
        if (this.flags?.collapsed) {
            return isInsideRectangle(
                x,
                y,
                this.pos[0] - m,
                this.pos[1] - h.NODE_TITLE_HEIGHT - m,
                (this._collapsed_width || h.NODE_COLLAPSED_WIDTH) + 2 * m,
                h.NODE_TITLE_HEIGHT + 2 * m
            );
        }
        return (
            this.pos[0] - 4 - m < x &&
            this.pos[0] + this.size[0] + 4 + m > x &&
            this.pos[1] - margin_top - m < y &&
            this.pos[1] + this.size[1] + m > y
        );
    }

    /** checks if a point is inside a node slot, and returns info about which slot */
    getSlotInPosition(
        x: number,
        y: number
    ): { input?: InSlot; output?: OutSlot; slot: number; link_pos: Vector2 } | null {
        const link_pos = new Float32Array(2) as unknown as Vector2;
        if (this.inputs) {
            for (let i = 0; i < this.inputs.length; ++i) {
                const input = this.inputs[i] as InSlot;
                this.getConnectionPos(true, i, link_pos);
                if (isInsideRectangle(x, y, link_pos[0] - 10, link_pos[1] - 5, 20, 10)) {
                    return { input, slot: i, link_pos };
                }
            }
        }
        if (this.outputs) {
            for (let i = 0; i < this.outputs.length; ++i) {
                const output = this.outputs[i] as OutSlot;
                this.getConnectionPos(false, i, link_pos);
                if (isInsideRectangle(x, y, link_pos[0] - 10, link_pos[1] - 5, 20, 10)) {
                    return { output, slot: i, link_pos };
                }
            }
        }
        return null;
    }

    /** returns the input slot with a given name (used for dynamic slots), -1 if not found */
    findInputSlot(name: string, returnObj?: boolean): number | InSlot {
        if (!this.inputs) {
            return -1;
        }
        for (let i = 0; i < this.inputs.length; ++i) {
            if (name == this.inputs[i].name) {
                return !returnObj ? i : (this.inputs[i] as InSlot);
            }
        }
        return -1;
    }

    /** returns the output slot with a given name (used for dynamic slots), -1 if not found */
    findOutputSlot(name: string, returnObj?: boolean): number | OutSlot {
        if (!this.outputs) {
            return -1;
        }
        for (let i = 0; i < this.outputs.length; ++i) {
            if (name == this.outputs[i].name) {
                return !returnObj ? i : (this.outputs[i] as OutSlot);
            }
        }
        return -1;
    }

    findInputSlotFree(optsIn?: { returnObj?: boolean; typesNotAccepted?: unknown[] }): number | InSlot {
        const opts = Object.assign({ returnObj: false, typesNotAccepted: [] as unknown[] }, optsIn || {});
        if (!this.inputs) {
            return -1;
        }
        for (let i = 0; i < this.inputs.length; ++i) {
            const it = this.inputs[i] as InSlot;
            if (it.link && it.link != null) {
                continue;
            }
            if (opts.typesNotAccepted.includes(it.type)) {
                continue;
            }
            return !opts.returnObj ? i : it;
        }
        return -1;
    }

    findOutputSlotFree(optsIn?: { returnObj?: boolean; typesNotAccepted?: unknown[] }): number | OutSlot {
        const opts = Object.assign({ returnObj: false, typesNotAccepted: [] as unknown[] }, optsIn || {});
        if (!this.outputs) {
            return -1;
        }
        for (let i = 0; i < this.outputs.length; ++i) {
            const it = this.outputs[i] as OutSlot;
            if (it.links && it.links != null) {
                continue;
            }
            if (opts.typesNotAccepted.includes(it.type)) {
                continue;
            }
            return !opts.returnObj ? i : it;
        }
        return -1;
    }

    findInputSlotByType(type: string | number, returnObj?: boolean, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): number | InSlot {
        return this.findSlotByType(true, type, returnObj, preferFreeSlot, doNotUseOccupied) as number | InSlot;
    }

    findOutputSlotByType(type: string | number, returnObj?: boolean, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): number | OutSlot {
        return this.findSlotByType(false, type, returnObj, preferFreeSlot, doNotUseOccupied) as number | OutSlot;
    }

    /** returns the output (or input) slot with a given type, -1 if not found */
    findSlotByType(
        input: boolean,
        type: string | number,
        returnObj?: boolean,
        preferFreeSlot?: boolean,
        doNotUseOccupied?: boolean
    ): number | InSlot | OutSlot {
        const h = this.host();
        const slots = (input ? this.inputs : this.outputs) as (InSlot | OutSlot)[] | undefined;
        if (!slots) {
            return -1;
        }
        let src: string | number = type;
        if (src == "" || src == "*") {
            src = 0;
        }
        for (let i = 0; i < slots.length; ++i) {
            const aSource = (src + "").toLowerCase().split(",");
            let aDest: string | number = ((slots[i] as OutSlot).type || 0) as string | number;
            aDest = aDest == "0" || aDest == "*" ? "0" : aDest;
            const aDestArr = (aDest + "").toLowerCase().split(",");
            for (let sI = 0; sI < aSource.length; sI++) {
                for (let dI = 0; dI < aDestArr.length; dI++) {
                    if (aSource[sI] == "_event_") {
                        aSource[sI] = String(h.EVENT);
                    }
                    if (aDestArr[sI] == "_event_") {
                        aDestArr[sI] = String(h.EVENT);
                    }
                    if (aSource[sI] == "*") {
                        aSource[sI] = "0";
                    }
                    if (aDestArr[sI] == "*") {
                        aDestArr[sI] = "0";
                    }
                    if (aSource[sI] == aDestArr[dI]) {
                        if (preferFreeSlot && (slots[i] as OutSlot).links && (slots[i] as OutSlot).links !== null) {
                            continue;
                        }
                        return !returnObj ? i : slots[i];
                    }
                }
            }
        }
        if (preferFreeSlot && !doNotUseOccupied) {
            for (let i = 0; i < slots.length; ++i) {
                const aSource = (src + "").toLowerCase().split(",");
                let aDest: string | number = ((slots[i] as OutSlot).type || 0) as string | number;
                aDest = aDest == "0" || aDest == "*" ? "0" : aDest;
                const aDestArr = (aDest + "").toLowerCase().split(",");
                for (let sI = 0; sI < aSource.length; sI++) {
                    for (let dI = 0; dI < aDestArr.length; dI++) {
                        if (aSource[sI] == "*") {
                            aSource[sI] = "0";
                        }
                        if (aDestArr[sI] == "*") {
                            aDestArr[sI] = "0";
                        }
                        if (aSource[sI] == aDestArr[dI]) {
                            return !returnObj ? i : slots[i];
                        }
                    }
                }
            }
        }
        return -1;
    }

    connectByType(
        slot: SlotId,
        target_node: NodeLike | number,
        target_slotType: string | number,
        optsIn?: { createEventInCase?: boolean; firstFreeIfOutputGeneralInCase?: boolean; generalTypeInCase?: boolean; filter?: unknown }
    ): LinkLike | null {
        const h = this.host();
        const opts = Object.assign(
            { createEventInCase: true, firstFreeIfOutputGeneralInCase: true, generalTypeInCase: true },
            optsIn || {}
        );
        const target = this.toNode(target_node) as NodeLike;
        const typed = target.findInputSlotByType(target_slotType, false, true);
        if (typeof typed === "number" && typed >= 0) {
            return this.connect(slot, target, typed);
        }
        if (opts.createEventInCase && target_slotType == h.EVENT) {
            return this.connect(slot, target, -1);
        }
        if (opts.generalTypeInCase) {
            const generic = target.findInputSlotByType(0, false, true, true);
            if (typeof generic === "number" && generic >= 0) {
                return this.connect(slot, target, generic);
            }
        }
        if (opts.firstFreeIfOutputGeneralInCase && (target_slotType == 0 || target_slotType == "*" || target_slotType == "")) {
            const free = target.findInputSlotFree({ typesNotAccepted: [h.EVENT] });
            if (typeof free === "number" && free >= 0) {
                return this.connect(slot, target, free);
            }
        }
        console.debug("no way to connect type: ", target_slotType, " to targetNODE ", target);
        return null;
    }

    connectByTypeOutput(
        slot: SlotId,
        source_node: NodeLike | number,
        source_slotType: string | number,
        optsIn?: { createEventInCase?: boolean; firstFreeIfInputGeneralInCase?: boolean; generalTypeInCase?: boolean; filter?: unknown }
    ): LinkLike | null {
        const h = this.host();
        const opts = Object.assign(
            { createEventInCase: true, firstFreeIfInputGeneralInCase: true, generalTypeInCase: true },
            optsIn || {}
        );
        const source = this.toNode(source_node) as NodeLike;
        const typed = source.findOutputSlotByType(source_slotType, false, true);
        if (typeof typed === "number" && typed >= 0) {
            return source.connect(typed, this as unknown as NodeLike, slot);
        }
        if (opts.generalTypeInCase) {
            const generic = source.findOutputSlotByType(0, false, true, true);
            if (typeof generic === "number" && generic >= 0) {
                return source.connect(generic, this as unknown as NodeLike, slot);
            }
        }
        if (opts.createEventInCase && source_slotType == h.EVENT && h.do_add_triggers_slots && source.addOnExecutedOutput) {
            return source.connect(source.addOnExecutedOutput(), this as unknown as NodeLike, slot);
        }
        if (opts.firstFreeIfInputGeneralInCase && (source_slotType == 0 || source_slotType == "*" || source_slotType == "")) {
            const free = source.findOutputSlotFree({ typesNotAccepted: [h.EVENT] });
            if (typeof free === "number" && free >= 0) {
                return source.connect(free, this as unknown as NodeLike, slot);
            }
        }
        console.debug("no way to connect byOUT type: ", source_slotType, " to sourceNODE ", source);
        return null;
    }

    /** connect this node output to the input of another node */
    connect(slot: SlotId, target_node: NodeLike | number, target_slot?: SlotId): LinkLike | null {
        const h = this.host();
        const graph = this.graphRef();
        if (!graph) {
            console.log("Connect: Error, node doesn't belong to any graph. Nodes must be added first to a graph before connecting them.");
            return null;
        }

        let outSlot: number = typeof slot === "string" ? (this.findOutputSlot(slot) as number) : slot;
        if (outSlot === -1 || !this.outputs || outSlot >= this.outputs.length) {
            if (h.debug) {
                console.log(typeof slot === "string" ? "Connect: Error, no slot of name " + slot : "Connect: Error, slot number not found");
            }
            return null;
        }

        const target = this.toNode(target_node);
        if (!target) {
            throw "target node is null";
        }
        if (target == (this as unknown as NodeLike)) {
            return null;
        }

        let targetSlot: SlotId | false | null = target_slot || 0;
        if (typeof targetSlot === "string") {
            targetSlot = target.findInputSlot(targetSlot) as number;
            if (targetSlot === -1) {
                if (h.debug) {
                    console.log("Connect: Error, no slot of name " + target_slot);
                }
                return null;
            }
        } else if (targetSlot === h.EVENT) {
            if (!h.do_add_triggers_slots) {
                return null;
            }
            target.changeMode(h.ON_TRIGGER);
            targetSlot = target.findInputSlot("onTrigger") as number;
        } else if (!target.inputs || targetSlot >= target.inputs.length) {
            if (h.debug) {
                console.log("Connect: Error, slot number not found");
            }
            return null;
        }

        let changed = false;
        const output = this.outputs[outSlot] as OutSlot;
        if (!this.outputs[outSlot]) {
            return null;
        }

        const input = target.inputs![targetSlot as number] as InSlot;
        let link_info: LinkLike | null = null;

        if (target.onBeforeConnectInput) {
            targetSlot = target.onBeforeConnectInput(targetSlot as number) as SlotId | false | null;
        }
        if (targetSlot === false || targetSlot === null || !h.isValidConnection(output.type, input.type)) {
            this.setDirtyCanvas(false, true);
            if (changed) {
                graph.connectionChange?.(this as unknown as NodeLike, link_info || undefined);
            }
            return null;
        }

        if (target.onConnectInput && target.onConnectInput(targetSlot as number, output.type, output, this, outSlot) === false) {
            return null;
        }
        if (this.onConnectOutput && this.onConnectOutput(outSlot, input.type, input, target, targetSlot as number) === false) {
            return null;
        }

        if (target.inputs && target.inputs[targetSlot as number] && target.inputs[targetSlot as number].link != null) {
            graph.beforeChange?.();
            target.disconnectInput(targetSlot as number, { doProcessChange: false });
            changed = true;
        }
        if (output.links && output.links.length && output.type === h.EVENT && !h.allow_multi_output_for_events) {
            graph.beforeChange?.();
            this.disconnectOutput(outSlot, false, { doProcessChange: false });
            changed = true;
        }

        const nextId = h.use_uuids ? h.uuidv4() : ++graph.last_link_id;
        link_info = new LLink(
            nextId as number,
            (input.type || output.type) as string,
            this.id as number,
            outSlot,
            target.id as number,
            targetSlot as number
        ) as unknown as LinkLike;
        graph.links[link_info.id as unknown as string] = link_info;

        if (!output.links) {
            output.links = [];
        }
        output.links.push(link_info.id as unknown as number);
        if (target.inputs) {
            target.inputs[targetSlot as number].link = link_info.id as unknown as number;
        }

        graph._version++;
        this.onConnectionsChange?.(h.OUTPUT, outSlot, true, link_info, output);
        target.onConnectionsChange?.(h.INPUT, targetSlot as number, true, link_info, input as InSlot);
        graph.onNodeConnectionChange?.(h.INPUT, target, targetSlot as number, this as unknown as NodeLike, outSlot);
        graph.onNodeConnectionChange?.(h.OUTPUT, this as unknown as NodeLike, outSlot, target, targetSlot as number);

        this.setDirtyCanvas(false, true);
        graph.afterChange?.();
        graph.connectionChange?.(this as unknown as NodeLike, link_info);
        return link_info;
    }

    /** disconnect one output to an specific node */
    disconnectOutput(slot: SlotId, target_node?: NodeLike | number | false | null, _opts?: unknown): boolean {
        const h = this.host();
        const graph = this.graphRef();
        if (!graph) {
            return false;
        }
        const outSlot = typeof slot === "string" ? (this.findOutputSlot(slot) as number) : slot;
        if (!this.outputs || outSlot === -1 || outSlot >= this.outputs.length) {
            if (h.debug) {
                console.log(typeof slot === "string" ? "Connect: Error, no slot of name " + slot : "Connect: Error, slot number not found");
            }
            return false;
        }
        const output = this.outputs[outSlot] as OutSlot;
        if (!output || !output.links || output.links.length == 0) {
            return false;
        }

        if (target_node) {
            const target = this.toNode(target_node as NodeLike | number);
            if (!target) {
                throw "Target Node not found";
            }
            for (let i = 0; i < output.links.length; i++) {
                const link_id = output.links[i];
                const link = graph.links[link_id as unknown as string] as LinkLike;
                if (link.target_id == target.id) {
                    output.links.splice(i, 1);
                    const input = target.inputs![link.target_slot] as InSlot;
                    input.link = null;
                    delete graph.links[link_id as unknown as string];
                    graph._version++;
                    target.onConnectionsChange?.(h.INPUT, link.target_slot, false, link, input);
                    this.onConnectionsChange?.(h.OUTPUT, outSlot, false, link, output);
                    graph.onNodeConnectionChange?.(h.OUTPUT, this as unknown as NodeLike, outSlot);
                    graph.onNodeConnectionChange?.(h.OUTPUT, this as unknown as NodeLike, outSlot);
                    graph.onNodeConnectionChange?.(h.INPUT, target, link.target_slot);
                    break;
                }
            }
        } else {
            for (let i = 0; i < output.links.length; i++) {
                const link_id = output.links[i];
                const link = graph.links[link_id as unknown as string];
                if (!link) {
                    continue;
                }
                const target = graph.getNodeById(link.target_id);
                let input: InSlot | null = null;
                graph._version++;
                if (target) {
                    input = target.inputs![link.target_slot] as InSlot;
                    input.link = null;
                    target.onConnectionsChange?.(h.INPUT, link.target_slot, false, link, input);
                    graph.onNodeConnectionChange?.(h.INPUT, target, link.target_slot);
                }
                delete graph.links[link_id as unknown as string];
                this.onConnectionsChange?.(h.OUTPUT, outSlot, false, link, output);
                graph.onNodeConnectionChange?.(h.OUTPUT, this as unknown as NodeLike, outSlot);
                graph.onNodeConnectionChange?.(h.INPUT, target, link.target_slot);
            }
            output.links = null;
        }

        this.setDirtyCanvas(false, true);
        graph.connectionChange?.(this as unknown as NodeLike);
        return true;
    }

    /** disconnect one input */
    disconnectInput(slot: SlotId, _opts?: unknown): boolean {
        const h = this.host();
        const graph = this.graphRef();
        if (!graph) {
            return false;
        }
        const inSlot = typeof slot === "string" ? (this.findInputSlot(slot) as number) : slot;
        if (!this.inputs || inSlot === -1 || inSlot >= this.inputs.length) {
            if (h.debug) {
                console.log(typeof slot === "string" ? "Connect: Error, no slot of name " + slot : "Connect: Error, slot number not found");
            }
            return false;
        }

        const input = this.inputs[inSlot] as InSlot;
        if (!input) {
            return false;
        }
        const link_id = input.link;
        if (link_id != null) {
            input.link = null;
            const link = graph.links[link_id as unknown as string];
            if (link) {
                const originNode = graph.getNodeById(link.origin_id);
                if (!originNode) {
                    return false;
                }
                const output = originNode.outputs![link.origin_slot] as OutSlot;
                if (!output || !output.links || output.links.length === 0) {
                    return false;
                }
                let i = 0;
                for (i = 0; i < output.links.length; i++) {
                    if (output.links[i] == link_id) {
                        output.links.splice(i, 1);
                        break;
                    }
                }
                delete graph.links[link_id as unknown as string];
                graph._version++;
                this.onConnectionsChange?.(h.INPUT, inSlot, false, link, input);
                originNode.onConnectionsChange?.(h.OUTPUT, i, false, link, output);
                graph.onNodeConnectionChange?.(h.OUTPUT, originNode, i);
                graph.onNodeConnectionChange?.(h.INPUT, this as unknown as NodeLike, inSlot);
            }
        }

        this.setDirtyCanvas(false, true);
        graph.connectionChange?.(this as unknown as NodeLike);
        return true;
    }

    /** returns the center of a connection point in canvas coords */
    getConnectionPos(is_input: boolean, slot_number: SlotId, out?: Vector2): Vector2 {
        const h = this.host();
        const o = (out || (new Float32Array(2) as unknown as Vector2)) as Vector2;
        let num_slots = 0;
        if (is_input && this.inputs) {
            num_slots = this.inputs.length;
        }
        if (!is_input && this.outputs) {
            num_slots = this.outputs.length;
        }
        const offset = h.NODE_SLOT_HEIGHT * 0.5;

        if (this.flags.collapsed) {
            const w = this._collapsed_width || h.NODE_COLLAPSED_WIDTH;
            if (this.horizontal) {
                o[0] = this.pos[0] + w * 0.5;
                o[1] = is_input ? this.pos[1] - h.NODE_TITLE_HEIGHT : this.pos[1];
            } else {
                o[0] = is_input ? this.pos[0] : this.pos[0] + w;
                o[1] = this.pos[1] - h.NODE_TITLE_HEIGHT * 0.5;
            }
            return o;
        }

        if (is_input && slot_number == -1) {
            o[0] = this.pos[0] + h.NODE_TITLE_HEIGHT * 0.5;
            o[1] = this.pos[1] + h.NODE_TITLE_HEIGHT * 0.5;
            return o;
        }

        if (is_input && this.inputs && num_slots > (slot_number as number) && (this.inputs[slot_number as number] as InSlot).pos) {
            const p = (this.inputs[slot_number as number] as InSlot).pos as Vector2;
            o[0] = this.pos[0] + p[0];
            o[1] = this.pos[1] + p[1];
            return o;
        } else if (!is_input && this.outputs && num_slots > (slot_number as number) && (this.outputs[slot_number as number] as OutSlot).pos) {
            const p = (this.outputs[slot_number as number] as OutSlot).pos as Vector2;
            o[0] = this.pos[0] + p[0];
            o[1] = this.pos[1] + p[1];
            return o;
        }

        if (this.horizontal) {
            o[0] = this.pos[0] + ((slot_number as number) + 0.5) * (this.size[0] / num_slots);
            o[1] = is_input ? this.pos[1] - h.NODE_TITLE_HEIGHT : this.pos[1] + this.size[1];
            return o;
        }

        o[0] = is_input ? this.pos[0] + offset : this.pos[0] + this.size[0] + 1 - offset;
        const cls = this.constructor as { slot_start_y?: number };
        o[1] = this.pos[1] + ((slot_number as number) + 0.7) * h.NODE_SLOT_HEIGHT + (cls.slot_start_y || 0);
        return o;
    }

    // placeholder to keep this module self-contained during incremental migration.
    setDirtyCanvas(_fg: boolean, _bg: boolean): void {
        // implemented in Task 19
    }
}
