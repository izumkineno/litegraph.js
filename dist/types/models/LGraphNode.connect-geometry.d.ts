import type { INodeInputSlot, INodeOutputSlot, Vector2, Vector4 } from "../types/core-types";
import { LGraphNodePortsWidgets } from "./LGraphNode.ports-widgets";
type SlotId = number | string;
type InSlot = INodeInputSlot & {
    link: number | null;
    pos?: Vector2;
};
type OutSlot = INodeOutputSlot & {
    links: number[] | null;
    pos?: Vector2;
    _data?: unknown;
};
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
    findInputSlotByType?: (type: string | number, returnObj?: boolean, preferFreeSlot?: boolean, doNotUseOccupied?: boolean) => number | InSlot;
    findOutputSlotByType?: (type: string | number, returnObj?: boolean, preferFreeSlot?: boolean, doNotUseOccupied?: boolean) => number | OutSlot;
    findInputSlotFree?: (opts?: {
        returnObj?: boolean;
        typesNotAccepted?: unknown[];
    }) => number | InSlot;
    findOutputSlotFree?: (opts?: {
        returnObj?: boolean;
        typesNotAccepted?: unknown[];
    }) => number | OutSlot;
    onBeforeConnectInput?: (target_slot: number) => number | false | null;
    onConnectInput?: (target_slot: number, outputType: unknown, output: OutSlot, originNode: LGraphNodeConnectGeometry, originSlot: number) => boolean | void;
    onConnectOutput?: (slot: number, inputType: unknown, input: InSlot, targetNode: NodeLike, targetSlot: number) => boolean | void;
    onConnectionsChange?: (io: number, slot: number, connected: boolean, link: LinkLike, slotInfo: InSlot | OutSlot) => void;
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
    onNodeConnectionChange?: (io: number, node: NodeLike | null, slot: number, otherNode?: NodeLike, otherSlot?: number) => void;
    getNodeById: (id: number | string) => NodeLike | null;
};
/**
 * LGraphNode connection and geometry methods.
 * Source: `find*Slot*`、`connect*`、`disconnect*`、`getConnectionPos/getBounding/isPointInside`.
 */
export declare class LGraphNodeConnectGeometry extends LGraphNodePortsWidgets {
    _collapsed_width?: number;
    onBounding?: (out: Vector4) => void;
    onConnectOutput?: (slot: number, inputType: unknown, input: InSlot, targetNode: NodeLike, targetSlot: number) => boolean | void;
    private graphRef;
    private toNode;
    private markSlotOptional;
    /** returns the bounding of the object, used for rendering purposes */
    getBounding(out?: Vector4, compute_outer?: boolean): Vector4;
    /** checks if a point is inside the shape of a node */
    isPointInside(x: number, y: number, margin?: number, skip_title?: boolean): boolean;
    /** checks if a point is inside a node slot, and returns info about which slot */
    getSlotInPosition(x: number, y: number): {
        input?: InSlot;
        output?: OutSlot;
        slot: number;
        link_pos: Vector2;
    } | null;
    /** returns the input slot with a given name (used for dynamic slots), -1 if not found */
    findInputSlot(name: string, returnObj?: boolean): number | InSlot;
    /** returns the output slot with a given name (used for dynamic slots), -1 if not found */
    findOutputSlot(name: string, returnObj?: boolean): number | OutSlot;
    findInputSlotFree(optsIn?: {
        returnObj?: boolean;
        typesNotAccepted?: unknown[];
    }): number | InSlot;
    findOutputSlotFree(optsIn?: {
        returnObj?: boolean;
        typesNotAccepted?: unknown[];
    }): number | OutSlot;
    findInputSlotByType(type: string | number, returnObj?: boolean, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): number | InSlot;
    findOutputSlotByType(type: string | number, returnObj?: boolean, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): number | OutSlot;
    /** returns the output (or input) slot with a given type, -1 if not found */
    findSlotByType(input: boolean, type: string | number, returnObj?: boolean, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): number | InSlot | OutSlot;
    addOnTriggerInput(): number;
    addOnExecutedOutput(): number;
    onAfterExecuteNode: NonNullable<LGraphNodePortsWidgets["onAfterExecuteNode"]>;
    changeMode(modeTo: number): boolean;
    connectByType(slot: SlotId, target_node: NodeLike | number, target_slotType: string | number, optsIn?: {
        createEventInCase?: boolean;
        firstFreeIfOutputGeneralInCase?: boolean;
        generalTypeInCase?: boolean;
        filter?: unknown;
    }): LinkLike | null;
    connectByTypeOutput(slot: SlotId, source_node: NodeLike | number, source_slotType: string | number, optsIn?: {
        createEventInCase?: boolean;
        firstFreeIfInputGeneralInCase?: boolean;
        generalTypeInCase?: boolean;
        filter?: unknown;
    }): LinkLike | null;
    /** connect this node output to the input of another node */
    connect(slot: SlotId, target_node: NodeLike | number, target_slot?: SlotId): LinkLike | null;
    /** disconnect one output to an specific node */
    disconnectOutput(slot: SlotId, target_node?: NodeLike | number | false | null, _opts?: unknown): boolean;
    /** disconnect one input */
    disconnectInput(slot: SlotId, _opts?: unknown): boolean;
    /** returns the center of a connection point in canvas coords */
    getConnectionPos(is_input: boolean, slot_number: SlotId, out?: Vector2): Vector2;
    setDirtyCanvas(_fg: boolean, _bg: boolean): void;
}
export {};
