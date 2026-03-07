import type {
    GraphMutationGraphLike,
    GraphMutationLinkLike,
    GraphMutationNodeId,
    GraphMutationNodeLike,
} from "./GraphMutationBus";
import type { NodeViewHost } from "./NodeViewHost";

export const PORT_DIRECTION_UP = 1;
export const PORT_DIRECTION_RIGHT = 2;
export const PORT_DIRECTION_DOWN = 3;
export const PORT_DIRECTION_LEFT = 4;

export type NodePortKind = "input" | "output";

export interface NodePortSlotLike {
    type?: unknown;
    dir?: number;
    shape?: unknown;
    link?: number | string | null;
    links?: Array<number | string> | null;
    [key: string]: unknown;
}

export interface NodePortNodeLike extends GraphMutationNodeLike {
    pos: [number, number];
    size: [number, number];
    horizontal?: boolean;
    inputs?: NodePortSlotLike[];
    outputs?: NodePortSlotLike[];
    getSlotInPosition?: (
        x: number,
        y: number
    ) => {
        input?: NodePortSlotLike;
        output?: NodePortSlotLike;
        slot: number;
        link_pos: [number, number];
    } | null;
    getConnectionPos?: (
        isInput: boolean,
        slot: number,
        out?: [number, number]
    ) => [number, number];
    getBounding?: (
        out?: Float32Array | [number, number, number, number],
        computeOuter?: boolean
    ) => [number, number, number, number];
    connect?: (
        slot: number,
        target: NodePortNodeLike | number | string,
        targetSlot?: number
    ) => GraphMutationLinkLike | null;
    alignToGrid?: () => void;
    [key: string]: unknown;
}

interface NodePortGraphLike extends GraphMutationGraphLike {
    _nodes?: NodePortNodeLike[];
    getNodeById?: (id: GraphMutationNodeId) => NodePortNodeLike | null;
    getNodeOnPos?: (
        x: number,
        y: number,
        visibleNodes?: NodePortNodeLike[],
        margin?: number
    ) => NodePortNodeLike | null;
}

export interface NodePortHit {
    readonly node: NodePortNodeLike;
    readonly nodeId: GraphMutationNodeId;
    readonly kind: NodePortKind;
    readonly slotIndex: number;
    readonly slot: NodePortSlotLike;
    readonly anchor: readonly [number, number];
    readonly dir: number;
}

export interface LinkEndpointLayout {
    readonly start: readonly [number, number];
    readonly end: readonly [number, number];
    readonly startDir: number;
    readonly endDir: number;
}

export interface NodePortAdapterOptions {
    resolveNodeHost?: (nodeId: GraphMutationNodeId) => NodeViewHost | null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toPoint(
    value: { x?: unknown; y?: unknown } | readonly [number, number]
): [number, number] {
    if (
        Array.isArray(value) ||
        ArrayBuffer.isView(value as ArrayBufferView) ||
        (typeof value === "object" &&
            value !== null &&
            "0" in (value as Record<string, unknown>) &&
            "1" in (value as Record<string, unknown>))
    ) {
        const indexedValue = value as Record<string, unknown>;
        return [toFiniteNumber(indexedValue[0]), toFiniteNumber(indexedValue[1])];
    }
    const point = value as { x?: unknown; y?: unknown };
    return [toFiniteNumber(point.x), toFiniteNumber(point.y)];
}

function distance(
    a: readonly [number, number],
    b: readonly [number, number]
): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return Math.sqrt(dx * dx + dy * dy);
}

export function getOppositePortDirection(direction: number): number {
    if (direction === PORT_DIRECTION_UP) {
        return PORT_DIRECTION_DOWN;
    }
    if (direction === PORT_DIRECTION_DOWN) {
        return PORT_DIRECTION_UP;
    }
    if (direction === PORT_DIRECTION_LEFT) {
        return PORT_DIRECTION_RIGHT;
    }
    return PORT_DIRECTION_LEFT;
}

