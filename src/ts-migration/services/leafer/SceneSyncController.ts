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

interface RuntimeAnimatedNode extends GraphMutationNodeLike {
    execute_triggered?: number;
    action_triggered?: number;
}

interface RuntimeAnimatedLink extends GraphMutationLinkLike {
    _last_time?: number;
    _pos?: Float32Array | [number, number];
    color?: unknown;
}

function toMutationKey(id: GraphMutationNodeId | GraphMutationLinkId): string {
    return String(id);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

interface RenderBoundsLike {
    x: number;
    y: number;
    width: number;
    height: number;
}

function toRenderBoundsLike(value: unknown): RenderBoundsLike | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const bounds = value as {
        x?: unknown;
        y?: unknown;
        width?: unknown;
        height?: unknown;
    };
    const x = toFiniteNumber(bounds.x);
    const y = toFiniteNumber(bounds.y);
    const width = Math.max(0, toFiniteNumber(bounds.width));
    const height = Math.max(0, toFiniteNumber(bounds.height));

    if (!width || !height) {
        return null;
    }

    return { x, y, width, height };
}

function mergeRenderBounds(
    first: RenderBoundsLike | null,
    second: RenderBoundsLike | null
): RenderBoundsLike | null {
    if (!first) {
        return second ? { ...second } : null;
    }
    if (!second) {
        return { ...first };
    }

    const left = Math.min(first.x, second.x);
    const top = Math.min(first.y, second.y);
    const right = Math.max(first.x + first.width, second.x + second.width);
    const bottom = Math.max(first.y + first.height, second.y + second.height);

    return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    };
}

