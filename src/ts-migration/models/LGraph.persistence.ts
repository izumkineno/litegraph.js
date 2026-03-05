// TODO: Import LGraphNode from its future module
// TODO: Import LGraphGroup from its future module
// TODO: Import full LiteGraph runtime host from its future module

import type { SerializedLGraph } from "../types/serialization";
import { LLink } from "./LLink";
import { type LiteGraphLifecycleHost } from "./LGraph.lifecycle";
import { LGraphIOEvents } from "./LGraph.io-events";

interface LiteGraphPersistenceHost extends LiteGraphLifecycleHost {
    VERSION: number;
    createNode?: (
        type: string | null | undefined,
        title?: string
    ) => GraphNodePersistenceLike | null;
    LGraphNode?: new () => GraphNodePersistenceLike;
    LGraphGroup?: new () => GraphGroupPersistenceLike;
}

const defaultPersistenceHost: LiteGraphPersistenceHost = {
    debug: false,
    getTime: () => Date.now(),
    VERSION: 0,
};

interface SerializedNodePersistenceLike {
    id: number;
    type: string | null;
    title?: string;
    [key: string]: unknown;
}

interface SerializedGraphPersistenceLike extends Record<string, unknown> {
    nodes?: SerializedNodePersistenceLike[];
    links?: unknown[] | Record<number, unknown>;
    groups?: unknown[];
    extra?: Record<string, unknown>;
}

interface GraphNodePersistenceLike {
    id: number | string;
    graph: LGraphPersistence | null;
    serialize: () => unknown;
    configure: (info: SerializedNodePersistenceLike) => void;
    disconnectInput: (slot: number) => void;
    last_serialization?: SerializedNodePersistenceLike;
    has_errors?: boolean;
    [key: string]: unknown;
}

interface GraphGroupPersistenceLike {
    graph: LGraphPersistence | null;
    configure: (data: unknown) => void;
    serialize: () => unknown;
    [key: string]: unknown;
}

interface GraphLinkPersistenceLike {
    id: number;
    target_id: number | string;
    target_slot: number;
    serialize: () => unknown;
    [key: string]: unknown;
}

interface GraphDataForSerialize
    extends SerializedLGraph<unknown, unknown, unknown> {
    extra: Record<string, unknown>;
}

/**
 * LGraph persistence methods.
 * Source: `removeLink/serialize/configure/load/onNodeTrace`.
 */
export class LGraphPersistence extends LGraphIOEvents {
    onSerialize?: (data: GraphDataForSerialize) => void;
    onConfigure?: (data: SerializedGraphPersistenceLike) => void;

    private getPersistenceHost(): LiteGraphPersistenceHost {
        const ctor = this.constructor as {
            liteGraph?: Partial<LiteGraphPersistenceHost>;
        };
        const host =
            (ctor.liteGraph ||
                (LGraphPersistence as unknown as {
                    liteGraph?: Partial<LiteGraphPersistenceHost>;
                }).liteGraph ||
                (LGraphIOEvents as unknown as {
                    liteGraph?: Partial<LiteGraphPersistenceHost>;
                }).liteGraph ||
                {}) as Partial<LiteGraphPersistenceHost>;
        return { ...defaultPersistenceHost, ...host };
    }

    private createFallbackNode(
        nInfo: SerializedNodePersistenceLike
    ): GraphNodePersistenceLike {
        const host = this.getPersistenceHost();
        const LGraphNodeCtor = host.LGraphNode as new () => GraphNodePersistenceLike;
        const node = new LGraphNodeCtor();
        node.last_serialization = nInfo;
        node.has_errors = true;
        return node;
    }

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
        const nodesInfo: unknown[] = [];
        const nodes = this._nodes as unknown as GraphNodePersistenceLike[];
        for (let i = 0, l = nodes.length; i < l; ++i) {
            nodesInfo.push(nodes[i].serialize());
        }

