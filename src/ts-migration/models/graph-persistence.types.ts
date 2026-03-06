import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import type { SerializedLGraph } from "../types/serialization";
import type { LGraphGroup } from "./LGraphGroup";
import type { LiteGraphLifecycleHost } from "./LGraph.lifecycle";
import type { LGraphNodeCanvasCollab as LGraphNode } from "./LGraphNode.canvas-collab";

type BivariantHandler<TArg> = {
    bivarianceHack(data: TArg): void;
}["bivarianceHack"];

export interface LiteGraphPersistenceHost
    extends LiteGraphLifecycleHost,
        Pick<LiteGraphConstantsShape, "VERSION"> {
    createNode?: (
        type: string | null | undefined,
        title?: string
    ) => GraphNodePersistenceLike | null;
    LGraphNode?: new () => GraphNodePersistenceLike;
    LGraphGroup?: new () => GraphGroupPersistenceLike;
}

export interface SerializedNodePersistenceLike {
    id: number;
    type: string | null;
    title?: string;
    [key: string]: unknown;
}

export interface SerializedGraphPersistenceLike extends Record<string, unknown> {
    nodes?: SerializedNodePersistenceLike[];
    links?: unknown[] | Record<number, unknown> | Record<string, unknown>;
    groups?: unknown[];
    extra?: Record<string, unknown>;
}

type GraphNodePersistenceBase = Pick<
    LGraphNode,
    "id" | "serialize" | "configure" | "disconnectInput"
>;

export interface GraphNodePersistenceLike extends GraphNodePersistenceBase {
    graph: unknown | null;
    last_serialization?: SerializedNodePersistenceLike;
    has_errors?: boolean;
    [key: string]: unknown;
}

type GraphGroupPersistenceBase = Pick<LGraphGroup, "serialize">;

export interface GraphGroupPersistenceLike extends GraphGroupPersistenceBase {
    graph: unknown | null;
    configure: (data: unknown) => void;
    [key: string]: unknown;
}

export interface GraphLinkPersistenceLike {
    id: number;
    target_id: number | string;
    target_slot: number;
    serialize: () => unknown;
    configure?: BivariantHandler<GraphLinkPersistenceInput>;
}

export type GraphLinkPersistenceInput =
    | GraphLinkPersistenceLike
    | readonly unknown[]
    | Record<string, unknown>;

export interface GraphDataForSerialize
    extends SerializedLGraph<unknown, unknown, unknown> {
    extra: Record<string, unknown>;
}

export interface PreparedGraphSerializationSource {
    last_node_id: number;
    last_link_id: number;
    nodes: GraphNodePersistenceLike[];
    links: GraphLinkPersistenceLike[];
    groups: GraphGroupPersistenceLike[];
    config: GraphDataForSerialize["config"];
    extra: Record<string, unknown>;
    version: number;
}

export interface GraphSerializationRepairSource {
    _nodes: GraphNodePersistenceLike[];
    links: Record<string, GraphLinkPersistenceInput>;
    _groups: GraphGroupPersistenceLike[];
    last_node_id: number;
    last_link_id: number;
    config: GraphDataForSerialize["config"];
    extra?: Record<string, unknown>;
    version?: number;
}

export interface GraphDeserializeTarget {
    _nodes: GraphNodePersistenceLike[];
    _groups: GraphGroupPersistenceLike[];
    links: Record<number, GraphLinkPersistenceLike>;
    extra: Record<string, unknown>;
    _version: number;
    add: (
        item: GraphNodePersistenceLike | GraphGroupPersistenceLike,
        skip_compute_order?: boolean
    ) => unknown;
    getNodeById: (
        id: number | string | null | undefined
    ) => GraphNodePersistenceLike | null | undefined;
    updateExecutionOrder: () => void;
    setDirtyCanvas: (fg: boolean, bg?: boolean) => void;
    onConfigure?: (data: SerializedGraphPersistenceLike) => void;
}

export interface GraphDeserializerFactories {
    createLink: () => GraphLinkPersistenceLike;
    createNode: (data: SerializedNodePersistenceLike) => GraphNodePersistenceLike;
    createGroup: () => GraphGroupPersistenceLike;
}
