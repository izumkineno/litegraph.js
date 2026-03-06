import { createClassHostResolver } from "../core/host-resolver";
import { deserializeGraphData } from "./graph-deserializer";
import { serializeGraphData } from "./graph-serializer";
import type {
    GraphDataForSerialize,
    GraphDeserializeTarget,
    GraphGroupPersistenceLike,
    GraphLinkPersistenceLike,
    GraphNodePersistenceLike,
    LiteGraphPersistenceHost,
    SerializedGraphPersistenceLike,
} from "./graph-persistence.types";
import { LLink } from "./LLink";
import { LGraphIOEvents } from "./LGraph.io-events";
import {
    createNodeWithSerializationRepair,
    prepareGraphForSerialization,
    repairSerializedGraphForDeserialization,
} from "./serialization-repair";

const defaultPersistenceHost: LiteGraphPersistenceHost = {
    debug: false,
    getTime: () => Date.now(),
    VERSION: 0,
};

const resolvePersistenceHost = createClassHostResolver(defaultPersistenceHost, {
    cacheKey: "LGraph.persistence",
    fallbackOwners: [() => LGraphPersistence, () => LGraphIOEvents],
});

/**
 * LGraph persistence methods.
 * Source: `removeLink/serialize/configure/load/onNodeTrace`.
 */
export class LGraphPersistence extends LGraphIOEvents {
    onSerialize?: (data: GraphDataForSerialize) => void;
    onConfigure?: (data: SerializedGraphPersistenceLike) => void;

    /**
     * Destroys a link
     * @method removeLink
     * @param {Number} link_id
     */
    removeLink(link_id: number): void {
        const link = (this.links as Record<number, GraphLinkPersistenceLike>)[
            link_id
        ];
        if (!link) {
            return;
        }
        const node = this.getNodeById(
            link.target_id
        ) as unknown as GraphNodePersistenceLike | null | undefined;
        if (node) {
            node.disconnectInput(link.target_slot);
        }
    }

    // save and recover app state ***************************************
    /**
     * Creates a Object containing all the info about this graph, it can be serialized
     * @method serialize
     * @return {Object} value of the node
     */
    serialize(): GraphDataForSerialize {
        const repaired = prepareGraphForSerialization(
            this as unknown as Parameters<typeof prepareGraphForSerialization>[0],
            () => new LLink(0, "", 0, 0, 0, 0)
        );
        for (let i = 0; i < repaired.warnings.length; ++i) {
            console.warn(repaired.warnings[i]);
        }
        const data = serializeGraphData({
            ...repaired.source,
            version: resolvePersistenceHost(this).VERSION,
        });

        if (this.onSerialize) {
            this.onSerialize(data);
        }

        return data;
    }

    /**
     * Configure a graph from a JSON string
     * @method configure
     * @param {String} str configure a graph from a JSON string
     * @param {Boolean} returns if there was any error parsing
     */
    configure(
        data: object,
        keep_old?: boolean
    ): boolean | undefined {
        if (!data) {
            return undefined;
        }
        const graphData = data as SerializedGraphPersistenceLike;

        if (!keep_old) {
            this.clear();
        }
        const repaired = repairSerializedGraphForDeserialization(graphData);
        for (let i = 0; i < repaired.warnings.length; ++i) {
            console.warn(repaired.warnings[i]);
        }

        const host = resolvePersistenceHost(this);
        const LGraphGroupCtor = host.LGraphGroup as new () => GraphGroupPersistenceLike;
        let error = false;

        deserializeGraphData(
            this as unknown as GraphDeserializeTarget,
            repaired.data,
            {
                createLink: () => new LLink(0, "", 0, 0, 0, 0),
                createNode: (nodeData) => {
                    const result = createNodeWithSerializationRepair(
                        host,
                        nodeData
                    );
                    if (result.usedFallback) {
                        error = true;
                        if (host.debug) {
                            console.log(
                                "Node not found or has errors: " + nodeData.type
                            );
                        }
                    }
                    return result.node;
                },
                createGroup: () => new LGraphGroupCtor(),
            }
        );

        return error;
    }

    load(
        url: string | File | Blob,
        callback?: (() => void) | undefined
    ): void {
        const that = this;

        const isFileLike =
            url.constructor === File || url.constructor === Blob;

        // from file
        if (isFileLike) {
            const reader = new FileReader();
            reader.addEventListener("load", function(event) {
                const target = event.target as FileReader;
                const data = JSON.parse(String(target.result));
                that.configure(data as SerializedGraphPersistenceLike);
                if (callback) {
                    callback();
                }
            });

            reader.readAsText(url as File | Blob);
            return;
        }

        // is a string, then an URL
        const req = new XMLHttpRequest();
        req.open("GET", url as string, true);
        req.send(null);
        req.onload = function() {
            if (req.status !== 200) {
                console.error("Error loading graph:", req.status, req.response);
                return;
            }
            const data = JSON.parse(req.response);
            that.configure(data as SerializedGraphPersistenceLike);
            if (callback) {
                callback();
            }
        };
        req.onerror = function(err) {
            console.error("Error loading graph:", err);
        };
    }

    onNodeTrace(
        _node: GraphNodePersistenceLike,
        _msg: string,
        _color?: string
    ): void {
        // TODO
    }
}
