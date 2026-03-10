import type { LeaferAppHost } from "./LeaferAppHost";
import {
    GraphMutationBus,
    type GraphMutationGraphLike,
    type GraphMutationGroupLike,
    type GraphMutationLinkId,
    type GraphMutationLinkLike,
    type GraphMutationNodeId,
    type GraphMutationNodeLike,
} from "./GraphMutationBus";
import { GraphGroupHost } from "./GraphGroupHost";
import { LegacyNodeHost } from "./LegacyNodeHost";
import type { LegacyNodeRenderHost } from "./LegacyNodePainter";
import type {
    LeaferActiveLinkPresentationResult,
    LeaferActiveLinkPresentationTask,
} from "./LeaferTaskWorker";
import { LinkViewHost } from "./LinkViewHost";
import { ModernNodeHost, type ModernNodeLike } from "./ModernNodeHost";
import { discriminateNodeRuntime } from "./NodeRuntimeDiscriminator";
import {
    NodePortAdapter,
    type LinkCurveGeometry,
    type NodePortNodeLike,
} from "./NodePortAdapter";
import type { NodeViewHost } from "./NodeViewHost";
import type { IArrowStyle } from "@leafer-ui/interface";

export type NodeHost = NodeViewHost;
export type LinkView = LinkViewHost;
export type GroupHost = GraphGroupHost;
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

interface GraphCanvasLinkPresentationLike {
    render_connection_arrows?: unknown;
    connections_width?: unknown;
    default_link_color?: unknown;
}

interface CachedLinkGeometry {
    readonly curve: LinkCurveGeometry;
}

interface ActiveLinkPresentationState {
    readonly task: LeaferActiveLinkPresentationTask;
    readonly layoutKey: string;
    readonly cacheKey: string;
}

interface PendingActiveLinkPresentationRequest {
    readonly now: number;
    readonly tasks: ReadonlyArray<LeaferActiveLinkPresentationTask>;
}

interface DeferredNodeDirtySignal {
    readonly nodeId: GraphMutationNodeId;
    readonly node?: GraphMutationNodeLike;
    readonly dirtyForeground: boolean;
    readonly dirtyBackground: boolean;
}

interface LeaferRuntimeVisualSchedulerLike {
    nextRender: (item: () => void, bind?: object, off?: "off") => void;
    removeNextRender?: (item: () => void) => void;
    requestRender?: (change?: boolean) => void;
}

interface EnsureNodeHostOptions {
    readonly syncPosition?: boolean;
    readonly repaint?: boolean;
    readonly updateLinks?: boolean;
}

interface EnsureGroupHostOptions {
    readonly repaint?: boolean;
}