export class NodePortAdapter {
    constructor(
        private readonly graph: NodePortGraphLike,
        private readonly options: NodePortAdapterOptions = {}
    ) {}

    getNodeById(nodeId: GraphMutationNodeId): NodePortNodeLike | null {
        if (typeof this.graph.getNodeById === "function") {
            return this.graph.getNodeById(nodeId);
        }

        const nodes = Array.isArray(this.graph._nodes) ? this.graph._nodes : [];
        for (let i = 0; i < nodes.length; ++i) {
            if (nodes[i]?.id === nodeId) {
                return nodes[i];
            }
        }
        return null;
    }

    getNodeAt(x: number, y: number): NodePortNodeLike | null {
        if (typeof this.graph.getNodeOnPos === "function") {
            return this.graph.getNodeOnPos(x, y, undefined, 5) || null;
        }

        const nodes = Array.isArray(this.graph._nodes) ? this.graph._nodes : [];
        for (let i = nodes.length - 1; i >= 0; --i) {
            const node = nodes[i];
            const bounds = node.getBounding?.(undefined, true);
            if (!bounds) {
                continue;
            }
            const left = toFiniteNumber(bounds[0]);
            const top = toFiniteNumber(bounds[1]);
            const width = toFiniteNumber(bounds[2]);
            const height = toFiniteNumber(bounds[3]);
            if (
                x >= left &&
                x <= left + width &&
                y >= top &&
                y <= top + height
            ) {
                return node;
            }
        }

        return null;
    }

    hitPortAt(x: number, y: number): NodePortHit | null {
        const node = this.getNodeAt(x, y);
        if (!node) {
            return null;
        }

        const hostHit = this.options.resolveNodeHost?.(node.id)?.hitPortAt?.(x, y);
        if (hostHit) {
            const slotList = hostHit.kind === "input" ? node.inputs : node.outputs;
            const slot =
                (Array.isArray(slotList) ? slotList[hostHit.slotIndex] : null) ||
                {};
            return {
                node,
                nodeId: node.id,
                kind: hostHit.kind,
                slotIndex: hostHit.slotIndex,
                slot: slot as NodePortSlotLike,
                anchor: hostHit.anchor,
                dir:
                    hostHit.dir ??
                    this.getPortDirection(
                        node,
                        hostHit.kind,
                        hostHit.slotIndex,
                        slot as NodePortSlotLike
                    ),
            };
        }

        if (typeof node.getSlotInPosition !== "function") {
            return null;
        }

        const slotInfo = node.getSlotInPosition(x, y);
        if (!slotInfo) {
            return null;
        }

        const kind: NodePortKind = slotInfo.output ? "output" : "input";
        const slot = (slotInfo.output || slotInfo.input) as NodePortSlotLike;
        const anchor = slotInfo.link_pos
            ? toPoint(slotInfo.link_pos)
            : this.getPortAnchor(node.id, kind, slotInfo.slot);

        return {
            node,
            nodeId: node.id,
            kind,
            slotIndex: slotInfo.slot,
            slot,
            anchor,
            dir: this.getPortDirection(node, kind, slotInfo.slot, slot),
        };
    }

    getPortAnchor(
        nodeId: GraphMutationNodeId,
        kind: NodePortKind,
        slotIndex: number
    ): [number, number] {
        const hostAnchor = this.options.resolveNodeHost?.(nodeId)?.getPortAnchor?.(
            kind,
            slotIndex
        );
        if (hostAnchor) {
            return [toFiniteNumber(hostAnchor[0]), toFiniteNumber(hostAnchor[1])];
        }

        const node = this.getNodeById(nodeId);
        if (!node || typeof node.getConnectionPos !== "function") {
            return [0, 0];
        }

        const rawPoint = node.getConnectionPos(kind === "input", slotIndex) as
            | { x?: unknown; y?: unknown }
            | ArrayLike<unknown>
            | undefined;
        if (!rawPoint) {
            return [0, 0];
        }

        // Legacy nodes frequently return Float32Array values here. Reading the
        // indexed entries directly avoids runtime ambiguities across wrappers.
        if (typeof rawPoint === "object" && rawPoint !== null && "0" in rawPoint) {
            const indexedPoint = rawPoint as ArrayLike<unknown>;
            return [
                toFiniteNumber(indexedPoint[0]),
                toFiniteNumber(indexedPoint[1]),
            ];
        }

        return toPoint(rawPoint as { x?: unknown; y?: unknown });
    }

