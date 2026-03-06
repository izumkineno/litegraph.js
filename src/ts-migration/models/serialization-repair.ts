import { LLink } from "./LLink";
import type {
    GraphLinkPersistenceInput,
    GraphNodePersistenceLike,
    GraphSerializationRepairSource,
    LiteGraphPersistenceHost,
    PreparedGraphSerializationSource,
    SerializedGraphPersistenceLike,
    SerializedNodePersistenceLike,
} from "./graph-persistence.types";

export interface GraphSerializationRepairResult {
    source: PreparedGraphSerializationSource;
    repairedLinks: number;
    warnings: string[];
}

export interface RepairedSerializedGraphData
    extends Omit<SerializedGraphPersistenceLike, "nodes" | "links" | "groups" | "extra"> {
    nodes: SerializedNodePersistenceLike[];
    links: unknown[];
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

export function prepareGraphForSerialization(
    graph: GraphSerializationRepairSource,
    createLink = (): LLink => new LLink(0, "", 0, 0, 0, 0)
): GraphSerializationRepairResult {
    const warnings: string[] = [];
    let repairedLinks = 0;
    const graphLinks = graph.links || {};
    const links = [] as PreparedGraphSerializationSource["links"];

    for (const id in graphLinks) {
        let link = graphLinks[id] as GraphLinkPersistenceInput;
        if (!link) {
            continue;
        }

        if (
            typeof (link as Partial<{ serialize: () => unknown }>).serialize !==
            "function"
        ) {
            warnings.push(
                "weird LLink bug, link info is not a LLink but a regular object"
            );
            const repairedLink = createLink() as unknown as Record<string, unknown>;
            for (const key in link as Record<string, unknown>) {
                repairedLink[key] = (link as Record<string, unknown>)[key];
            }
            graphLinks[id] = repairedLink as GraphLinkPersistenceInput;
            link = graphLinks[id];
            repairedLinks += 1;
        }

        links.push(link as PreparedGraphSerializationSource["links"][number]);
    }

    return {
        source: {
            last_node_id: graph.last_node_id,
            last_link_id: graph.last_link_id,
            nodes: graph._nodes || [],
            links,
            groups: graph._groups || [],
            config: graph.config,
            extra: graph.extra || {},
            version: graph.version || 0,
        },
        repairedLinks,
        warnings,
    };
}

export function repairSerializedGraphForDeserialization(
    data: object
): GraphDeserializationRepairResult {
    const input = data as SerializedGraphPersistenceLike;
    const warnings: string[] = [];
    const links: unknown[] = [];
    let skippedLinks = 0;

    if (Array.isArray(input.links)) {
        for (let i = 0; i < input.links.length; ++i) {
            const linkData = input.links[i];
            if (!linkData) {
                warnings.push(
                    "serialized graph link data contains errors, skipping."
                );
                skippedLinks += 1;
                continue;
            }
            links.push(linkData);
        }
    } else if (input.links && typeof input.links === "object") {
        for (const id in input.links) {
            const linkData = input.links[id];
            if (!linkData) {
                continue;
            }
            links.push(linkData);
        }
    }

    return {
        data: {
            ...input,
            nodes: Array.isArray(input.nodes) ? input.nodes : [],
            links,
            groups: Array.isArray(input.groups) ? input.groups : [],
            extra: input.extra || {},
        },
        skippedLinks,
        warnings,
    };
}

export function createNodeWithSerializationRepair(
    host: LiteGraphPersistenceHost,
    data: SerializedNodePersistenceLike
): NodeCreationRepairResult {
    const createNode = host.createNode as
        | ((
              type: string | null | undefined,
              title?: string
          ) => GraphNodePersistenceLike | null)
        | undefined;

    let node = createNode?.(data.type, data.title) || null;
    if (node) {
        return {
            node,
            usedFallback: false,
        };
    }

    const LGraphNodeCtor = host.LGraphNode as
        | (new () => GraphNodePersistenceLike)
        | undefined;
    if (!LGraphNodeCtor) {
        throw new Error(
            `Unable to create node for serialized type "${String(data.type)}"`
        );
    }

    node = new LGraphNodeCtor();
    node.last_serialization = data;
    node.has_errors = true;

    return {
        node,
        usedFallback: true,
    };
}