function toMutationKey(id: GraphMutationNodeId | GraphMutationLinkId): string {
    return String(id);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function formatWorkerPoint(point: readonly [number, number]): string {
    return `${point[0]},${point[1]}`;
}

function buildActiveLinkLayoutKey(task: LeaferActiveLinkPresentationTask): string {
    return [
        String(task.linkId),
        formatWorkerPoint(task.start),
        formatWorkerPoint(task.end),
        toFiniteNumber(task.startDir),
        toFiniteNumber(task.endDir),
    ].join("|");
}

function buildActiveLinkPresentationCacheKey(
    task: LeaferActiveLinkPresentationTask
): string {
    const lastTimeBucket = Math.max(
        0,
        Math.floor(toFiniteNumber(task.lastTime) / ACTIVE_LINK_CACHE_BUCKET_MS)
    );
    return `${buildActiveLinkLayoutKey(task)}|${lastTimeBucket}`;
}

const ACTIVE_LINK_WINDOW_MS = 180;
const ACTIVE_LINK_OPACITY_BUCKETS = 6;
const ACTIVE_LINK_CACHE_BUCKET_MS = Math.max(
    1,
    Math.floor(ACTIVE_LINK_WINDOW_MS / ACTIVE_LINK_OPACITY_BUCKETS)
);

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function quantizeActiveLinkOpacity(value: number): number {
    if (!(value > 0)) {
        return 0;
    }

    return (
        Math.round(clamp01(value) * ACTIVE_LINK_OPACITY_BUCKETS) /
        ACTIVE_LINK_OPACITY_BUCKETS
    );
}

function resolveActiveLinkOpacity(lastTime: number, now: number): number {
    const elapsed = now - lastTime;
    if (elapsed < 0 || elapsed >= ACTIVE_LINK_WINDOW_MS) {
        return 0;
    }

    return quantizeActiveLinkOpacity(1 - elapsed / ACTIVE_LINK_WINDOW_MS);
}

interface RenderBoundsLike {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface AnimationRefreshResult {
    didUpdate: boolean;
    hasMore: boolean;
    dirtyBounds: RenderBoundsLike | null;
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
    readonly groupHosts = new Map<GraphMutationGroupLike, GroupHost>();
    readonly linkViews = new Map<GraphMutationLinkId, LinkView>();
    readonly linksByNodeId = new Map<GraphMutationNodeId, Set<GraphMutationLinkId>>();
    readonly nodePortAdapter: NodePortAdapter;

    private readonly unsubscribers: Array<() => void> = [];
    private readonly nodesById = new Map<GraphMutationNodeId, GraphMutationNodeLike>();
    private readonly linksById = new Map<GraphMutationLinkId, GraphMutationLinkLike>();
    private readonly linkIdsByKey = new Map<string, GraphMutationLinkId>();
    private readonly dirtyBridgeUninstallers = new Map<
        GraphMutationNodeId,
        () => void
    >();
    private readonly groupDirtyBridgeUninstallers = new Map<
        GraphMutationGroupLike,
        () => void
    >();
    private readonly deferredNodeDirtySignalsByKey = new Map<
        string,
        DeferredNodeDirtySignal
    >();
    private readonly activeTransientNodeIds = new Set<GraphMutationNodeId>();
    private readonly activeLinkIds = new Set<GraphMutationLinkId>();
    private readonly dirtyRuntimeLinkIds = new Set<GraphMutationLinkId>();
    private readonly linkGeometryCache = new Map<
        GraphMutationLinkId,
        CachedLinkGeometry
    >();
    private readonly activeLinkPresentationStateById = new Map<
        GraphMutationLinkId,
        ActiveLinkPresentationState
    >();
    private readonly workerLinkPresentationById = new Map<
        string,
        LeaferActiveLinkPresentationResult
    >();
    private activeLinkPresentationRequestInFlight = false;
    private pendingActiveLinkPresentationRequest: PendingActiveLinkPresentationRequest | null =
        null;
    private lastHandledActiveLinkPresentationRequestId = 0;
    private readonly pendingSettledNodeRepaints = new Set<GraphMutationNodeId>();
    private readonly pendingRuntimeDirtyNodeIds = new Map<
        string,
        GraphMutationNodeId
    >();
    private readonly pendingRuntimeDirtyLinkIds = new Map<
        string,
        GraphMutationLinkId
    >();
    private pendingRuntimeDirtyBounds: RenderBoundsLike | null = null;
    private pendingRuntimeForceNodeRepaint = false;
    private pendingRuntimeRepaintAllNodes = false;
    private runtimeVisualFrameHandle: number | null = null;
    private runtimeVisualFrameScheduled = false;
    private runtimeVisualFrameDriver: "none" | "leafer" | "raf" = "none";
    private runtimeFlushEnqueueCount = 0;
    private runtimeVisualFrameCount = 0;
    private runtimeSceneRenderCount = 0;
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
        this.appHost.taskWorker.onActiveLinkPresentation(
            this.handleActiveLinkPresentationResult
        );

        this.unsubscribers.push(
            this.bus.on("graph:clear", () => {
                this.clearScene();
            }),
            this.bus.on("graph:hydrate", ({ sceneAlreadyCleared }) => {
                if (sceneAlreadyCleared) {
                    this.hydrateFromGraph();
                    this.requestSceneRender();
                    return;
                }
                this.resyncFromGraph();
            }),
            this.bus.on("node:add", ({ node }) => {
                this.ensureNodeHost(node);
            }),
            this.bus.on("node:remove", ({ nodeId }) => {
                this.removeNodeHost(nodeId);
            }),
            this.bus.on(
                "node:dirty",
                ({ nodeId, node, dirtyForeground, dirtyBackground }) => {
                    this.handleNodeDirty(
                        nodeId,
                        node,
                        dirtyForeground,
                        dirtyBackground
                    );
                }
            ),
            this.bus.on("node:moved", ({ nodeId, node }) => {
                this.syncNodeMoved(nodeId, node);
            }),
            this.bus.on("group:add", ({ group }) => {
                this.ensureGroupHost(group);
            }),
            this.bus.on("group:remove", ({ group }) => {
                this.removeGroupHost(group);
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
        this.appHost.taskWorker.onActiveLinkPresentation(null);
        this.clearScene();
    }

    cancelPendingRuntimeVisualFrame(): void {
        this.cancelRuntimeVisualFrame();
        this.pendingRuntimeDirtyNodeIds.clear();
        this.pendingRuntimeDirtyLinkIds.clear();
        this.pendingRuntimeDirtyBounds = null;
        this.pendingRuntimeForceNodeRepaint = false;
        this.pendingRuntimeRepaintAllNodes = false;
    }

    requestRuntimeAnimation(
        forceNodeRepaint = false,
        nodeIds?: readonly GraphMutationNodeId[],
        linkIds?: readonly GraphMutationLinkId[]
    ): void {
        this.queuePendingRuntimeNodeIds(nodeIds);
        this.queuePendingRuntimeLinkIds(linkIds);

        if (forceNodeRepaint) {
            this.pendingRuntimeForceNodeRepaint = true;
            if (!nodeIds?.length) {
                this.pendingRuntimeRepaintAllNodes = true;
            }
        }

        if (!this.hasPendingRuntimeVisualWork()) {
            return;
        }

        this.runtimeFlushEnqueueCount += 1;
        this.ensureRuntimeVisualFrame();
    }

    flushDeferredNodeDirtySignals(requestRender = true): GraphMutationNodeId[] {
        if (!this.deferredNodeDirtySignalsByKey.size) {
            return [];
        }

        const pendingSignals = Array.from(this.deferredNodeDirtySignalsByKey.values());
        this.deferredNodeDirtySignalsByKey.clear();

        let dirtyBounds: RenderBoundsLike | null = null;
        const processedNodeIds: GraphMutationNodeId[] = [];
        for (let i = 0; i < pendingSignals.length; ++i) {
            const pendingSignal = pendingSignals[i];
            processedNodeIds.push(pendingSignal.nodeId);
            dirtyBounds = mergeRenderBounds(
                dirtyBounds,
                this.processNodeDirty(
                    pendingSignal.nodeId,
                    pendingSignal.node,
                    pendingSignal.dirtyForeground,
                    pendingSignal.dirtyBackground
                )
            );
        }

        if (dirtyBounds && requestRender) {
            this.requestSceneRender(dirtyBounds);
        } else if (dirtyBounds) {
            this.pendingRuntimeDirtyBounds = mergeRenderBounds(
                this.pendingRuntimeDirtyBounds,
                dirtyBounds
            );
        }
        return processedNodeIds;
    }

    repaintNodeHost(
        nodeId: GraphMutationNodeId,
        syncIncidentLinks = true
    ): void {
        this.nodeHosts.get(nodeId)?.repaint();
        if (syncIncidentLinks) {
            this.updateIncidentLinks(nodeId);
        }
    }

    repaintNodeHosts(
        nodeIds: readonly GraphMutationNodeId[],
        syncIncidentLinks = true
    ): void {
        for (let i = 0; i < nodeIds.length; ++i) {
            this.repaintNodeHost(nodeIds[i], syncIncidentLinks);
        }
    }

    repaintAllNodeHosts(syncIncidentLinks = true): void {
        for (const [nodeId, host] of this.nodeHosts.entries()) {
            host.repaint();
            if (syncIncidentLinks) {
                this.updateIncidentLinks(nodeId);
            }
        }
    }

    private repaintAllNodeHostsWithBounds(
        syncIncidentLinks = true
    ): RenderBoundsLike | null {
        let dirtyBounds: RenderBoundsLike | null = null;
        for (const nodeId of this.nodeHosts.keys()) {
            dirtyBounds = mergeRenderBounds(
                dirtyBounds,
                this.repaintNodeHostWithBounds(nodeId, syncIncidentLinks)
            );
        }
        return dirtyBounds;
    }

    private repaintRuntimeNodeHostsWithBounds(
        nodeIds: readonly GraphMutationNodeId[]
    ): RenderBoundsLike | null {
        let dirtyBounds: RenderBoundsLike | null = null;
        for (let i = 0; i < nodeIds.length; ++i) {
            dirtyBounds = mergeRenderBounds(
                dirtyBounds,
                this.repaintRuntimeNodeHostWithBounds(nodeIds[i])
            );
        }
        return dirtyBounds;
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

    repaintGroupHost(group: GraphMutationGroupLike): void {
        this.ensureGroupHost(group).repaint();
    }

    syncGroupChanged(
        group: GraphMutationGroupLike,
        movedNodeIds: readonly GraphMutationNodeId[] = []
    ): void {
        const groupHost = this.ensureGroupHost(group);
        let dirtyBounds: RenderBoundsLike | null = groupHost.captureRenderBounds();

        for (let i = 0; i < movedNodeIds.length; ++i) {
            dirtyBounds = mergeRenderBounds(
                dirtyBounds,
                this.captureNodeClusterBounds(movedNodeIds[i])
            );
        }

        groupHost.repaint();

        for (let i = 0; i < movedNodeIds.length; ++i) {
            const nodeId = movedNodeIds[i];
            this.nodeHosts.get(nodeId)?.syncPosition();
            this.updateIncidentLinks(nodeId);
            dirtyBounds = mergeRenderBounds(
                dirtyBounds,
                this.captureNodeClusterBounds(nodeId)
            );
        }

        dirtyBounds = mergeRenderBounds(dirtyBounds, groupHost.captureRenderBounds());
        this.requestSceneRender(dirtyBounds);
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
        const existingGroups = Array.isArray(this.graph._groups)
            ? this.graph._groups
            : [];
        const hydratedGroupHosts: GroupHost[] = [];
        for (let i = 0; i < existingGroups.length; ++i) {
            hydratedGroupHosts.push(
                this.ensureGroupHost(existingGroups[i], {
                    repaint: false,
                })
            );
        }

        const existingNodes = Array.isArray(this.graph._nodes)
            ? this.graph._nodes
            : [];
        for (let i = 0; i < existingNodes.length; ++i) {
            this.ensureNodeHost(existingNodes[i], {
                updateLinks: false,
                repaint: false,
            });
        }

        for (const [linkId, link] of Object.entries(this.graph.links || {})) {
            this.ensureLinkView(linkId, link);
        }

        for (let i = 0; i < hydratedGroupHosts.length; ++i) {
            hydratedGroupHosts[i].repaint();
        }
        this.repaintAllNodeHosts(false);
    }

    private resyncFromGraph(): void {
        this.clearScene();
        this.hydrateFromGraph();
        this.requestSceneRender();
    }

    private clearScene(): void {
        this.cancelPendingRuntimeVisualFrame();
        for (const host of this.nodeHosts.values()) {
            host.destroy();
        }
        for (const host of this.groupHosts.values()) {
            host.destroy();
        }
        for (const view of this.linkViews.values()) {
            view.destroy();
        }
        for (const uninstall of this.dirtyBridgeUninstallers.values()) {
            uninstall();
        }
        for (const uninstall of this.groupDirtyBridgeUninstallers.values()) {
            uninstall();
        }

        this.nodeHosts.clear();
        this.groupHosts.clear();
        this.linkViews.clear();
        this.linksByNodeId.clear();
        this.nodesById.clear();
        this.linksById.clear();
        this.linkIdsByKey.clear();
        this.dirtyBridgeUninstallers.clear();
        this.groupDirtyBridgeUninstallers.clear();
        this.activeLinkIds.clear();
        this.linkGeometryCache.clear();
        this.activeLinkPresentationStateById.clear();
        this.workerLinkPresentationById.clear();
        this.activeLinkPresentationRequestInFlight = false;
        this.pendingActiveLinkPresentationRequest = null;
        this.lastHandledActiveLinkPresentationRequestId = 0;
        this.activeTransientNodeIds.clear();
        this.pendingSettledNodeRepaints.clear();
        this.deferredNodeDirtySignalsByKey.clear();
        this.dirtyRuntimeLinkIds.clear();
        this.runtimeFlushEnqueueCount = 0;
        this.runtimeVisualFrameCount = 0;
        this.runtimeSceneRenderCount = 0;
    }

    private ensureNodeHost(
        node: GraphMutationNodeLike,
        options?: EnsureNodeHostOptions
    ): NodeHost {
        const nodeId = node.id;
        const runtime = discriminateNodeRuntime(node);
        const existingHost = this.nodeHosts.get(nodeId);
        const shouldSyncPosition = options?.syncPosition !== false;
        const shouldRepaint = options?.repaint !== false;
        const shouldUpdateLinks = options?.updateLinks !== false;

        this.nodesById.set(nodeId, node);
        this.syncTransientNodeTracking(nodeId, node);
        this.ensureTrackedNodeId(nodeId);
        this.installNodeDirtyBridge(node);

        if (existingHost && existingHost.runtime === runtime) {
            if (shouldSyncPosition) {
                existingHost.syncPosition();
            }
            if (shouldUpdateLinks) {
                this.updateIncidentLinks(nodeId);
            }
            return existingHost;
        }

        if (existingHost) {
            existingHost.destroy();
            this.nodeHosts.delete(nodeId);
        }

        const nodeHost = this.createNodeHost(runtime, node);
        this.nodeHosts.set(nodeId, nodeHost);
        if (shouldSyncPosition) {
            nodeHost.syncPosition();
        }
        if (shouldRepaint) {
            nodeHost.repaint();
        }
        if (shouldUpdateLinks) {
            this.updateIncidentLinks(nodeId);
        }

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

    private ensureGroupHost(
        group: GraphMutationGroupLike,
        options?: EnsureGroupHostOptions
    ): GroupHost {
        const shouldRepaint = options?.repaint !== false;
        const existingHost = this.groupHosts.get(group);
        if (existingHost) {
            this.installGroupDirtyBridge(group);
            if (shouldRepaint) {
                existingHost.repaint();
            }
            return existingHost;
        }

        const groupHost = new GraphGroupHost(group);
        this.groupHosts.set(group, groupHost);
        this.installGroupDirtyBridge(group);
        this.appHost.groupLayer.add(groupHost.root);
        if (shouldRepaint) {
            groupHost.repaint();
            this.requestSceneRender(groupHost.captureRenderBounds());
        }
        return groupHost;
    }

    private removeGroupHost(group: GraphMutationGroupLike): void {
        const groupHost = this.groupHosts.get(group);
        const previousBounds = groupHost?.captureRenderBounds() || null;
        groupHost?.destroy();
        this.groupHosts.delete(group);
        this.groupDirtyBridgeUninstallers.get(group)?.();
        this.groupDirtyBridgeUninstallers.delete(group);
        this.requestSceneRender(previousBounds);
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
        this.activeTransientNodeIds.delete(nodeId);
        this.pendingSettledNodeRepaints.delete(nodeId);
    }

    private ensureLinkView(
        linkId: GraphMutationLinkId,
        link: GraphMutationLinkLike
    ): LinkView {
        const existingView = this.linkViews.get(linkId);
        if (existingView) {
            this.linkIdsByKey.set(toMutationKey(linkId), linkId);
            this.linksById.set(linkId, link);
            this.syncLinkView(linkId, link, existingView);
            return existingView;
        }

        const originNode = this.findGraphNode(link.origin_id);
        const targetNode = this.findGraphNode(link.target_id);
        if (originNode) {
            if (!this.nodeHosts.has(link.origin_id)) {
                this.ensureNodeHost(originNode, {
                    updateLinks: false,
                });
            }
        } else {
            this.ensureTrackedNodeId(link.origin_id);
        }
        if (targetNode) {
            if (!this.nodeHosts.has(link.target_id)) {
                this.ensureNodeHost(targetNode, {
                    updateLinks: false,
                });
            }
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
        this.linkIdsByKey.set(toMutationKey(linkId), linkId);
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
        this.linkIdsByKey.delete(toMutationKey(linkId));
        this.activeLinkIds.delete(linkId);
        this.dirtyRuntimeLinkIds.delete(linkId);
        this.linkGeometryCache.delete(linkId);
        this.activeLinkPresentationStateById.delete(linkId);
        this.workerLinkPresentationById.delete(toMutationKey(linkId));
        if (!resolvedLink) {
            return;
        }

        this.linksByNodeId.get(resolvedLink.origin_id)?.delete(linkId);
        this.linksByNodeId.get(resolvedLink.target_id)?.delete(linkId);
    }

    private handleNodeDirty(
        nodeId: GraphMutationNodeId,
        node?: GraphMutationNodeLike,
        dirtyForeground?: boolean,
        dirtyBackground?: boolean
    ): void {
        const dirtyBounds = this.processNodeDirty(
            nodeId,
            node,
            dirtyForeground,
            dirtyBackground
        );
        if (dirtyBounds) {
            this.requestSceneRender(dirtyBounds);
        }
    }

    private processNodeDirty(
        nodeId: GraphMutationNodeId,
        node?: GraphMutationNodeLike,
        dirtyForeground?: boolean,
        dirtyBackground?: boolean
    ): RenderBoundsLike | null {
        if (node) {
            this.nodesById.set(nodeId, node);
            this.syncTransientNodeTracking(nodeId, node);
        }

        const fastPathBounds = this.tryHandleModernForegroundDirtyFastPath(
            nodeId,
            dirtyForeground,
            dirtyBackground
        );
        if (fastPathBounds) {
            return fastPathBounds;
        }

        const previousBounds = this.captureNodeClusterBounds(nodeId);
        this.nodeHosts.get(nodeId)?.repaint();
        if (!(dirtyForeground === true && dirtyBackground !== true)) {
            this.updateIncidentLinks(nodeId);
        }
        const nextBounds = this.captureNodeClusterBounds(nodeId);
        return mergeRenderBounds(previousBounds, nextBounds);
    }

    private tryHandleModernForegroundDirtyFastPath(
        nodeId: GraphMutationNodeId,
        dirtyForeground?: boolean,
        dirtyBackground?: boolean
    ): RenderBoundsLike | null {
        if (!(dirtyForeground === true && dirtyBackground !== true)) {
            return null;
        }

        const host = this.nodeHosts.get(nodeId);
        if (!(host instanceof ModernNodeHost)) {
            return null;
        }

        if (!host.repaintForegroundState()) {
            return null;
        }

        return expandRenderBounds(this.captureWorldRenderBounds(host.root));
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
            if (
                this.deferNodeDirtySignal(
                    node.id,
                    node,
                    dirtyForeground,
                    dirtyBackground
                )
            ) {
                return;
            }
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

    private deferNodeDirtySignal(
        nodeId: GraphMutationNodeId,
        node: GraphMutationNodeLike,
        dirtyForeground: boolean,
        dirtyBackground?: boolean
    ): boolean {
        if (!this.isExecutionPhaseActive()) {
            return false;
        }

        const key = toMutationKey(nodeId);
        const previousSignal = this.deferredNodeDirtySignalsByKey.get(key);
        this.deferredNodeDirtySignalsByKey.set(key, {
            nodeId,
            node,
            dirtyForeground:
                dirtyForeground ||
                Boolean(previousSignal?.dirtyForeground),
            dirtyBackground:
                Boolean(dirtyBackground) ||
                Boolean(previousSignal?.dirtyBackground),
        });
        return true;
    }

    private isExecutionPhaseActive(): boolean {
        return (
            toFiniteNumber(
                (
                    this.graph as GraphMutationGraphLike & {
                        execution_phase_depth?: unknown;
                    }
                ).execution_phase_depth
            ) > 0
        );
    }

    private installGroupDirtyBridge(group: GraphMutationGroupLike): void {
        if (this.groupDirtyBridgeUninstallers.has(group)) {
            return;
        }

        const hadOwnProperty = Object.prototype.hasOwnProperty.call(
            group,
            "setDirtyCanvas"
        );
        const ownSetDirtyCanvas = group.setDirtyCanvas;

        group.setDirtyCanvas = (
            _dirtyForeground: boolean,
            _dirtyBackground?: boolean
        ): void => {
            const groupHost = this.groupHosts.get(group);
            const previousBounds = groupHost?.captureRenderBounds() || null;
            this.ensureGroupHost(group).repaint();

            const nextBounds =
                this.groupHosts.get(group)?.captureRenderBounds() || null;
            this.requestSceneRender(
                mergeRenderBounds(previousBounds, nextBounds)
            );
        };

        this.groupDirtyBridgeUninstallers.set(group, () => {
            delete group.setDirtyCanvas;
            if (hadOwnProperty) {
                group.setDirtyCanvas = ownSetDirtyCanvas;
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

        for (const linkId of incidentLinks) {
            this.syncLinkView(linkId);
        }
    }

    private repaintNodeHostWithBounds(
        nodeId: GraphMutationNodeId,
        syncIncidentLinks = true
    ): RenderBoundsLike | null {
        const previousBounds = this.captureNodeClusterBounds(nodeId);
        this.repaintNodeHost(nodeId, syncIncidentLinks);
        const nextBounds = this.captureNodeClusterBounds(nodeId);
        return mergeRenderBounds(previousBounds, nextBounds);
    }

    private repaintRuntimeNodeHostWithBounds(
        nodeId: GraphMutationNodeId
    ): RenderBoundsLike | null {
        const host = this.nodeHosts.get(nodeId);
        if (!host) {
            return null;
        }

        if (host instanceof ModernNodeHost) {
            if (!host.repaintForegroundState()) {
                host.repaint();
            }
        } else {
            host.repaint();
        }

        return expandRenderBounds(this.captureWorldRenderBounds(host.root));
    }

    private resolveRuntimeRepaintNodeIds(
        nodeIds?: readonly GraphMutationNodeId[]
    ): GraphMutationNodeId[] | null {
        if (!nodeIds) {
            return null;
        }

        const resolved: GraphMutationNodeId[] = [];
        const seen = new Set<string>();
        for (let i = 0; i < nodeIds.length; ++i) {
            const nodeId = nodeIds[i];
            const key = toMutationKey(nodeId);
            if (seen.has(key) || !this.nodeHosts.has(nodeId)) {
                continue;
            }

            seen.add(key);
            resolved.push(nodeId);
        }

        return resolved;
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

    private captureLinkRenderBounds(
        linkId: GraphMutationLinkId
    ): RenderBoundsLike | null {
        const linkView = this.linkViews.get(linkId);
        return expandRenderBounds(this.captureWorldRenderBounds(linkView?.view));
    }

    private syncLinkView(
        linkId: GraphMutationLinkId,
        providedLink?: GraphMutationLinkLike,
        providedView?: LinkView,
        now = this.getRuntimeNow(),
        preferCachedCurve = false
    ): boolean {
        const link = providedLink || this.linksById.get(linkId);
        const view = providedView || this.linkViews.get(linkId);
        if (!link || !view) {
            this.activeLinkIds.delete(linkId);
            this.linkGeometryCache.delete(linkId);
            this.activeLinkPresentationStateById.delete(linkId);
            this.workerLinkPresentationById.delete(toMutationKey(linkId));
            return false;
        }

        const workerPresentation =
            preferCachedCurve && this.isLinkFlowActive(link as RuntimeAnimatedLink, now)
                ? this.resolveWorkerLinkPresentation(
                      linkId,
                      link as RuntimeAnimatedLink,
                      now
                  )
                : null;
        const { curve, reused } = workerPresentation
            ? {
                  curve: workerPresentation.curve as LinkCurveGeometry,
                  reused: true,
              }
            : this.resolveLinkCurve(linkId, link, preferCachedCurve);
        if (!curve) {
            view.update({
                curve: null,
                visible: false,
                flow: {
                    active: false,
                },
            });
            this.activeLinkIds.delete(linkId);
            this.linkGeometryCache.delete(linkId);
            this.activeLinkPresentationStateById.delete(linkId);
            this.workerLinkPresentationById.delete(toMutationKey(linkId));
            return false;
        }

        const flow = workerPresentation
            ? this.buildWorkerLinkFlowPresentation(workerPresentation)
            : this.buildLinkFlowPresentation(
                  linkId,
                  link as RuntimeAnimatedLink,
                  now
              );
        const strokeWidth = this.getLinkStrokeWidth();
        const arrows = this.buildLinkArrowPresentation(curve);
        if (workerPresentation) {
            this.syncLinkMidpointToPoint(
                link as RuntimeAnimatedLink,
                workerPresentation.midpoint
            );
        } else if (!reused) {
            this.syncLinkMidpoint(link as RuntimeAnimatedLink, curve);
        }
        view.update({
            curve,
            stroke: this.getLinkStroke(link as RuntimeAnimatedLink),
            strokeWidth,
            visible: true,
            ...arrows,
            flow,
        });

        if (flow.active) {
            this.activeLinkIds.add(linkId);
            return true;
        }

        this.activeLinkIds.delete(linkId);
        this.workerLinkPresentationById.delete(toMutationKey(linkId));
        return false;
    }

    private getPrimaryCanvasLinkPresentation():
        | GraphCanvasLinkPresentationLike
        | null {
        const graph = this.graph as GraphMutationGraphLike & {
            list_of_graphcanvas?: GraphCanvasLinkPresentationLike[] | null;
        };
        const canvasList = graph.list_of_graphcanvas;
        return canvasList?.length ? canvasList[0] : null;
    }

    private getLinkStrokeWidth(): number {
        const canvas = this.getPrimaryCanvasLinkPresentation();
        return Math.max(1, toFiniteNumber(canvas?.connections_width, 3));
    }

    private getLinkStroke(link: RuntimeAnimatedLink): string {
        if (typeof link.color === "string" && link.color) {
            return link.color;
        }
        const canvas = this.getPrimaryCanvasLinkPresentation();
        if (
            canvas &&
            typeof canvas.default_link_color === "string" &&
            canvas.default_link_color
        ) {
            return canvas.default_link_color;
        }
        return "#9A9";
    }

    private buildLinkArrowPresentation(curve: LinkCurveGeometry): {
        startArrow: IArrowStyle | "none";
        endArrow: IArrowStyle | "none";
    } {
        const canvas = this.getPrimaryCanvasLinkPresentation();
        const renderArrows = Boolean(canvas?.render_connection_arrows);
        if (!renderArrows || this.getViewportScale() < 0.6) {
            return {
                startArrow: "none",
                endArrow: "none",
            };
        }

        return {
            startArrow: "none",
            endArrow: curve.endDir ? "angle" : "none",
        };
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

    private ensureRuntimeVisualFrame(): void {
        if (this.runtimeVisualFrameScheduled || !this.hasPendingRuntimeVisualWork()) {
            return;
        }

        const leaferApp = this.resolveRuntimeVisualScheduler();
        this.runtimeVisualFrameScheduled = true;
        if (leaferApp) {
            this.runtimeVisualFrameDriver = "leafer";
            leaferApp.nextRender(this.handleRuntimeVisualFrame, this);
            leaferApp.requestRender?.();
            return;
        }

        this.runtimeVisualFrameDriver = "raf";
        this.runtimeVisualFrameHandle = this.getRuntimeWindow().requestAnimationFrame(
            this.handleRuntimeVisualFrame
        );
    }

    private cancelRuntimeVisualFrame(): void {
        if (!this.runtimeVisualFrameScheduled) {
            return;
        }

        if (this.runtimeVisualFrameDriver === "leafer") {
            const leaferApp = this.resolveRuntimeVisualScheduler();
            if (leaferApp) {
                if (typeof leaferApp.removeNextRender === "function") {
                    leaferApp.removeNextRender(this.handleRuntimeVisualFrame);
                } else {
                    leaferApp.nextRender(this.handleRuntimeVisualFrame, this, "off");
                }
            }
        } else if (
            this.runtimeVisualFrameDriver === "raf" &&
            this.runtimeVisualFrameHandle !== null
        ) {
            this.getRuntimeWindow().cancelAnimationFrame(
                this.runtimeVisualFrameHandle
            );
        }

        this.runtimeVisualFrameHandle = null;
        this.runtimeVisualFrameDriver = "none";
        this.runtimeVisualFrameScheduled = false;
    }

    private readonly handleRuntimeVisualFrame = (): void => {
        this.runtimeVisualFrameHandle = null;
        this.runtimeVisualFrameDriver = "none";
        this.runtimeVisualFrameScheduled = false;
        this.runtimeVisualFrameCount += 1;

        let dirtyBounds = this.consumePendingRuntimeDirtyBounds();
        let didUpdate = Boolean(dirtyBounds);
        const pendingNodeIds = this.consumePendingRuntimeNodeIds();
        const pendingLinkIds = this.consumePendingRuntimeLinkIds();
        const forceNodeRepaint = this.pendingRuntimeForceNodeRepaint;
        const repaintAllNodes = this.pendingRuntimeRepaintAllNodes;
        this.pendingRuntimeForceNodeRepaint = false;
        this.pendingRuntimeRepaintAllNodes = false;

        let freshNodeIds: readonly GraphMutationNodeId[] | undefined;
        if (forceNodeRepaint) {
            const repaintNodeIds = repaintAllNodes
                ? null
                : this.resolveRuntimeRepaintNodeIds(pendingNodeIds);
            if (repaintNodeIds?.length) {
                freshNodeIds = repaintNodeIds;
                this.syncTransientNodeTrackingFor(repaintNodeIds);
            }
            dirtyBounds = mergeRenderBounds(
                dirtyBounds,
                repaintNodeIds
                    ? this.repaintRuntimeNodeHostsWithBounds(repaintNodeIds)
                    : this.repaintAllNodeHostsWithBounds(false)
            );
            didUpdate = true;
        } else if (pendingNodeIds.length) {
            this.syncTransientNodeTrackingFor(pendingNodeIds);
        }

        if (pendingLinkIds.length) {
            this.queueDirtyRuntimeLinkIds(pendingLinkIds);
        }

        const nodeFrame = this.repaintAnimatedNodes(freshNodeIds);
        const linkFrame = this.refreshActiveLinkAnimations();
        dirtyBounds = mergeRenderBounds(
            dirtyBounds,
            mergeRenderBounds(nodeFrame.dirtyBounds, linkFrame.dirtyBounds)
        );
        const shouldRender = Boolean(dirtyBounds);
        if (shouldRender) {
            this.runtimeSceneRenderCount += 1;
            this.requestSceneRender(dirtyBounds);
        } else if (didUpdate || nodeFrame.didUpdate || linkFrame.didUpdate) {
            this.runtimeSceneRenderCount += 1;
            this.requestSceneRender();
        }
        if (
            nodeFrame.hasMore ||
            linkFrame.hasMore ||
            this.hasPendingRuntimeVisualWork()
        ) {
            this.ensureRuntimeVisualFrame();
        }
    };

    private repaintAnimatedNodes(
        skipNodeIds?: readonly GraphMutationNodeId[]
    ): AnimationRefreshResult {
        const skipNodeKeys =
            skipNodeIds && skipNodeIds.length
                ? new Set(skipNodeIds.map(toMutationKey))
                : null;
        let didUpdate = false;
        let dirtyBounds: RenderBoundsLike | null = null;

        if (this.pendingSettledNodeRepaints.size) {
            const settledIds = Array.from(this.pendingSettledNodeRepaints);
            this.pendingSettledNodeRepaints.clear();
            for (let i = 0; i < settledIds.length; ++i) {
                dirtyBounds = mergeRenderBounds(
                    dirtyBounds,
                    this.repaintRuntimeNodeHostWithBounds(settledIds[i])
                );
                didUpdate = true;
            }
        }

        const activeNodeIds = this.captureTrackedTransientNodeIds(skipNodeKeys);
        if (activeNodeIds.length) {
            for (let i = 0; i < activeNodeIds.length; ++i) {
                dirtyBounds = mergeRenderBounds(
                    dirtyBounds,
                    this.repaintRuntimeNodeHostWithBounds(activeNodeIds[i])
                );
            }
            this.decayTransientNodeAnimations(activeNodeIds);
            this.syncTransientNodeTrackingFor(activeNodeIds);
            didUpdate = true;
        }

        return {
            didUpdate,
            dirtyBounds,
            hasMore:
                this.syncPendingSettledNodeRepaints(activeNodeIds) ||
                this.activeTransientNodeIds.size > 0 ||
                this.pendingSettledNodeRepaints.size > 0,
        };
    }

    private decayTransientNodeAnimations(
        nodeIds: readonly GraphMutationNodeId[]
    ): void {
        for (let i = 0; i < nodeIds.length; ++i) {
            const node = this.nodesById.get(nodeIds[i]);
            if (!node) {
                continue;
            }

            this.decayTransientNodeAnimation(node as RuntimeAnimatedNode);
        }
    }

    private decayTransientNodeAnimation(node: RuntimeAnimatedNode): void {
        const executeFrames = toFiniteNumber(node.execute_triggered);
        if (executeFrames > 0) {
            node.execute_triggered = Math.max(0, executeFrames - 1);
        }

        const actionFrames = toFiniteNumber(node.action_triggered);
        if (actionFrames > 0) {
            node.action_triggered = Math.max(0, actionFrames - 1);
        }
    }

    private hasTransientNodeAnimation(node: GraphMutationNodeLike): boolean {
        const animatedNode = node as RuntimeAnimatedNode;
        return (
            toFiniteNumber(animatedNode.execute_triggered) > 0 ||
            toFiniteNumber(animatedNode.action_triggered) > 0
        );
    }

    private syncTransientNodeTracking(
        nodeId: GraphMutationNodeId,
        node?: GraphMutationNodeLike
    ): boolean {
        const resolvedNode = node || this.nodesById.get(nodeId);
        if (resolvedNode && this.hasTransientNodeAnimation(resolvedNode)) {
            this.activeTransientNodeIds.add(nodeId);
            return true;
        }

        this.activeTransientNodeIds.delete(nodeId);
        return false;
    }

    private syncTransientNodeTrackingFor(
        nodeIds: readonly GraphMutationNodeId[]
    ): GraphMutationNodeId[] {
        const activeNodeIds: GraphMutationNodeId[] = [];
        const seenNodeIds = new Set<string>();
        for (let i = 0; i < nodeIds.length; ++i) {
            const nodeId = nodeIds[i];
            const nodeKey = toMutationKey(nodeId);
            if (seenNodeIds.has(nodeKey)) {
                continue;
            }

            seenNodeIds.add(nodeKey);
            if (this.syncTransientNodeTracking(nodeId)) {
                activeNodeIds.push(nodeId);
            }
        }

        return activeNodeIds;
    }

    private captureTrackedTransientNodeIds(
        skipNodeKeys?: ReadonlySet<string> | null
    ): GraphMutationNodeId[] {
        const activeNodeIds: GraphMutationNodeId[] = [];
        for (const nodeId of Array.from(this.activeTransientNodeIds)) {
            if (skipNodeKeys?.has(toMutationKey(nodeId))) {
                continue;
            }
            if (this.syncTransientNodeTracking(nodeId)) {
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

    private queuePendingRuntimeNodeIds(
        nodeIds?: readonly GraphMutationNodeId[]
    ): void {
        if (!nodeIds?.length) {
            return;
        }

        for (let i = 0; i < nodeIds.length; ++i) {
            const nodeId = nodeIds[i];
            this.pendingRuntimeDirtyNodeIds.set(toMutationKey(nodeId), nodeId);
        }
    }

    private queuePendingRuntimeLinkIds(
        linkIds?: readonly GraphMutationLinkId[]
    ): void {
        if (!linkIds?.length) {
            return;
        }

        for (let i = 0; i < linkIds.length; ++i) {
            const rawLinkId = linkIds[i];
            const resolvedLinkId =
                this.linkIdsByKey.get(toMutationKey(rawLinkId)) ?? rawLinkId;
            this.pendingRuntimeDirtyLinkIds.set(
                toMutationKey(resolvedLinkId),
                resolvedLinkId
            );
        }
    }

    private consumePendingRuntimeNodeIds(): GraphMutationNodeId[] {
        if (!this.pendingRuntimeDirtyNodeIds.size) {
            return [];
        }

        const nodeIds = Array.from(this.pendingRuntimeDirtyNodeIds.values());
        this.pendingRuntimeDirtyNodeIds.clear();
        return nodeIds;
    }

    private consumePendingRuntimeLinkIds(): GraphMutationLinkId[] {
        if (!this.pendingRuntimeDirtyLinkIds.size) {
            return [];
        }

        const linkIds = Array.from(this.pendingRuntimeDirtyLinkIds.values());
        this.pendingRuntimeDirtyLinkIds.clear();
        return linkIds;
    }

    private consumePendingRuntimeDirtyBounds(): RenderBoundsLike | null {
        const dirtyBounds = this.pendingRuntimeDirtyBounds;
        this.pendingRuntimeDirtyBounds = null;
        return dirtyBounds;
    }

    private hasPendingRuntimeVisualWork(): boolean {
        return (
            this.pendingRuntimeForceNodeRepaint ||
            this.pendingRuntimeRepaintAllNodes ||
            this.pendingRuntimeDirtyNodeIds.size > 0 ||
            this.pendingRuntimeDirtyLinkIds.size > 0 ||
            this.pendingRuntimeDirtyBounds !== null ||
            this.pendingSettledNodeRepaints.size > 0 ||
            this.activeTransientNodeIds.size > 0 ||
            this.activeLinkIds.size > 0 ||
            this.dirtyRuntimeLinkIds.size > 0
        );
    }

    private resolveRuntimeVisualScheduler(): LeaferRuntimeVisualSchedulerLike | null {
        const app = this.appHost.app as LeaferRuntimeVisualSchedulerLike | null;
        if (!app || typeof app.nextRender !== "function") {
            return null;
        }

        return app;
    }

    getRuntimeDiagnostics(): {
        readonly runtimeFlushEnqueueCount: number;
        readonly runtimeVisualFrameCount: number;
        readonly runtimeSceneRenderCount: number;
    } {
        return {
            runtimeFlushEnqueueCount: this.runtimeFlushEnqueueCount,
            runtimeVisualFrameCount: this.runtimeVisualFrameCount,
            runtimeSceneRenderCount: this.runtimeSceneRenderCount,
        };
    }

    private queueDirtyRuntimeLinkIds(
        linkIds?: readonly GraphMutationLinkId[]
    ): void {
        if (!linkIds?.length) {
            return;
        }

        for (let i = 0; i < linkIds.length; ++i) {
            const rawLinkId = linkIds[i];
            const resolvedLinkId =
                this.linkIdsByKey.get(toMutationKey(rawLinkId)) ?? rawLinkId;
            this.dirtyRuntimeLinkIds.add(resolvedLinkId);
        }
    }

    private syncActiveLinkTracking(
        linkId: GraphMutationLinkId,
        link?: GraphMutationLinkLike,
        now = this.getRuntimeNow()
    ): boolean {
        const resolvedLink = link || this.linksById.get(linkId);
        if (
            resolvedLink &&
            this.isLinkFlowActive(resolvedLink as RuntimeAnimatedLink, now)
        ) {
            this.activeLinkIds.add(linkId);
            return true;
        }

        this.activeLinkIds.delete(linkId);
        return false;
    }

    private consumeRuntimeLinkRefreshIds(now: number): GraphMutationLinkId[] {
        if (!this.activeLinkIds.size && !this.dirtyRuntimeLinkIds.size) {
            return [];
        }

        const refreshIds: GraphMutationLinkId[] = [];
        const seenLinkIds = new Set<string>();
        const pushRefreshId = (linkId: GraphMutationLinkId): void => {
            const key = toMutationKey(linkId);
            if (seenLinkIds.has(key)) {
                return;
            }

            seenLinkIds.add(key);
            refreshIds.push(linkId);
        };

        for (const dirtyLinkId of Array.from(this.dirtyRuntimeLinkIds)) {
            const resolvedLinkId =
                this.linkIdsByKey.get(toMutationKey(dirtyLinkId)) ?? dirtyLinkId;
            this.syncActiveLinkTracking(
                resolvedLinkId,
                this.linksById.get(resolvedLinkId),
                now
            );
            pushRefreshId(resolvedLinkId);
        }
        this.dirtyRuntimeLinkIds.clear();

        for (const activeLinkId of Array.from(this.activeLinkIds)) {
            if (!this.linksById.has(activeLinkId)) {
                this.activeLinkIds.delete(activeLinkId);
                this.linkGeometryCache.delete(activeLinkId);
                this.activeLinkPresentationStateById.delete(activeLinkId);
                this.workerLinkPresentationById.delete(toMutationKey(activeLinkId));
                continue;
            }

            pushRefreshId(activeLinkId);
        }

        return refreshIds;
    }

    private prepareActiveLinkPresentations(now: number): void {
        this.activeLinkPresentationStateById.clear();
        if (!this.activeLinkIds.size) {
            this.pendingActiveLinkPresentationRequest = null;
            return;
        }

        const tasks: LeaferActiveLinkPresentationTask[] = [];
        for (const linkId of this.activeLinkIds) {
            const link = this.linksById.get(linkId);
            if (!link || !this.isLinkFlowActive(link as RuntimeAnimatedLink, now)) {
                this.workerLinkPresentationById.delete(toMutationKey(linkId));
                continue;
            }

            const taskState = this.buildActiveLinkPresentationState(
                linkId,
                link as RuntimeAnimatedLink
            );
            if (!taskState) {
                this.workerLinkPresentationById.delete(toMutationKey(linkId));
                continue;
            }

            this.activeLinkPresentationStateById.set(linkId, taskState);
            tasks.push(taskState.task);
        }

        if (!tasks.length) {
            this.pendingActiveLinkPresentationRequest = null;
            return;
        }

        if (this.activeLinkPresentationRequestInFlight) {
            this.pendingActiveLinkPresentationRequest = { now, tasks };
            return;
        }

        this.dispatchActiveLinkPresentationRequest(now, tasks);
    }

    private refreshActiveLinkAnimations(): AnimationRefreshResult {
        const now = this.getRuntimeNow();
        const refreshLinkIds = this.consumeRuntimeLinkRefreshIds(now);
        if (!refreshLinkIds.length) {
            return { didUpdate: false, hasMore: false, dirtyBounds: null };
        }

        this.prepareActiveLinkPresentations(now);
        let didUpdate = false;
        let dirtyBounds: RenderBoundsLike | null = null;
        for (let i = 0; i < refreshLinkIds.length; ++i) {
            const linkId = refreshLinkIds[i];
            const previousBounds = this.captureLinkRenderBounds(linkId);
            const wasTracked = this.activeLinkIds.has(linkId);
            const isActive = this.syncLinkView(
                linkId,
                undefined,
                undefined,
                now,
                true
            );
            const nextBounds = this.captureLinkRenderBounds(linkId);
            dirtyBounds = mergeRenderBounds(
                dirtyBounds,
                mergeRenderBounds(previousBounds, nextBounds)
            );
            if (wasTracked || isActive) {
                didUpdate = true;
            }
        }

        return {
            didUpdate,
            hasMore: this.activeLinkIds.size > 0,
            dirtyBounds,
        };
    }

    private isLinkFlowActive(link: RuntimeAnimatedLink, now: number): boolean {
        const lastTime = toFiniteNumber(link._last_time);
        return Boolean(lastTime) && now - lastTime < ACTIVE_LINK_WINDOW_MS;
    }

    private readonly handleActiveLinkPresentationResult = (
        requestId: number,
        results: ReadonlyArray<LeaferActiveLinkPresentationResult>
    ): void => {
        this.activeLinkPresentationRequestInFlight = false;
        if (
            !results.length ||
            requestId <= this.lastHandledActiveLinkPresentationRequestId
        ) {
            this.flushPendingActiveLinkPresentationRequest();
            return;
        }
        this.lastHandledActiveLinkPresentationRequestId = requestId;

        let hasQueuedVisualWork = false;
        for (let i = 0; i < results.length; ++i) {
            const result = results[i];
            const linkId = this.linkIdsByKey.get(result.linkId);
            if (linkId == null) {
                continue;
            }
            this.workerLinkPresentationById.set(result.linkId, result);
            this.linkGeometryCache.set(linkId, {
                curve: result.curve as LinkCurveGeometry,
            });
            const link = this.linksById.get(linkId);
            if (link) {
                this.syncLinkMidpointToPoint(
                    link as RuntimeAnimatedLink,
                    result.midpoint
                );
            }
            this.queuePendingRuntimeLinkIds([linkId]);
            hasQueuedVisualWork = true;
        }

        if (hasQueuedVisualWork) {
            this.runtimeFlushEnqueueCount += 1;
            this.ensureRuntimeVisualFrame();
        }

        this.flushPendingActiveLinkPresentationRequest();
    };

    private buildActiveLinkPresentationState(
        linkId: GraphMutationLinkId,
        link: RuntimeAnimatedLink
    ): ActiveLinkPresentationState | null {
        const layout = this.nodePortAdapter.getLinkLayout(link);
        if (!layout) {
            return null;
        }

        const task: LeaferActiveLinkPresentationTask = {
            linkId: toMutationKey(linkId),
            start: [layout.start[0], layout.start[1]],
            end: [layout.end[0], layout.end[1]],
            startDir: layout.startDir,
            endDir: layout.endDir,
            lastTime: toFiniteNumber(link._last_time),
        };
        return {
            task,
            layoutKey: buildActiveLinkLayoutKey(task),
            cacheKey: buildActiveLinkPresentationCacheKey(task),
        };
    }

    private resolveWorkerLinkPresentation(
        linkId: GraphMutationLinkId,
        link: RuntimeAnimatedLink,
        now: number
    ): LeaferActiveLinkPresentationResult | null {
        if (!this.isLinkFlowActive(link, now)) {
            this.workerLinkPresentationById.delete(toMutationKey(linkId));
            return null;
        }

        const currentState = this.activeLinkPresentationStateById.get(linkId);
        if (!currentState) {
            return null;
        }

        const presentation = this.workerLinkPresentationById.get(toMutationKey(linkId));
        if (!presentation) {
            return null;
        }

        if (
            !presentation.active ||
            presentation.layoutKey !== currentState.layoutKey
        ) {
            return null;
        }

        return presentation;
    }

    private resolveLinkCurve(
        linkId: GraphMutationLinkId,
        link: GraphMutationLinkLike,
        preferCachedCurve = false
    ): { curve: LinkCurveGeometry | null; reused: boolean } {
        const cached = this.linkGeometryCache.get(linkId)?.curve || null;
        if (preferCachedCurve && cached) {
            return {
                curve: cached,
                reused: true,
            };
        }

        const nextCurve = this.nodePortAdapter.getLinkCurve(link);
        if (!nextCurve) {
            return {
                curve: null,
                reused: false,
            };
        }

        if (cached && this.isSameLinkCurve(cached, nextCurve)) {
            return {
                curve: cached,
                reused: true,
            };
        }

        this.linkGeometryCache.set(linkId, { curve: nextCurve });
        return {
            curve: nextCurve,
            reused: false,
        };
    }

    private isSameLinkCurve(
        current: LinkCurveGeometry,
        next: LinkCurveGeometry
    ): boolean {
        return (
            current.path === next.path &&
            current.startDir === next.startDir &&
            current.endDir === next.endDir
        );
    }

    private buildLinkFlowPresentation(
        _linkId: GraphMutationLinkId,
        link: RuntimeAnimatedLink,
        now: number
    ): NonNullable<Parameters<LinkView["update"]>[0]["flow"]> {
        const lastTime = toFiniteNumber(link._last_time);
        if (!lastTime) {
            return { active: false };
        }

        const opacity = resolveActiveLinkOpacity(lastTime, now);
        if (!(opacity > 0)) {
            return { active: false };
        }

        return {
            active: true,
            color: "#FFF",
            opacity,
        };
    }

    private buildWorkerLinkFlowPresentation(
        presentation: LeaferActiveLinkPresentationResult
    ): NonNullable<Parameters<LinkView["update"]>[0]["flow"]> {
        if (!presentation.active) {
            return { active: false };
        }

        return {
            active: true,
            color: "#FFF",
            opacity: presentation.opacity,
        };
    }

    private syncLinkMidpoint(
        link: RuntimeAnimatedLink,
        curve: Exclude<ReturnType<NodePortAdapter["getLinkCurve"]>, null>
    ): void {
        const midpoint = this.nodePortAdapter.getPointOnLinkCurve(curve, 0.5);
        this.syncLinkMidpointToPoint(link, midpoint);
    }

    private syncLinkMidpointToPoint(
        link: RuntimeAnimatedLink,
        midpoint: readonly [number, number]
    ): void {
        const target = ArrayBuffer.isView(link._pos)
            ? link._pos
            : (link._pos = new Float32Array(2));

        target[0] = midpoint[0];
        target[1] = midpoint[1];
    }

    private dispatchActiveLinkPresentationRequest(
        now: number,
        tasks: ReadonlyArray<LeaferActiveLinkPresentationTask>
    ): void {
        const requestId = this.appHost.taskWorker.requestActiveLinkPresentations(
            now,
            tasks
        );
        this.activeLinkPresentationRequestInFlight = requestId !== null;
        if (requestId === null) {
            this.pendingActiveLinkPresentationRequest = null;
        }
    }

    private flushPendingActiveLinkPresentationRequest(): void {
        if (this.activeLinkPresentationRequestInFlight) {
            return;
        }

        const pending = this.pendingActiveLinkPresentationRequest;
        if (!pending) {
            return;
        }

        this.pendingActiveLinkPresentationRequest = null;
        this.dispatchActiveLinkPresentationRequest(pending.now, pending.tasks);
    }
}
