import type {
    GraphDeserializeTarget,
    GraphDeserializerFactories,
    SerializedGraphPersistenceLike,
} from "./graph-persistence.types";
import type { RepairedSerializedGraphData } from "./serialization-repair";

export function deserializeGraphData(
    target: GraphDeserializeTarget,
    data: RepairedSerializedGraphData,
    factories: GraphDeserializerFactories
): void {
    for (const key in data) {
        if (key === "nodes" || key === "groups" || key === "links") {
            continue;
        }
        (target as unknown as Record<string, unknown>)[key] = data[key];
    }

    const links = {} as Record<number, ReturnType<GraphDeserializerFactories["createLink"]>>;
    for (let i = 0; i < data.links.length; ++i) {
        const link = factories.createLink();
        if (typeof link.configure !== "function") {
            throw new Error("Graph deserializer requires link.configure()");
        }
        link.configure(data.links[i]);
        links[link.id] = link;
    }
    target.links = links;

    target._nodes = [];
    for (let i = 0; i < data.nodes.length; ++i) {
        const nodeData = data.nodes[i];
        const node = factories.createNode(nodeData);
        node.id = nodeData.id;
        target.add(node, true);
    }

    for (let i = 0; i < data.nodes.length; ++i) {
        const nodeData = data.nodes[i];
        const node = target.getNodeById(nodeData.id);
        if (!node) {
            throw new Error(
                `Deserialized node missing after add: ${String(nodeData.id)}`
            );
        }
        node.configure(nodeData);
    }

    target._groups.length = 0;
    for (let i = 0; i < data.groups.length; ++i) {
        const group = factories.createGroup();
        group.configure(data.groups[i]);
        target.add(group);
    }

    target.updateExecutionOrder();
    target.extra = data.extra || {};

    if (target.onConfigure) {
        target.onConfigure(data as SerializedGraphPersistenceLike);
    }

    target._version++;
    target.setDirtyCanvas(true, true);
}
