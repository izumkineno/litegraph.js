import type {
    GraphDataForSerialize,
    PreparedGraphSerializationSource,
} from "./graph-persistence.types";

export function serializeGraphData(
    source: PreparedGraphSerializationSource
): GraphDataForSerialize {
    const nodes = source.nodes.map((node) => node.serialize());
    const links = source.links.map((link) => link.serialize());
    const groups = source.groups.map((group) => group.serialize());

    return {
        last_node_id: source.last_node_id,
        last_link_id: source.last_link_id,
        nodes,
        links,
        groups,
        config: source.config,
        extra: source.extra,
        version: source.version,
    };
}
