import { Group } from "leafer-ui";

import type { LeaferAppHost } from "./LeaferAppHost";
import {
    GraphMutationBus,
    type GraphMutationGraphLike,
    type GraphMutationLinkId,
    type GraphMutationLinkLike,
    type GraphMutationNodeId,
    type GraphMutationNodeLike,
} from "./GraphMutationBus";
import { LegacyNodeHost } from "./LegacyNodeHost";
import type { LegacyNodeRenderHost } from "./LegacyNodePainter";
import { discriminateNodeRuntime } from "./NodeRuntimeDiscriminator";

export type NodeHost = LegacyNodeHost;
export type LinkView = Group;
export type SceneSyncRenderHost = LegacyNodeRenderHost;

interface DirtyCapableNode extends GraphMutationNodeLike {
    setDirtyCanvas?: (
        dirtyForeground: boolean,
        dirtyBackground?: boolean
    ) => void;
}

function toMutationKey(id: GraphMutationNodeId | GraphMutationLinkId): string {
    return String(id);
}

function createPlaceholderGroup(
    name: string,
    kind: "link-view"
): Group {
    return new Group({
        name,
        hittable: false,
        visible: false,
        data: {
            litegraphPlaceholderKind: kind,
        },
    });
}

export class SceneSyncController {
    readonly nodeHosts = new Map<GraphMutationNodeId, NodeHost>();
    readonly linkViews = new Map<GraphMutationLinkId, LinkView>();
    readonly linksByNodeId = new Map<GraphMutationNodeId, Set<GraphMutationLinkId>>();

    private readonly unsubscribers: Array<() => void> = [];
    private readonly nodesById = new Map<GraphMutationNodeId, GraphMutationNodeLike>();
    private readonly dirtyBridgeUninstallers = new Map<
        GraphMutationNodeId,
        () => void
    >();

    constructor(
        private readonly graph: GraphMutationGraphLike,
        private readonly bus: GraphMutationBus,
        private readonly appHost: LeaferAppHost,
        private readonly renderHost: SceneSyncRenderHost
    ) {
        this.unsubscribers.push(
            this.bus.on("graph:clear", () => {
                this.clearScene();
            }),
            this.bus.on("node:add", ({ node }) => {
                this.ensureNodeHost(node);
            }),
            this.bus.on("node:remove", ({ nodeId }) => {
                this.removeNodeHost(nodeId);
            }),
            this.bus.on("node:dirty", ({ nodeId, node }) => {
                this.handleNodeDirty(nodeId, node);
            }),
            this.bus.on("link:add", ({ linkId, link }) => {
                this.ensureLinkView(linkId, link);
            }),
            this.bus.on("link:remove", ({ linkId, link }) => {
                this.removeLinkView(linkId, link);
            })
        );

        this.hydrateFromGraph();
    }

    destroy(): void {
        for (let i = 0; i < this.unsubscribers.length; ++i) {
            this.unsubscribers[i]();
        }
        this.unsubscribers.length = 0;
        this.clearScene();
    }

    private hydrateFromGraph(): void {
        const existingNodes = Array.isArray(this.graph._nodes)
            ? this.graph._nodes
            : [];
        for (let i = 0; i < existingNodes.length; ++i) {
            this.ensureNodeHost(existingNodes[i]);
        }

        for (const [linkId, link] of Object.entries(this.graph.links || {})) {
            this.ensureLinkView(linkId, link);
        }
    }

    private clearScene(): void {
        for (const host of this.nodeHosts.values()) {
            host.destroy();
        }
        for (const view of this.linkViews.values()) {
            view.destroy();
        }
        for (const uninstall of this.dirtyBridgeUninstallers.values()) {
            uninstall();
        }

        this.nodeHosts.clear();
        this.linkViews.clear();
        this.linksByNodeId.clear();
        this.nodesById.clear();
        this.dirtyBridgeUninstallers.clear();
    }

    private ensureNodeHost(node: GraphMutationNodeLike): NodeHost {
        const nodeId = node.id;
        const existingHost = this.nodeHosts.get(nodeId);
        this.nodesById.set(nodeId, node);
        this.ensureTrackedNodeId(nodeId);
        this.installNodeDirtyBridge(node);

        if (existingHost) {
            return existingHost;
        }

        const runtime = discriminateNodeRuntime(node);
        if (runtime !== "legacy") {
            throw new Error(
                `SceneSyncController: unsupported node runtime '${runtime}' during Phase 4.`
            );
        }

        const nodeHost = new LegacyNodeHost(
            node as GraphMutationNodeLike & {
                pos: [number, number];
                size: [number, number];
            },
            this.renderHost
        );
        this.appHost.legacyNodeLayer.add(nodeHost.root);
        this.nodeHosts.set(nodeId, nodeHost);

        return nodeHost;
    }

