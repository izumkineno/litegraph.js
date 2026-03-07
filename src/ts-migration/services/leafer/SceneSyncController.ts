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
import { LinkViewHost } from "./LinkViewHost";
import { ModernNodeHost, type ModernNodeLike } from "./ModernNodeHost";
import { discriminateNodeRuntime } from "./NodeRuntimeDiscriminator";
import {
    NodePortAdapter,
    type NodePortNodeLike,
} from "./NodePortAdapter";
import type { NodeViewHost } from "./NodeViewHost";

export type NodeHost = NodeViewHost;
export type LinkView = LinkViewHost;
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

export class SceneSyncController {
    readonly nodeHosts = new Map<GraphMutationNodeId, NodeHost>();
    readonly linkViews = new Map<GraphMutationLinkId, LinkView>();
    readonly linksByNodeId = new Map<GraphMutationNodeId, Set<GraphMutationLinkId>>();
    readonly nodePortAdapter: NodePortAdapter;

    private readonly unsubscribers: Array<() => void> = [];
    private readonly nodesById = new Map<GraphMutationNodeId, GraphMutationNodeLike>();
    private readonly linksById = new Map<GraphMutationLinkId, GraphMutationLinkLike>();
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
        this.nodePortAdapter = new NodePortAdapter(
            graph as GraphMutationGraphLike & {
                _nodes?: NodePortNodeLike[];
                getNodeById?: (id: GraphMutationNodeId) => NodePortNodeLike | null;
            },
            {
                resolveNodeHost: (nodeId) => this.nodeHosts.get(nodeId) || null,
            }
        );

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
            this.bus.on("node:moved", ({ nodeId, node }) => {
                this.syncNodeMoved(nodeId, node);
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

    repaintNodeHost(nodeId: GraphMutationNodeId): void {
        this.nodeHosts.get(nodeId)?.repaint();
        this.updateIncidentLinks(nodeId);
    }

    repaintNodeHosts(nodeIds: readonly GraphMutationNodeId[]): void {
        for (let i = 0; i < nodeIds.length; ++i) {
            this.repaintNodeHost(nodeIds[i]);
        }
    }

    repaintAllNodeHosts(): void {
        for (const [nodeId, host] of this.nodeHosts.entries()) {
            host.repaint();
            this.updateIncidentLinks(nodeId);
        }
    }

    repaintLegacyNodeHosts(): void {
        for (const [nodeId, host] of this.nodeHosts.entries()) {
            if (host.runtime !== "legacy") {
                continue;
            }
            host.repaint();
            this.updateIncidentLinks(nodeId);
        }
    }

    syncNodeMoved(
        nodeId: GraphMutationNodeId,
        node?: GraphMutationNodeLike
    ): void {
        if (node) {
            this.nodesById.set(nodeId, node);
        }

        this.nodeHosts.get(nodeId)?.syncPosition();
        this.updateIncidentLinks(nodeId);
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
        this.linksById.clear();
        this.dirtyBridgeUninstallers.clear();
    }

    private ensureNodeHost(node: GraphMutationNodeLike): NodeHost {
        const nodeId = node.id;
        const runtime = discriminateNodeRuntime(node);
        const existingHost = this.nodeHosts.get(nodeId);

        this.nodesById.set(nodeId, node);
        this.ensureTrackedNodeId(nodeId);
        this.installNodeDirtyBridge(node);

        if (existingHost && existingHost.runtime === runtime) {
            existingHost.syncPosition();
            this.updateIncidentLinks(nodeId);
            return existingHost;
        }

        if (existingHost) {
            existingHost.destroy();
            this.nodeHosts.delete(nodeId);
        }

        const nodeHost = this.createNodeHost(runtime, node);
        this.nodeHosts.set(nodeId, nodeHost);
        nodeHost.syncPosition();
        nodeHost.repaint();
        this.updateIncidentLinks(nodeId);

        return nodeHost;
    }

    private createNodeHost(
        runtime: ReturnType<typeof discriminateNodeRuntime>,
        node: GraphMutationNodeLike
    ): NodeHost {
        if (runtime === "modern") {
            const nodeHost = new ModernNodeHost(node as ModernNodeLike);
            this.appHost.modernNodeLayer.add(nodeHost.root);
            return nodeHost;
        }

        const nodeHost = new LegacyNodeHost(
            node as GraphMutationNodeLike & {
                pos: [number, number];
                size: [number, number];
            },
            this.renderHost
        );
        this.appHost.legacyNodeLayer.add(nodeHost.root);
        return nodeHost;
    }

    private removeNodeHost(nodeId: GraphMutationNodeId): void {
        const incidentLinks = Array.from(this.linksByNodeId.get(nodeId) || []);
        for (let i = 0; i < incidentLinks.length; ++i) {
            this.removeLinkView(incidentLinks[i]);
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
            this.linksById.set(linkId, link);
            this.syncLinkView(linkId, link, existingView);
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

        const linkView = new LinkViewHost(
            `litegraph-link-view:${toMutationKey(linkId)}`
        );
        this.appHost.linkLayerBack.add(linkView.view);
        this.linkViews.set(linkId, linkView);
        this.linksById.set(linkId, link);
        this.trackLinkOnNode(link.origin_id, linkId);
        this.trackLinkOnNode(link.target_id, linkId);
        this.syncLinkView(linkId, link, linkView);

        return linkView;
    }

    private removeLinkView(
        linkId: GraphMutationLinkId,
        providedLink?: GraphMutationLinkLike
    ): void {
        const resolvedLink = providedLink || this.linksById.get(linkId);
        const linkView = this.linkViews.get(linkId);
        if (linkView) {
            linkView.destroy();
            this.linkViews.delete(linkId);
        }

        this.linksById.delete(linkId);
        if (!resolvedLink) {
            return;
        }

        this.linksByNodeId.get(resolvedLink.origin_id)?.delete(linkId);
        this.linksByNodeId.get(resolvedLink.target_id)?.delete(linkId);
    }

    private handleNodeDirty(
        nodeId: GraphMutationNodeId,
        node?: GraphMutationNodeLike
    ): void {
        if (node) {
            this.nodesById.set(nodeId, node);
        }

        this.nodeHosts.get(nodeId)?.repaint();
        this.updateIncidentLinks(nodeId);
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

    private updateIncidentLinks(nodeId: GraphMutationNodeId): void {
        const incidentLinks = this.linksByNodeId.get(nodeId);
        if (!incidentLinks?.size) {
            return;
        }

        for (const linkId of Array.from(incidentLinks)) {
            this.syncLinkView(linkId);
        }
    }

    private syncLinkView(
        linkId: GraphMutationLinkId,
        providedLink?: GraphMutationLinkLike,
        providedView?: LinkView
    ): void {
        const link = providedLink || this.linksById.get(linkId);
        const view = providedView || this.linkViews.get(linkId);
        if (!link || !view) {
            return;
        }

        const layout = this.nodePortAdapter.getLinkLayout(link);
        if (!layout) {
            view.update({
                path: "M 0 0 L 0 0",
                visible: false,
            });
            return;
        }

        view.update({
            path: this.nodePortAdapter.buildLinkPath(
                layout.start,
                layout.end,
                layout.startDir,
                layout.endDir
            ),
            stroke: (link.color as string) || "#9A9",
            visible: true,
        });
    }
}