function expandRenderBounds(
    bounds: RenderBoundsLike | null,
    padding = 6
): RenderBoundsLike | null {
    if (!bounds) {
        return null;
    }

    return {
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
    };
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
    private readonly activeLinkIds = new Set<GraphMutationLinkId>();
    private readonly pendingSettledNodeRepaints = new Set<GraphMutationNodeId>();
    private runtimeAnimationFrame: number | null = null;
    private readonly getViewportScale = (): number =>
        Math.max(
            1,
            toFiniteNumber(
                (
                    this.appHost.treeZoomLayer as {
                        scaleX?: unknown;
                    }
                ).scaleX,
                1
            )
        );

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

    requestRuntimeAnimation(forceNodeRepaint = false): void {
        let hasPendingNodeFrames =
            this.pendingSettledNodeRepaints.size > 0 ||
            this.hasAnyTransientNodeAnimation();
        if (forceNodeRepaint) {
            const activeNodeIds = this.captureActiveTransientNodeIds();
            this.repaintAllNodeHosts();
            hasPendingNodeFrames =
                this.syncPendingSettledNodeRepaints(activeNodeIds) ||
                this.pendingSettledNodeRepaints.size > 0;
        }

        this.collectActiveLinks();
        const linkRefresh = this.refreshActiveLinkAnimations();

        this.requestSceneRender();
        if (linkRefresh.hasMore || hasPendingNodeFrames) {
            this.ensureRuntimeAnimationFrame();
        }
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

    repaintAllLinkViews(): void {
        for (const [linkId, link] of this.linksById.entries()) {
            this.syncLinkView(linkId, link);
        }
    }

    syncNodeMoved(
        nodeId: GraphMutationNodeId,
        node?: GraphMutationNodeLike
    ): void {
        if (node) {
            this.nodesById.set(nodeId, node);
        }

        const previousBounds = this.captureNodeClusterBounds(nodeId);
        this.nodeHosts.get(nodeId)?.syncPosition();
        this.updateIncidentLinks(nodeId);
        const nextBounds = this.captureNodeClusterBounds(nodeId);
        this.requestSceneRender(mergeRenderBounds(previousBounds, nextBounds));
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
        this.cancelRuntimeAnimationFrame();
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
        this.activeLinkIds.clear();
        this.pendingSettledNodeRepaints.clear();
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
            this.renderHost,
            {
                view: this.appHost.view,
                getViewportScale: this.getViewportScale,
            }
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
        this.pendingSettledNodeRepaints.delete(nodeId);
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
            `litegraph-link-view:${toMutationKey(linkId)}`,
            {
                view: this.appHost.view,
                getViewportScale: this.getViewportScale,
            }
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
        this.activeLinkIds.delete(linkId);
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

        const previousBounds = this.captureNodeClusterBounds(nodeId);
        this.nodeHosts.get(nodeId)?.repaint();
        this.updateIncidentLinks(nodeId);
        const nextBounds = this.captureNodeClusterBounds(nodeId);
        this.requestSceneRender(mergeRenderBounds(previousBounds, nextBounds));
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

    private captureNodeClusterBounds(
        nodeId: GraphMutationNodeId
    ): RenderBoundsLike | null {
        const nodeHost = this.nodeHosts.get(nodeId);
        let clusterBounds = this.captureWorldRenderBounds(nodeHost?.root);

        const incidentLinks = this.linksByNodeId.get(nodeId);
        if (incidentLinks?.size) {
            for (const linkId of incidentLinks) {
                const linkView = this.linkViews.get(linkId);
                clusterBounds = mergeRenderBounds(
                    clusterBounds,
                    this.captureWorldRenderBounds(linkView?.view)
                );
            }
        }

        return expandRenderBounds(clusterBounds);
    }

    private captureWorldRenderBounds(
        target: { worldRenderBounds?: unknown } | null | undefined
    ): RenderBoundsLike | null {
        return toRenderBoundsLike(target?.worldRenderBounds);
    }

    private syncLinkView(
        linkId: GraphMutationLinkId,
        providedLink?: GraphMutationLinkLike,
        providedView?: LinkView,
        now = this.getRuntimeNow()
    ): boolean {
        const link = providedLink || this.linksById.get(linkId);
        const view = providedView || this.linkViews.get(linkId);
        if (!link || !view) {
            this.activeLinkIds.delete(linkId);
            return false;
        }

        const curve = this.nodePortAdapter.getLinkCurve(link);
        if (!curve) {
            view.update({
                curve: null,
                visible: false,
                flow: {
                    active: false,
                },
            });
            this.activeLinkIds.delete(linkId);
            return false;
        }

        const flow = this.buildLinkFlowPresentation(
            link as RuntimeAnimatedLink,
            curve,
            now
        );
        this.syncLinkMidpoint(link as RuntimeAnimatedLink, curve);
        view.update({
            curve,
            stroke: (link.color as string) || "#9A9",
            strokeWidth: 3,
            visible: true,
            flow,
        });

        if (flow.active) {
            this.activeLinkIds.add(linkId);
            return true;
        }

        this.activeLinkIds.delete(linkId);
        return false;
    }

    private getRuntimeWindow(): Window {
        return this.appHost.view.ownerDocument?.defaultView || window;
    }

    private getRuntimeNow(): number {
        const runtimeWindow = this.getRuntimeWindow() as Window & {
            performance?: { now?: () => number };
        };
        return runtimeWindow.performance?.now?.() ?? Date.now();
    }

    private requestSceneRender(bounds?: RenderBoundsLike | null): void {
        const partialBounds = toRenderBoundsLike(bounds);
        if (partialBounds) {
            this.appHost.app.forceRender(partialBounds);
            return;
        }

        if (typeof this.appHost.app.requestRender === "function") {
            this.appHost.app.requestRender();
            return;
        }

        this.appHost.app.forceRender();
    }

    private ensureRuntimeAnimationFrame(): void {
        if (this.runtimeAnimationFrame !== null) {
            return;
        }

        this.runtimeAnimationFrame = this.getRuntimeWindow().requestAnimationFrame(
            this.handleRuntimeAnimationFrame
        );
    }

    private cancelRuntimeAnimationFrame(): void {
        if (this.runtimeAnimationFrame === null) {
            return;
        }

        this.getRuntimeWindow().cancelAnimationFrame(this.runtimeAnimationFrame);
        this.runtimeAnimationFrame = null;
    }

    private readonly handleRuntimeAnimationFrame = (): void => {
        this.runtimeAnimationFrame = null;

        const nodeFrame = this.repaintAnimatedNodes();
        const linkFrame = this.refreshActiveLinkAnimations();
        if (nodeFrame.didUpdate || linkFrame.didUpdate) {
            this.requestSceneRender();
        }
        if (nodeFrame.hasMore || linkFrame.hasMore) {
            this.ensureRuntimeAnimationFrame();
        }
    };

    private repaintAnimatedNodes(): { didUpdate: boolean; hasMore: boolean } {
        let didUpdate = false;

        if (this.pendingSettledNodeRepaints.size) {
            const settledIds = Array.from(this.pendingSettledNodeRepaints);
            this.pendingSettledNodeRepaints.clear();
            for (let i = 0; i < settledIds.length; ++i) {
                this.repaintNodeHost(settledIds[i]);
                didUpdate = true;
            }
        }

        const activeNodeIds = this.captureActiveTransientNodeIds();
        if (activeNodeIds.length) {
            this.repaintNodeHosts(activeNodeIds);
            didUpdate = true;
        }

        return {
            didUpdate,
            hasMore:
                this.syncPendingSettledNodeRepaints(activeNodeIds) ||
                this.pendingSettledNodeRepaints.size > 0,
        };
    }

    private hasTransientNodeAnimation(node: GraphMutationNodeLike): boolean {
        const animatedNode = node as RuntimeAnimatedNode;
        return (
            toFiniteNumber(animatedNode.execute_triggered) > 0 ||
            toFiniteNumber(animatedNode.action_triggered) > 0
        );
    }

    private hasAnyTransientNodeAnimation(): boolean {
        for (const node of this.nodesById.values()) {
            if (this.hasTransientNodeAnimation(node)) {
                return true;
            }
        }

        return false;
    }

    private captureActiveTransientNodeIds(): GraphMutationNodeId[] {
        const activeNodeIds: GraphMutationNodeId[] = [];
        for (const [nodeId, node] of this.nodesById.entries()) {
            if (this.hasTransientNodeAnimation(node)) {
                activeNodeIds.push(nodeId);
            }
        }

        return activeNodeIds;
    }

    private syncPendingSettledNodeRepaints(
        activeNodeIds: readonly GraphMutationNodeId[]
    ): boolean {
        let hasMore = false;

        for (let i = 0; i < activeNodeIds.length; ++i) {
            const nodeId = activeNodeIds[i];
            const node = this.nodesById.get(nodeId);
            if (!node) {
                continue;
            }

            if (this.hasTransientNodeAnimation(node)) {
                hasMore = true;
                continue;
            }

            this.pendingSettledNodeRepaints.add(nodeId);
            hasMore = true;
        }

        return hasMore;
    }

    private collectActiveLinks(): void {
        const now = this.getRuntimeNow();
        for (const [linkId, link] of this.linksById.entries()) {
            if (this.isLinkFlowActive(link as RuntimeAnimatedLink, now)) {
                this.activeLinkIds.add(linkId);
            }
        }
    }

    private refreshActiveLinkAnimations(): {
        didUpdate: boolean;
        hasMore: boolean;
    } {
        if (!this.activeLinkIds.size) {
            return { didUpdate: false, hasMore: false };
        }

        const now = this.getRuntimeNow();
        let didUpdate = false;
        let hasActiveLinks = false;
        for (const linkId of Array.from(this.activeLinkIds)) {
            const wasTracked = this.activeLinkIds.has(linkId);
            const isActive = this.syncLinkView(linkId, undefined, undefined, now);
            if (wasTracked || isActive) {
                didUpdate = true;
            }
            if (isActive) {
                hasActiveLinks = true;
            }
        }

        return { didUpdate, hasMore: hasActiveLinks };
    }

    private isLinkFlowActive(link: RuntimeAnimatedLink, now: number): boolean {
        const lastTime = toFiniteNumber(link._last_time);
        return Boolean(lastTime) && now - lastTime < 1000;
    }

    private buildLinkFlowPresentation(
        link: RuntimeAnimatedLink,
        curve: ReturnType<NodePortAdapter["getLinkCurve"]> extends infer TResult
            ? Exclude<TResult, null>
            : never,
        now: number
    ): NonNullable<Parameters<LinkView["update"]>[0]["flow"]> {
        const lastTime = toFiniteNumber(link._last_time);
        if (!lastTime) {
            return { active: false };
        }

        const elapsed = now - lastTime;
        if (elapsed < 0 || elapsed >= 1000) {
            return { active: false };
        }

        const opacity = Math.max(0, Math.min(1, 2 - elapsed * 0.002));
        const dots = Array.from({ length: 5 }, (_, index) =>
            this.nodePortAdapter.getPointOnLinkCurve(
                curve,
                (now * 0.001 + index * 0.2) % 1
            )
        );

        return {
            active: true,
            color: "#FFF",
            opacity,
            dotRadius: 5,
            dots,
        };
    }

    private syncLinkMidpoint(
        link: RuntimeAnimatedLink,
        curve: Exclude<ReturnType<NodePortAdapter["getLinkCurve"]>, null>
    ): void {
        const midpoint = this.nodePortAdapter.getPointOnLinkCurve(curve, 0.5);
        const target = ArrayBuffer.isView(link._pos)
            ? link._pos
            : (link._pos = new Float32Array(2));

        target[0] = midpoint[0];
        target[1] = midpoint[1];
    }
}