    private removeNodeHost(nodeId: GraphMutationNodeId): void {
        const incidentLinks = Array.from(this.linksByNodeId.get(nodeId) || []);
        for (let i = 0; i < incidentLinks.length; ++i) {
            const linkId = incidentLinks[i];
            const link = this.graph.links[toMutationKey(linkId)];
            this.removeLinkView(linkId, link);
        }

        const nodeHost = this.nodeHosts.get(nodeId);
        if (nodeHost) {
            nodeHost.destroy();
            this.nodeHosts.delete(nodeId);
        }

        this.dirtyBridgeUninstallers.get(nodeId)?.();
        this.dirtyBridgeUninstallers.delete(nodeId);
        this.nodesById.delete(nodeId);
        this.linksByNodeId.delete(nodeId);
    }

    private ensureLinkView(
        linkId: GraphMutationLinkId,
        link: GraphMutationLinkLike
    ): LinkView {
        const existingView = this.linkViews.get(linkId);
        if (existingView) {
            return existingView;
        }

        const originNode = this.findGraphNode(link.origin_id);
        const targetNode = this.findGraphNode(link.target_id);
        if (originNode) {
            this.ensureNodeHost(originNode);
        } else {
            this.ensureTrackedNodeId(link.origin_id);
        }
        if (targetNode) {
            this.ensureNodeHost(targetNode);
        } else {
            this.ensureTrackedNodeId(link.target_id);
        }

        const linkView = createPlaceholderGroup(
            `litegraph-link-view:${toMutationKey(linkId)}`,
            "link-view"
        );
        this.appHost.linkLayerBack.add(linkView);
        this.linkViews.set(linkId, linkView);
        this.trackLinkOnNode(link.origin_id, linkId);
        this.trackLinkOnNode(link.target_id, linkId);

        return linkView;
    }

    private removeLinkView(
        linkId: GraphMutationLinkId,
        link?: GraphMutationLinkLike
    ): void {
        const linkView = this.linkViews.get(linkId);
        if (linkView) {
            linkView.destroy();
            this.linkViews.delete(linkId);
        }

        if (!link) {
            return;
        }

        this.linksByNodeId.get(link.origin_id)?.delete(linkId);
        this.linksByNodeId.get(link.target_id)?.delete(linkId);
    }

    private handleNodeDirty(
        nodeId: GraphMutationNodeId,
        node?: GraphMutationNodeLike
    ): void {
        if (node) {
            this.nodesById.set(nodeId, node);
        }

        this.nodeHosts.get(nodeId)?.repaint();
    }

    private installNodeDirtyBridge(node: GraphMutationNodeLike): void {
        if (this.dirtyBridgeUninstallers.has(node.id)) {
            return;
        }

        const targetNode = node as DirtyCapableNode;
        const hadOwnProperty = Object.prototype.hasOwnProperty.call(
            targetNode,
            "setDirtyCanvas"
        );
        const ownSetDirtyCanvas = targetNode.setDirtyCanvas;
        const originalSetDirtyCanvas =
            typeof targetNode.setDirtyCanvas === "function"
                ? targetNode.setDirtyCanvas.bind(targetNode)
                : null;

        targetNode.setDirtyCanvas = (
            dirtyForeground: boolean,
            dirtyBackground?: boolean
        ): void => {
            originalSetDirtyCanvas?.(dirtyForeground, dirtyBackground);
            this.bus.emit("node:dirty", {
                graph: this.graph,
                nodeId: node.id,
                node,
                dirtyForeground,
                dirtyBackground,
            });
        };

        this.dirtyBridgeUninstallers.set(node.id, () => {
            delete targetNode.setDirtyCanvas;
            if (hadOwnProperty) {
                targetNode.setDirtyCanvas = ownSetDirtyCanvas;
            }
        });
    }

    private findGraphNode(
        nodeId: GraphMutationNodeId
    ): GraphMutationNodeLike | null {
        const existingNode = this.nodesById.get(nodeId);
        if (existingNode) {
            return existingNode;
        }

        const nodes = Array.isArray(this.graph._nodes) ? this.graph._nodes : [];
        for (let i = 0; i < nodes.length; ++i) {
            if (nodes[i]?.id === nodeId) {
                return nodes[i];
            }
        }

        return null;
    }

    private ensureTrackedNodeId(nodeId: GraphMutationNodeId): void {
        if (!this.linksByNodeId.has(nodeId)) {
            this.linksByNodeId.set(nodeId, new Set<GraphMutationLinkId>());
        }
    }

    private trackLinkOnNode(
        nodeId: GraphMutationNodeId,
        linkId: GraphMutationLinkId
    ): void {
        const links =
            this.linksByNodeId.get(nodeId) || new Set<GraphMutationLinkId>();
        links.add(linkId);
        this.linksByNodeId.set(nodeId, links);
    }
}