        // pack link info into a non-verbose format
        const links: unknown[] = [];
        const graphLinks = this.links as Record<string, GraphLinkPersistenceLike>;
        for (const i in graphLinks) {
            // links is an OBJECT
            let link = graphLinks[i];
            if (!link.serialize) {
                // weird bug I havent solved yet
                console.warn(
                    "weird LLink bug, link info is not a LLink but a regular object"
                );
                const link2 = new (LLink as unknown as {
                    new (): LLink;
                })() as unknown as Record<string, unknown>;
                for (const j in link) {
                    link2[j] = link[j];
                }
                graphLinks[i] = link2 as unknown as GraphLinkPersistenceLike;
                link = graphLinks[i];
            }

            links.push(link.serialize());
        }

        const groupsInfo: unknown[] = [];
        const groups = this._groups as unknown as GraphGroupPersistenceLike[];
        for (let i = 0; i < groups.length; ++i) {
            groupsInfo.push(groups[i].serialize());
        }

        const data: GraphDataForSerialize = {
            last_node_id: this.last_node_id,
            last_link_id: this.last_link_id,
            nodes: nodesInfo,
            links,
            groups: groupsInfo,
            config: this.config,
            extra: this.extra,
            version: this.getPersistenceHost().VERSION,
        };

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

        const nodes = graphData.nodes;

        // decode links info (they are very verbose)
        if (
            graphData.links &&
            (graphData.links as { constructor?: unknown }).constructor === Array
        ) {
            const links: LLink[] = [];
            for (let i = 0; i < (graphData.links as unknown[]).length; ++i) {
                const linkData = (graphData.links as unknown[])[i];
                if (!linkData) {
                    // weird bug
                    console.warn("serialized graph link data contains errors, skipping.");
                    continue;
                }
                const link = new (LLink as unknown as { new (): LLink })();
                link.configure(linkData as unknown as Parameters<LLink["configure"]>[0]);
                links[link.id] = link;
            }
            graphData.links = links as unknown as Record<number, unknown>;
        }

        // copy all stored fields
        for (const i in graphData) {
            if (i == "nodes" || i == "groups") {
                // links must be accepted
                continue;
            }
            (this as unknown as Record<string, unknown>)[i] = graphData[i];
        }

        let error = false;

        // create nodes
        this._nodes = [];
        if (nodes) {
            const host = this.getPersistenceHost();
            for (let i = 0, l = nodes.length; i < l; ++i) {
                const nInfo = nodes[i]; // stored info
                const createNode = host.createNode as (
                    type: string | null | undefined,
                    title?: string
                ) => GraphNodePersistenceLike | null;
                let node = createNode(nInfo.type, nInfo.title);
                if (!node) {
                    if (host.debug) {
                        console.log(
                            "Node not found or has errors: " +
                                nInfo.type
                        );
                    }

                    // in case of error we create a replacement node to avoid losing info
                    node = this.createFallbackNode(nInfo);
                    error = true;
                    // continue;
                }

                node.id = nInfo.id; // id it or it will create a new id
                this.add(
                    node as unknown as Parameters<LGraphPersistence["add"]>[0],
                    true
                ); // add before configure, otherwise configure cannot create links
            }

            // configure nodes afterwards so they can reach each other
            for (let i = 0, l = nodes.length; i < l; ++i) {
                const nInfo = nodes[i];
                const node = this.getNodeById(
                    nInfo.id
                ) as unknown as GraphNodePersistenceLike | null | undefined;
                if (node) {
                    node.configure(nInfo);
                }
            }
        }

        // groups
        this._groups.length = 0;
        if (graphData.groups) {
            const host = this.getPersistenceHost();
            const LGraphGroupCtor = host.LGraphGroup as new () => GraphGroupPersistenceLike;
            for (let i = 0; i < graphData.groups.length; ++i) {
                const group = new LGraphGroupCtor();
                group.configure(graphData.groups[i]);
                this.add(group as unknown as Parameters<LGraphPersistence["add"]>[0]);
            }
        }

        this.updateExecutionOrder();

        this.extra = graphData.extra || {};

        if (this.onConfigure) {
            this.onConfigure(graphData);
        }

        this._version++;
        this.setDirtyCanvas(true, true);
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
