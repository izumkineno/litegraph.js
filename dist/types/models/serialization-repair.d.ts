import { LLink } from "./LLink";
import type { GraphLinkPersistenceInput, GraphNodePersistenceLike, GraphSerializationRepairSource, LiteGraphPersistenceHost, PreparedGraphSerializationSource, SerializedGraphPersistenceLike, SerializedNodePersistenceLike } from "./graph-persistence.types";
export interface GraphSerializationRepairResult {
    source: PreparedGraphSerializationSource;
    repairedLinks: number;
    warnings: string[];
}
export interface RepairedSerializedGraphData extends Omit<SerializedGraphPersistenceLike, "nodes" | "links" | "groups" | "extra"> {
    nodes: SerializedNodePersistenceLike[];
    links: GraphLinkPersistenceInput[];
    groups: unknown[];
    extra: Record<string, unknown>;
}
export interface GraphDeserializationRepairResult {
    data: RepairedSerializedGraphData;
    skippedLinks: number;
    warnings: string[];
}
export interface NodeCreationRepairResult {
    node: GraphNodePersistenceLike;
    usedFallback: boolean;
}
export declare function prepareGraphForSerialization(graph: GraphSerializationRepairSource, createLink?: () => LLink): GraphSerializationRepairResult;
export declare function repairSerializedGraphForDeserialization(data: object): GraphDeserializationRepairResult;
export declare function createNodeWithSerializationRepair(host: LiteGraphPersistenceHost, data: SerializedNodePersistenceLike): NodeCreationRepairResult;