    getPortDirection(
        node: NodePortNodeLike,
        kind: NodePortKind,
        slotIndex: number,
        slot?: NodePortSlotLike | null
    ): number {
        const hostDirection = this.options.resolveNodeHost?.(node.id)?.getPortDirection?.(
            kind,
            slotIndex
        );
        if (hostDirection != null) {
            const normalizedDirection = toFiniteNumber(hostDirection, 0);
            if (normalizedDirection) {
                return normalizedDirection;
            }
        }

        const slotList = kind === "input" ? node.inputs : node.outputs;
        const resolvedSlot = slot || slotList?.[slotIndex] || null;
        const explicitDir = toFiniteNumber(resolvedSlot?.dir, 0);
        if (explicitDir) {
            return explicitDir;
        }

        if (kind === "output") {
            return node.horizontal ? PORT_DIRECTION_DOWN : PORT_DIRECTION_RIGHT;
        }

        return node.horizontal ? PORT_DIRECTION_UP : PORT_DIRECTION_LEFT;
    }

    getLinkLayout(link: GraphMutationLinkLike): LinkEndpointLayout | null {
        const originNode = this.getNodeById(link.origin_id);
        const targetNode = this.getNodeById(link.target_id);
        if (!originNode || !targetNode) {
            return null;
        }

        return {
            start: this.getPortAnchor(link.origin_id, "output", link.origin_slot),
            end: this.getPortAnchor(link.target_id, "input", link.target_slot),
            startDir: this.getPortDirection(
                originNode,
                "output",
                link.origin_slot,
                originNode.outputs?.[link.origin_slot]
            ),
            endDir: this.getPortDirection(
                targetNode,
                "input",
                link.target_slot,
                targetNode.inputs?.[link.target_slot]
            ),
        };
    }

    buildLinkPath(
        start: readonly [number, number],
        end: readonly [number, number],
        startDir: number,
        endDir: number
    ): string {
        const safeStart = toPoint(start);
        const safeEnd = toPoint(end);
        const dist = Math.max(distance(safeStart, safeEnd), 16);
        const c1 = [safeStart[0], safeStart[1]] as [number, number];
        const c2 = [safeEnd[0], safeEnd[1]] as [number, number];

        if (startDir === PORT_DIRECTION_LEFT) {
            c1[0] += dist * -0.25;
        } else if (startDir === PORT_DIRECTION_RIGHT) {
            c1[0] += dist * 0.25;
        } else if (startDir === PORT_DIRECTION_UP) {
            c1[1] += dist * -0.25;
        } else if (startDir === PORT_DIRECTION_DOWN) {
            c1[1] += dist * 0.25;
        }

        if (endDir === PORT_DIRECTION_LEFT) {
            c2[0] += dist * -0.25;
        } else if (endDir === PORT_DIRECTION_RIGHT) {
            c2[0] += dist * 0.25;
        } else if (endDir === PORT_DIRECTION_UP) {
            c2[1] += dist * -0.25;
        } else if (endDir === PORT_DIRECTION_DOWN) {
            c2[1] += dist * 0.25;
        }

        return `M ${safeStart[0]} ${safeStart[1]} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${safeEnd[0]} ${safeEnd[1]}`;
    }
}
