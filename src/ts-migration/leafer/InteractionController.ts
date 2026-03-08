import * as leafer from "leafer-ui";

import type {
    GraphMutationBus,
    GraphMutationGraphLike,
    GraphMutationNodeId,
    GraphMutationNodeLike,
} from "./GraphMutationBus";
import { ConnectionController } from "./ConnectionController";
import { HitTestService } from "./HitTestService";
import type { LeaferAppHost } from "./LeaferAppHost";
import {
    createNativeContextMenuEvent,
    createLegacyPointerEvent,
    type LegacyPointerEventSource,
    type LegacyPointerTarget,
} from "./LegacyPointerEventAdapter";
import {
    ModernNodeHost,
    type ModernNodePartHit,
} from "./ModernNodeHost";
import { NodePortAdapter, type NodePortNodeLike } from "./NodePortAdapter";
import type { NodeViewHost } from "./NodeViewHost";
import { OverlayPrimitives } from "./OverlayPrimitives";
import type { SceneSyncController } from "./SceneSyncController";
import { SelectionController } from "./SelectionController";

interface InteractionCanvasHost {
    readonly graph: GraphMutationGraphLike | null;
    readonly graphMutationBus: GraphMutationBus | null;
    readonly leaferAppHost: LeaferAppHost | null;
    readonly sceneSyncController: SceneSyncController | null;
    readonly selected_nodes: Record<string, GraphMutationNodeLike>;
    readonly node_widget: [unknown, unknown] | null;
    readonly node_capturing_input: unknown;
    readonly node_over: unknown;
    readonly node_dragged?: unknown;
    readonly resizing_node?: unknown;
    readonly connecting_node?: unknown;
    readonly allow_dragnodes?: boolean;
    readonly allow_interaction?: boolean;
    readonly read_only?: boolean;
    readonly align_to_grid?: boolean;
    readonly onNodeMoved?: ((node: GraphMutationNodeLike) => void) | null;
    processMouseDown: (event: unknown) => boolean | undefined;
    processMouseMove: (event: unknown) => boolean | undefined;
    processMouseUp: (event: unknown) => boolean | undefined;
    processContextMenu?: (
        node: GraphMutationNodeLike | null,
        event: unknown
    ) => void;
    processNodeDblClicked?: (node: GraphMutationNodeLike) => void;
    showEditPropertyValue?: (
        node: GraphMutationNodeLike,
        property: string,
        options?: Record<string, unknown>
    ) => unknown;
    selectNodes: (
        nodes?: GraphMutationNodeLike[],
        addToCurrentSelection?: boolean
    ) => void;
    deselectAllNodes: () => void;
    getCanvasWindow?: () => Window;
}

interface InteractionGraphLike extends GraphMutationGraphLike {
    _nodes?: GraphMutationNodeLike[];
    beforeChange?: (info?: GraphMutationNodeLike) => void;
    afterChange?: (info?: GraphMutationNodeLike) => void;
    change?: () => void;
    config?: {
        align_to_grid?: boolean;
        [key: string]: unknown;
    };
}

interface DraggableNodeLike extends GraphMutationNodeLike {
    pos: [number, number] | Float32Array;
    size: [number, number] | Float32Array;
    alignToGrid?: () => void;
}

interface PointLike {
    x: number;
    y: number;
}

type PointerSession =
    | {
          kind: "legacy-press";
      }
    | {
          kind: "node-press";
          node: DraggableNodeLike;
          host: ModernNodeHost | null;
          part: ModernNodePartHit | null;
          legacyPointerUp: boolean;
      }
    | {
          kind: "node-drag";
          node: DraggableNodeLike;
          dragNodes: DraggableNodeLike[];
          lastGraphPoint: PointLike;
          host: ModernNodeHost | null;
      }
    | {
          kind: "node-resize";
          node: DraggableNodeLike;
          host: ModernNodeHost;
          lastGraphPoint: PointLike;
      }
    | {
          kind: "modern-press";
          node: DraggableNodeLike;
          host: ModernNodeHost;
          part: ModernNodePartHit;
      }
    | {
          kind: "background-press";
          additive: boolean;
          startGraphPoint: PointLike;
      }
    | {
          kind: "selection";
      }
    | {
          kind: "connection";
      };

function toFiniteNumber(value: unknown): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
}

function isDraggableNode(node: unknown): node is DraggableNodeLike {
    const pos = (node as DraggableNodeLike | null | undefined)?.pos;
    return (
        Boolean(node) &&
        typeof node === "object" &&
        Boolean(pos) &&
        (Array.isArray(pos) || ArrayBuffer.isView(pos))
    );
}

function getPointerDistance(a: PointLike, b: PointLike): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function isLegacyHost(
    host: NodeViewHost | null | undefined
): host is NodeViewHost & { eventRoot: LegacyPointerTarget["nodeRoot"] } {
    return Boolean(
        host &&
            host.runtime === "legacy" &&
            "eventRoot" in host &&
            host.eventRoot
    );
}

function isModernHost(
    host: NodeViewHost | null | undefined
): host is ModernNodeHost {
    return Boolean(host && host.runtime === "modern");
}

function sameModernPart(
    left: ModernNodePartHit | null | undefined,
    right: ModernNodePartHit | null | undefined
): boolean {
    return (
        left?.kind === right?.kind &&
        left?.index === right?.index &&
        left?.action === right?.action
    );
}

export class InteractionController {
    private readonly hitTestService: HitTestService;
    private readonly nodePortAdapter: NodePortAdapter;
    private readonly overlayPrimitives: OverlayPrimitives;
    private readonly connectionController: ConnectionController;
    private readonly selectionController: SelectionController;
    private readonly view: HTMLElement;
    private readonly doc: Document;
    private readonly graphRef: InteractionGraphLike;
    private pointerDownAt = 0;
    private pointerIsDown = false;
    private lastPagePoint: PointLike | null = null;
    private pointerDownPagePoint: PointLike | null = null;
    private documentTrackingBound = false;
    private session: PointerSession | null = null;
    private dragTransactionNode: GraphMutationNodeLike | null = null;
    private hoveredModernHost: ModernNodeHost | null = null;
    private lastTapNodeId: GraphMutationNodeId | null = null;
    private lastTapPart: ModernNodePartHit | null = null;
    private lastTapAt = 0;

    constructor(
        graph: GraphMutationGraphLike,
        private readonly canvas: InteractionCanvasHost,
        private readonly appHost: LeaferAppHost,
        sceneSyncController: SceneSyncController
    ) {
        this.graphRef = graph as InteractionGraphLike;
        this.hitTestService = new HitTestService(graph, sceneSyncController);
        this.nodePortAdapter = new NodePortAdapter(
            graph as GraphMutationGraphLike & {
                _nodes?: NodePortNodeLike[];
                getNodeById?: (id: GraphMutationNodeId) => NodePortNodeLike | null;
            },
            {
                resolveNodeHost: (nodeId) =>
                    sceneSyncController.nodeHosts.get(nodeId) || null,
            }
        );
        this.overlayPrimitives = new OverlayPrimitives(this.appHost);
        this.connectionController = new ConnectionController(
            this.graphRef,
            sceneSyncController,
            this.overlayPrimitives,
            this.nodePortAdapter
        );
        this.selectionController = new SelectionController(
            this.graphRef,
            this.canvas,
            sceneSyncController,
            this.overlayPrimitives
        );
        this.view = this.appHost.view;
        this.doc = this.view.ownerDocument || document;

        this.view.addEventListener("pointerdown", this.handleViewPointerDown, true);
        this.view.addEventListener("pointermove", this.handleViewPointerMove, true);
        this.view.addEventListener("contextmenu", this.handleViewContextMenu, true);
    }

    destroy(): void {
        this.view.removeEventListener(
            "pointerdown",
            this.handleViewPointerDown,
            true
        );
        this.view.removeEventListener(
            "pointermove",
            this.handleViewPointerMove,
            true
        );
        this.view.removeEventListener(
            "contextmenu",
            this.handleViewContextMenu,
            true
        );
        this.detachDocumentTracking();
        this.pointerIsDown = false;
        this.pointerDownAt = 0;
        this.lastPagePoint = null;
        this.pointerDownPagePoint = null;
        this.session = null;
        this.dragTransactionNode = null;
        this.hoveredModernHost?.clearPointerState();
        this.hoveredModernHost = null;
        this.lastTapNodeId = null;
        this.lastTapPart = null;
        this.lastTapAt = 0;
        this.connectionController.destroy();
        this.selectionController.destroy();
        this.overlayPrimitives.destroy();
    }

    private readonly handleViewPointerDown = (event: PointerEvent): void => {
        if (event.button === 2) {
            this.stopPropagationOnly(event, true);
            return;
        }

        if (!this.shouldHandleLegacyPointerDown(event)) {
            return;
        }

        const source = this.createPointerSource(event);
        const pagePoint = source.getPagePoint();
        const graphPoint = source.getInnerPoint();
        const normalizedPagePoint = {
            x: toFiniteNumber(pagePoint.x),
            y: toFiniteNumber(pagePoint.y),
        };
        const normalizedGraphPoint = {
            x: toFiniteNumber(graphPoint.x),
            y: toFiniteNumber(graphPoint.y),
        };

        this.pointerIsDown = true;
        this.pointerDownAt = Date.now();
        this.pointerDownPagePoint = normalizedPagePoint;
        this.lastPagePoint = normalizedPagePoint;
        this.attachDocumentTracking();

        const portHit = this.connectionController.begin(
            normalizedGraphPoint.x,
            normalizedGraphPoint.y
        );
        if (portHit) {
            this.session = {
                kind: "connection",
            };
            this.stopEvent(event, true);
            return;
        }

        const hit = this.hitTestService.hitNodeAt(
            normalizedGraphPoint.x,
            normalizedGraphPoint.y
        );
        if (!hit?.host) {
            this.session = {
                kind: "background-press",
                additive: Boolean(event.ctrlKey || event.metaKey || event.shiftKey),
                startGraphPoint: normalizedGraphPoint,
            };
            this.stopEvent(event);
            return;
        }

        const additiveSelection = Boolean(
            event.ctrlKey || event.metaKey || event.shiftKey
        );
        const selectedNodes = this.canvas.selected_nodes || {};
        const isAlreadySelected = Boolean(selectedNodes[String(hit.node.id)]);
        const legacyHost = isLegacyHost(hit.host) ? hit.host : null;
        const modernHost = isModernHost(hit.host) ? hit.host : null;
        const modernPart = modernHost
            ? modernHost.getInteractivePartAt(
                  normalizedGraphPoint.x,
                  normalizedGraphPoint.y
              )
            : null;

        if (legacyHost) {
            const targets = this.collectTargets(legacyHost);
            const legacyEvent = createLegacyPointerEvent({
                event: source,
                type: "down",
                hostElement: this.appHost.view,
                targets,
                clickTime: 0,
                dragging: false,
                deltaX: 0,
                deltaY: 0,
            });

            this.canvas.processMouseDown(legacyEvent);
            this.canvas.sceneSyncController?.repaintAllNodeHosts();
            this.session = {
                kind: "legacy-press",
            };
            this.stopEvent(event);
            return;
        }

        if (modernHost) {
            this.updateModernHover(modernHost, modernPart);
        }

        if (!isAlreadySelected || additiveSelection) {
            this.canvas.selectNodes([hit.node], additiveSelection);
            this.canvas.sceneSyncController?.repaintAllNodeHosts();
        }

        if (modernHost) {
            modernHost.updateInteractionState({
                hovered: true,
                pressed: true,
                hoveredPart: modernPart,
                pressedPart: modernPart,
                dragging: false,
                resizing: false,
            });

            if (modernPart?.kind === "resize") {
                this.dragTransactionNode = hit.node;
                this.graphRef.beforeChange?.(hit.node);
                modernHost.beginResize(
                    normalizedGraphPoint.x,
                    normalizedGraphPoint.y
                );
                this.session = {
                    kind: "node-resize",
                    node: hit.node as DraggableNodeLike,
                    host: modernHost,
                    lastGraphPoint: normalizedGraphPoint,
                };
                this.stopEvent(event);
                return;
            }

            if (
                modernPart &&
                modernPart.kind !== "body" &&
                modernPart.kind !== "header"
            ) {
                this.session = {
                    kind: "modern-press",
                    node: hit.node as DraggableNodeLike,
                    host: modernHost,
                    part: modernPart,
                };
                this.stopEvent(event);
                return;
            }
        }

        if (!this.canStartNodeDrag(hit.node)) {
            this.session = {
                kind: "background-press",
                additive: additiveSelection,
                startGraphPoint: normalizedGraphPoint,
            };
        } else if (
            !this.hasLegacyInteractiveCapture() &&
            this.canStartNodeDrag(hit.node)
        ) {
            this.session = {
                kind: "node-press",
                node: hit.node as DraggableNodeLike,
                host: modernHost,
                part: modernPart,
                legacyPointerUp: false,
            };
        } else {
            this.session = {
                kind: "legacy-press",
            };
        }

        this.stopEvent(event);
    };

    private readonly handleViewContextMenu = (event: MouseEvent): void => {
        this.dispatchContextMenu(event);
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    private readonly handleViewPointerMove = (event: PointerEvent): void => {
        if (this.pointerIsDown) {
            return;
        }

        this.dispatchHoverPointerMove(event);
    };

    private readonly handleDocumentPointerMove = (event: PointerEvent): void => {
        this.dispatchPointerMoveWhileDown(event);
    };

    private readonly handleDocumentPointerUp = (event: PointerEvent): void => {
        if (!this.pointerIsDown && event.button !== 0) {
            return;
        }
        if (!this.pointerIsDown && !this.shouldHandleLegacyPointerMove(event)) {
            return;
        }

        const source = this.createPointerSource(event);
        const pagePoint = source.getPagePoint();
        const graphPoint = source.getInnerPoint();
        const normalizedPagePoint = {
            x: toFiniteNumber(pagePoint.x),
            y: toFiniteNumber(pagePoint.y),
        };
        const normalizedGraphPoint = {
            x: toFiniteNumber(graphPoint.x),
            y: toFiniteNumber(graphPoint.y),
        };

        if (this.session?.kind === "connection") {
            this.connectionController.finish(
                normalizedGraphPoint.x,
                normalizedGraphPoint.y
            );
            this.stopEvent(event, true);
        } else if (this.session?.kind === "selection") {
            this.selectionController.finish(
                normalizedGraphPoint.x,
                normalizedGraphPoint.y
            );
            this.stopEvent(event);
        } else if (this.session?.kind === "background-press") {
            if (!this.session.additive) {
                this.canvas.deselectAllNodes();
                this.canvas.sceneSyncController?.repaintAllNodeHosts();
            }
            this.stopEvent(event);
        } else if (this.session?.kind === "modern-press") {
            this.finishModernPress(
                this.session,
                normalizedGraphPoint,
                event
            );
            this.stopEvent(event);
        } else if (this.session?.kind === "node-press") {
            if (this.session.legacyPointerUp) {
                this.dispatchLegacyPointerUp(source, normalizedPagePoint, event);
            } else {
                this.finishModernTap(
                    this.session,
                    normalizedGraphPoint,
                    event
                );
                this.stopEvent(event);
            }
        } else if (this.session?.kind === "node-resize") {
            this.finishNodeResize(this.session);
            this.stopEvent(event);
        } else if (this.session?.kind === "node-drag") {
            this.finishNodeDrag(this.session);
            this.stopEvent(event);
        } else {
            this.dispatchLegacyPointerUp(source, normalizedPagePoint, event);
        }

        this.pointerIsDown = false;
        this.pointerDownAt = 0;
        this.lastPagePoint = null;
        this.pointerDownPagePoint = null;
        this.session = null;
        this.dragTransactionNode = null;
        this.updateModernHover(null, null);
        this.view.style.cursor = "";
        this.detachDocumentTracking();
    };

    private dispatchHoverPointerMove(event: PointerEvent): void {
        const source = this.createPointerSource(event);
        const pagePoint = source.getPagePoint();
        const graphPoint = source.getInnerPoint();
        const hit = this.hitTestService.hitNodeAt(graphPoint.x, graphPoint.y);
        const modernHost = isModernHost(hit?.host) ? hit.host : null;
        const modernPart = modernHost
            ? modernHost.getInteractivePartAt(graphPoint.x, graphPoint.y)
            : null;

        this.updateModernHover(modernHost, modernPart);

        if (modernHost) {
            this.view.style.cursor = this.resolveCursorForModernPart(modernPart);
        } else if (!this.pointerIsDown) {
            this.view.style.cursor = "";
        }

        if (!this.shouldHandleLegacyPointerMove(event)) {
            return;
        }

        const targets = this.collectTargets(this.toLegacyHost(hit?.host || null));
        const shouldDispatch =
            targets.length > 0 ||
            Boolean(this.canvas.node_widget) ||
            Boolean(this.canvas.node_over) ||
            Boolean(this.canvas.node_capturing_input) ||
            Boolean(this.canvas.node_dragged) ||
            Boolean(this.canvas.resizing_node) ||
            Boolean(this.canvas.connecting_node);

        const normalizedPagePoint = {
            x: toFiniteNumber(pagePoint.x),
            y: toFiniteNumber(pagePoint.y),
        };
        const deltaX = this.lastPagePoint
            ? normalizedPagePoint.x - this.lastPagePoint.x
            : 0;
        const deltaY = this.lastPagePoint
            ? normalizedPagePoint.y - this.lastPagePoint.y
            : 0;
        this.lastPagePoint = normalizedPagePoint;

        if (!shouldDispatch) {
            return;
        }

        const legacyEvent = createLegacyPointerEvent({
            event: source,
            type: "move",
            hostElement: this.appHost.view,
            targets,
            clickTime: this.pointerDownAt ? Date.now() - this.pointerDownAt : 0,
            dragging: this.pointerIsDown,
            deltaX,
            deltaY,
        });

        this.canvas.processMouseMove(legacyEvent);
        this.stopEvent(event);
    }

    private dispatchPointerMoveWhileDown(event: PointerEvent): void {
        if (!this.pointerIsDown || !this.session) {
            return;
        }

        const source = this.createPointerSource(event);
        const pagePoint = source.getPagePoint();
        const graphPoint = source.getInnerPoint();
        const normalizedPagePoint = {
            x: toFiniteNumber(pagePoint.x),
            y: toFiniteNumber(pagePoint.y),
        };
        const normalizedGraphPoint = {
            x: toFiniteNumber(graphPoint.x),
            y: toFiniteNumber(graphPoint.y),
        };

        if (this.session.kind === "connection") {
            this.connectionController.update(
                normalizedGraphPoint.x,
                normalizedGraphPoint.y
            );
            this.lastPagePoint = normalizedPagePoint;
            this.stopEvent(event, true);
            return;
        }

        if (this.session.kind === "background-press") {
            if (
                this.pointerDownPagePoint &&
                getPointerDistance(
                    this.pointerDownPagePoint,
                    normalizedPagePoint
                ) >= 4
            ) {
                this.selectionController.begin(
                    this.session.startGraphPoint.x,
                    this.session.startGraphPoint.y,
                    this.session.additive
                );
                this.session = {
                    kind: "selection",
                };
            } else {
                this.lastPagePoint = normalizedPagePoint;
                return;
            }
        }

        if (this.session.kind === "selection") {
            this.selectionController.update(
                normalizedGraphPoint.x,
                normalizedGraphPoint.y
            );
            this.lastPagePoint = normalizedPagePoint;
            this.stopEvent(event);
            return;
        }

        if (this.session.kind === "legacy-press") {
            this.dispatchLegacyPointerMoveActive(
                source,
                normalizedPagePoint,
                event
            );
            return;
        }

        if (this.session.kind === "modern-press") {
            const activePart = this.session.host.getInteractivePartAt(
                normalizedGraphPoint.x,
                normalizedGraphPoint.y
            );
            this.session.host.updateInteractionState({
                hovered: true,
                pressed: true,
                hoveredPart: activePart,
                pressedPart: this.session.part,
            });
            this.lastPagePoint = normalizedPagePoint;
            this.view.style.cursor = this.resolveCursorForModernPart(
                this.session.part
            );
            this.stopEvent(event);
            return;
        }

        if (this.session.kind === "node-press") {
            if (this.session.legacyPointerUp && this.hasLegacyInteractiveCapture()) {
                this.session = {
                    kind: "legacy-press",
                };
                this.dispatchLegacyPointerMoveActive(
                    source,
                    normalizedPagePoint,
                    event
                );
                return;
            }

            if (this.session.host) {
                const activePart = this.session.host.getInteractivePartAt(
                    normalizedGraphPoint.x,
                    normalizedGraphPoint.y
                );
                this.session.host.updateInteractionState({
                    hovered: true,
                    pressed: true,
                    hoveredPart: activePart,
                    pressedPart: this.session.part,
                });
            }

            if (
                this.pointerDownPagePoint &&
                getPointerDistance(
                    this.pointerDownPagePoint,
                    normalizedPagePoint
                ) >= 4
            ) {
                const pressedSession = this.session;
                const dragNodes = this.collectDragNodes(this.session.node);
                this.dragTransactionNode = this.session.node;
                this.graphRef.beforeChange?.(this.session.node);
                this.session = {
                    kind: "node-drag",
                    node: this.session.node,
                    dragNodes,
                    lastGraphPoint: normalizedGraphPoint,
                    host: this.session.host,
                };
                this.session.host?.updateInteractionState({
                    pressed: false,
                    dragging: true,
                    pressedPart: null,
                    hoveredPart: pressedSession.part,
                });
            } else {
                this.lastPagePoint = normalizedPagePoint;
                return;
            }
        }

        if (this.session.kind === "node-resize") {
            const didResize = this.session.host.updateResize(
                normalizedGraphPoint.x,
                normalizedGraphPoint.y
            );
            this.session.host.updateInteractionState({
                hovered: true,
                pressed: true,
                resizing: true,
                hoveredPart: {
                    kind: "resize",
                    cursor: "se-resize",
                },
                pressedPart: {
                    kind: "resize",
                    cursor: "se-resize",
                },
            });
            if (didResize) {
                this.canvas.sceneSyncController?.repaintNodeHost(
                    this.session.node.id
                );
            }
            this.lastPagePoint = normalizedPagePoint;
            this.view.style.cursor = "se-resize";
            this.stopEvent(event);
            return;
        }

        if (this.session.kind === "node-drag") {
            const deltaX =
                normalizedGraphPoint.x - this.session.lastGraphPoint.x;
            const deltaY =
                normalizedGraphPoint.y - this.session.lastGraphPoint.y;
            if (deltaX || deltaY) {
                for (let i = 0; i < this.session.dragNodes.length; ++i) {
                    const node = this.session.dragNodes[i];
                    node.pos[0] += deltaX;
                    node.pos[1] += deltaY;
                    this.emitNodeMoved(node);
                }
                this.session.lastGraphPoint = normalizedGraphPoint;
            }
            this.session.host?.updateInteractionState({
                hovered: true,
                pressed: false,
                dragging: true,
                hoveredPart: {
                    kind: "body",
                },
                pressedPart: null,
            });
            this.lastPagePoint = normalizedPagePoint;
            this.stopEvent(event);
        }
    }

    private dispatchLegacyPointerMoveActive(
        source: LegacyPointerEventSource,
        pagePoint: PointLike,
        event: PointerEvent
    ): void {
        const graphPoint = source.getInnerPoint();
        const hit = this.hitTestService.hitNodeAt(graphPoint.x, graphPoint.y);
        const targets = this.collectTargets(this.toLegacyHost(hit?.host || null));
        const shouldDispatch =
            targets.length > 0 ||
            Boolean(this.canvas.node_widget) ||
            Boolean(this.canvas.node_over) ||
            Boolean(this.canvas.node_capturing_input) ||
            Boolean(this.canvas.node_dragged) ||
            Boolean(this.canvas.resizing_node) ||
            Boolean(this.canvas.connecting_node);

        const deltaX = this.lastPagePoint
            ? pagePoint.x - this.lastPagePoint.x
            : 0;
        const deltaY = this.lastPagePoint
            ? pagePoint.y - this.lastPagePoint.y
            : 0;
        this.lastPagePoint = pagePoint;

        if (!shouldDispatch) {
            return;
        }

        const legacyEvent = createLegacyPointerEvent({
            event: source,
            type: "move",
            hostElement: this.appHost.view,
            targets,
            clickTime: this.pointerDownAt ? Date.now() - this.pointerDownAt : 0,
            dragging: this.pointerIsDown,
            deltaX,
            deltaY,
        });

        this.canvas.processMouseMove(legacyEvent);
        this.stopEvent(event);
    }

    private dispatchLegacyPointerUp(
        source: LegacyPointerEventSource,
        pagePoint: PointLike,
        event: PointerEvent
    ): void {
        const graphPoint = source.getInnerPoint();
        const hit = this.hitTestService.hitNodeAt(graphPoint.x, graphPoint.y);
        const targets = this.collectTargets(this.toLegacyHost(hit?.host || null));
        const shouldDispatch =
            this.pointerIsDown ||
            targets.length > 0 ||
            Boolean(this.canvas.node_widget) ||
            Boolean(this.canvas.node_over) ||
            Boolean(this.canvas.node_capturing_input) ||
            Boolean(this.canvas.node_dragged) ||
            Boolean(this.canvas.resizing_node) ||
            Boolean(this.canvas.connecting_node);
        const deltaX = this.lastPagePoint
            ? pagePoint.x - this.lastPagePoint.x
            : 0;
        const deltaY = this.lastPagePoint
            ? pagePoint.y - this.lastPagePoint.y
            : 0;

        this.lastPagePoint = pagePoint;
        if (!shouldDispatch) {
            return;
        }

        const legacyEvent = createLegacyPointerEvent({
            event: source,
            type: "up",
            hostElement: this.appHost.view,
            targets,
            clickTime: this.pointerDownAt ? Date.now() - this.pointerDownAt : 0,
            dragging: this.pointerIsDown,
            deltaX,
            deltaY,
        });

        this.canvas.processMouseUp(legacyEvent);
        this.stopEvent(event);
    }

    private finishNodeDrag(
        session: Extract<PointerSession, { kind: "node-drag" }>
    ): void {
        for (let i = 0; i < session.dragNodes.length; ++i) {
            const node = session.dragNodes[i];
            node.pos[0] = Math.round(node.pos[0]);
            node.pos[1] = Math.round(node.pos[1]);
            if (this.graphRef.config?.align_to_grid || this.canvas.align_to_grid) {
                node.alignToGrid?.();
            }
            this.emitNodeMoved(node);
            this.canvas.onNodeMoved?.(node);
        }

        session.host?.updateInteractionState({
            dragging: false,
            pressed: false,
            resizing: false,
            hovered: true,
            hoveredPart: { kind: "body" },
            pressedPart: null,
        });
        this.graphRef.afterChange?.(this.dragTransactionNode || session.node);
        this.graphRef.change?.();
    }

    private finishNodeResize(
        session: Extract<PointerSession, { kind: "node-resize" }>
    ): void {
        session.host.endResize();
        (session.node as {
            onResize?: (size: [number, number] | Float32Array) => void;
            setDirtyCanvas?: (
                dirtyForeground: boolean,
                dirtyBackground?: boolean
            ) => void;
        }).onResize?.(session.node.size);
        (session.node as {
            setDirtyCanvas?: (
                dirtyForeground: boolean,
                dirtyBackground?: boolean
            ) => void;
        }).setDirtyCanvas?.(true, true);
        this.canvas.sceneSyncController?.repaintNodeHost(session.node.id);
        this.graphRef.afterChange?.(this.dragTransactionNode || session.node);
        this.graphRef.change?.();
    }

    private finishModernPress(
        session: Extract<PointerSession, { kind: "modern-press" }>,
        graphPoint: PointLike,
        event: PointerEvent
    ): void {
        const releasePart = session.host.getInteractivePartAt(
            graphPoint.x,
            graphPoint.y
        );
        session.host.updateInteractionState({
            hovered: true,
            pressed: false,
            hoveredPart: releasePart,
            pressedPart: null,
        });

        if (!sameModernPart(session.part, releasePart)) {
            return;
        }

        if (session.part.kind === "collapse") {
            this.graphRef.beforeChange?.(session.node);
            (
                session.node as { collapse?: (force?: boolean) => void }
            ).collapse?.(false);
            this.graphRef.afterChange?.(session.node);
            this.graphRef.change?.();
            this.canvas.sceneSyncController?.repaintNodeHost(session.node.id);
            return;
        }

        if (session.part.kind === "widget") {
            this.executeModernWidgetAction(
                session.node,
                session.host,
                session.part,
                event
            );
            this.canvas.sceneSyncController?.repaintNodeHost(session.node.id);
        }
    }

    private finishModernTap(
        session: Extract<PointerSession, { kind: "node-press" }>,
        graphPoint: PointLike,
        event: PointerEvent
    ): void {
        if (!session.host) {
            return;
        }

        const releasePart = session.host.getInteractivePartAt(
            graphPoint.x,
            graphPoint.y
        );
        session.host.updateInteractionState({
            hovered: true,
            pressed: false,
            hoveredPart: releasePart,
            pressedPart: null,
            dragging: false,
            resizing: false,
        });

        if (
            !releasePart ||
            (releasePart.kind !== "body" && releasePart.kind !== "header")
        ) {
            return;
        }

        const now = Date.now();
        const isDoubleTap =
            this.lastTapNodeId === session.node.id &&
            sameModernPart(this.lastTapPart, releasePart) &&
            now - this.lastTapAt < 320;

        this.lastTapNodeId = session.node.id;
        this.lastTapPart = releasePart;
        this.lastTapAt = now;

        if (!isDoubleTap) {
            return;
        }

        const localPos = session.host.getLocalPoint(graphPoint.x, graphPoint.y);
        (
            session.node as {
                onDblClick?: (
                    event: PointerEvent,
                    pos: readonly [number, number],
                    graphcanvas: InteractionCanvasHost
                ) => void;
            }
        ).onDblClick?.(event, localPos, this.canvas);
        this.canvas.processNodeDblClicked?.(session.node);
        this.canvas.sceneSyncController?.repaintNodeHost(session.node.id);
    }

    private executeModernWidgetAction(
        node: GraphMutationNodeLike,
        host: ModernNodeHost,
        part: ModernNodePartHit,
        event: PointerEvent
    ): void {
        if (part.index == null) {
            return;
        }
        const entry = host.getWidgetEntry(part.index);
        if (!entry || entry.schema.disabled) {
            return;
        }
        if (entry.schema.readonly && entry.schema.type !== "button") {
            return;
        }

        const pagePoint = this.appHost.app.getPagePointByClient({
            clientX: event.clientX,
            clientY: event.clientY,
        });
        const localPos = host.getLocalPoint(
            toFiniteNumber(pagePoint.x),
            toFiniteNumber(pagePoint.y)
        );
        const propertyName = entry.schema.property;
        const widgetMeta = {
            ...entry.schema,
            bounds: entry.layout,
            actionZones: entry.handle.actionZones,
            handle: entry.handle,
        };
        const applyValue = (nextValue: unknown): void => {
            const previousValue = entry.schema.value;
            if (propertyName) {
                (node as { setProperty?: (name: string, value: unknown) => void }).setProperty?.(
                    propertyName,
                    nextValue
                );
            }
            (
                node as {
                    onWidgetChanged?: (
                        name: string,
                        value: unknown,
                        previousValue: unknown,
                        widgetData: unknown
                    ) => void;
                    graph?: { _version?: number };
                }
            ).onWidgetChanged?.(
                entry.schema.name,
                nextValue,
                previousValue,
                widgetMeta
            );
            if ((node as { graph?: { _version?: number } }).graph) {
                (node as { graph?: { _version?: number } }).graph!._version =
                    toFiniteNumber(
                        (node as { graph?: { _version?: number } }).graph!._version
                    ) + 1;
            }
            (
                node as {
                    setDirtyCanvas?: (
                        dirtyForeground: boolean,
                        dirtyBackground?: boolean
                    ) => void;
                }
            ).setDirtyCanvas?.(true, true);
        };

        const openPropertyEditor = (): void => {
            if (!propertyName) {
                return;
            }
            const previousValue =
                (node as { properties?: Record<string, unknown> }).properties?.[
                    propertyName
                ];
            this.canvas.showEditPropertyValue?.(node, propertyName, {
                position: [event.clientX, event.clientY],
                onclose: () => {
                    const nextValue =
                        (node as { properties?: Record<string, unknown> }).properties?.[
                            propertyName
                        ];
                    if (nextValue !== previousValue) {
                        (
                            node as {
                                onWidgetChanged?: (
                                    name: string,
                                    value: unknown,
                                    previousValue: unknown,
                                    widgetData: unknown
                                ) => void;
                            }
                        ).onWidgetChanged?.(
                            entry.schema.name,
                            nextValue,
                            previousValue,
                            widgetMeta
                        );
                    }
                    this.canvas.sceneSyncController?.repaintNodeHost(node.id);
                },
            });
        };

        const actionResult = entry.renderer.performAction?.(
            {
                node: node as GraphMutationNodeLike & { id: number | string },
                host,
                schema: entry.schema,
                bounds: entry.handle.bounds,
                handle: entry.handle,
                action: part.action || "activate",
                event,
                leafer,
            },
            entry.handle
        );

        if (actionResult?.nextValue !== undefined) {
            applyValue(actionResult.nextValue);
            return;
        }
        if (actionResult?.openEditor) {
            openPropertyEditor();
            return;
        }
        if (entry.schema.type === "button") {
            const callback = entry.schema.options?.callback;
            if (typeof callback === "function") {
                setTimeout(() => {
                    callback(widgetMeta, this.canvas, node, localPos, event);
                }, 10);
            }
            (
                node as {
                    setDirtyCanvas?: (
                        dirtyForeground: boolean,
                        dirtyBackground?: boolean
                    ) => void;
                }
            ).setDirtyCanvas?.(true, true);
            return;
        }
        if (propertyName) {
            openPropertyEditor();
        }
    }

    private updateModernHover(
        host: ModernNodeHost | null,
        part: ModernNodePartHit | null
    ): void {
        if (this.hoveredModernHost && this.hoveredModernHost !== host) {
            this.hoveredModernHost.updateInteractionState({
                hovered: false,
                pressed: false,
                hoveredPart: null,
                pressedPart: null,
                dragging: false,
                resizing: false,
            });
        }

        if (!host) {
            this.hoveredModernHost = null;
            return;
        }

        host.updateInteractionState({
            hovered: true,
            hoveredPart: part,
            pressed:
                this.session?.kind === "modern-press" ||
                this.session?.kind === "node-press",
        });
        this.hoveredModernHost = host;
    }

    private resolveCursorForModernPart(
        part: ModernNodePartHit | null
    ): string {
        if (!part) {
            return "";
        }

        if (part.cursor) {
            return part.cursor;
        }

        switch (part.kind) {
            case "collapse":
            case "widget":
                return "pointer";
            case "resize":
                return "se-resize";
            case "input-port":
            case "output-port":
                return "crosshair";
            default:
                return "";
        }
    }

    private emitNodeMoved(node: DraggableNodeLike): void {
        this.canvas.graphMutationBus?.emit("node:moved", {
            graph: this.graphRef,
            nodeId: node.id,
            node,
        });
    }

    private hasLegacyInteractiveCapture(): boolean {
        return Boolean(this.canvas.node_widget || this.canvas.node_capturing_input);
    }

    private canStartNodeDrag(node: GraphMutationNodeLike | null | undefined): boolean {
        return (
            Boolean(node) &&
            Boolean(this.canvas.allow_dragnodes) &&
            !this.canvas.read_only &&
            isDraggableNode(node)
        );
    }

    private collectDragNodes(primaryNode: DraggableNodeLike): DraggableNodeLike[] {
        const selectedNodes = Object.values(
            this.canvas.selected_nodes || {}
        ).filter(isDraggableNode);

        if (!selectedNodes.length) {
            return [primaryNode];
        }

        const hasPrimaryNode = selectedNodes.some(
            (node) => node.id === primaryNode.id
        );
        return hasPrimaryNode ? selectedNodes : [primaryNode];
    }

    private collectTargets(
        hitHost: (NodeViewHost & { eventRoot: LegacyPointerTarget["nodeRoot"] }) | null
    ): LegacyPointerTarget[] {
        const targets = new Map<string, LegacyPointerTarget>();
        const pushHost = (
            nodeId: GraphMutationNodeId,
            host: (NodeViewHost & { eventRoot: LegacyPointerTarget["nodeRoot"] }) | null
        ): void => {
            if (!host) {
                return;
            }
            targets.set(String(nodeId), {
                nodeId,
                nodeRoot: host.eventRoot,
                nodePosition: this.resolveNodePosition(host.node),
            });
        };

        if (hitHost) {
            pushHost(hitHost.node.id, hitHost);
        }

        const hoveredNode = this.canvas.node_over as
            | GraphMutationNodeLike
            | null
            | undefined;
        if (hoveredNode) {
            const hoveredHost = this.toLegacyHost(
                this.hitTestService.getHostForNode(hoveredNode)
            );
            pushHost(
                hoveredNode.id,
                hoveredHost
            );
        }

        const capturedNode = this.canvas.node_capturing_input as
            | GraphMutationNodeLike
            | null
            | undefined;
        if (capturedNode) {
            const capturedHost = this.toLegacyHost(
                this.hitTestService.getHostForNode(capturedNode)
            );
            pushHost(
                capturedNode.id,
                capturedHost
            );
        }

        const widgetNode = this.canvas.node_widget?.[0] as
            | GraphMutationNodeLike
            | undefined;
        if (widgetNode) {
            const widgetHost = this.toLegacyHost(
                this.hitTestService.getHostForNode(widgetNode)
            );
            pushHost(
                widgetNode.id,
                widgetHost
            );
        }

        const draggedNode = this.canvas.node_dragged as
            | GraphMutationNodeLike
            | undefined;
        if (draggedNode) {
            const draggedHost = this.toLegacyHost(
                this.hitTestService.getHostForNode(draggedNode)
            );
            pushHost(
                draggedNode.id,
                draggedHost
            );
        }

        const resizingNode = this.canvas.resizing_node as
            | GraphMutationNodeLike
            | undefined;
        if (resizingNode) {
            const resizingHost = this.toLegacyHost(
                this.hitTestService.getHostForNode(resizingNode)
            );
            pushHost(
                resizingNode.id,
                resizingHost
            );
        }

        return Array.from(targets.values());
    }

    private toLegacyHost(
        host: NodeViewHost | null | undefined
    ): (NodeViewHost & { eventRoot: LegacyPointerTarget["nodeRoot"] }) | null {
        return isLegacyHost(host) ? host : null;
    }

    private createPointerSource(
        event: MouseEvent | PointerEvent
    ): LegacyPointerEventSource {
        const clientPoint = {
            clientX: event.clientX,
            clientY: event.clientY,
        };
        const pagePoint = this.appHost.app.getPagePointByClient(clientPoint);
        const worldPoint = this.appHost.app.getWorldPointByClient(clientPoint);

        return {
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
            buttons: event.buttons,
            target: event.target,
            current: event.currentTarget,
            time: Date.now(),
            clientX: event.clientX,
            clientY: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            screenX: event.screenX,
            screenY: event.screenY,
            left: event.button === 0 || Boolean(event.buttons & 1),
            middle: event.button === 1 || Boolean(event.buttons & 4),
            right: event.button === 2 || Boolean(event.buttons & 2),
            getPagePoint: () => pagePoint,
            getInnerPoint: (relative) => {
                if (!relative) {
                    return pagePoint;
                }
                return relative.getInnerPoint(worldPoint);
            },
            stop: () => {
                event.stopPropagation();
            },
            stopNow: () => {
                event.stopImmediatePropagation();
            },
        };
    }

    private resolveNodePosition(
        node: GraphMutationNodeLike
    ): readonly [number, number] | undefined {
        const rawPos = (node as { pos?: unknown }).pos;
        if (!rawPos || (!Array.isArray(rawPos) && !ArrayBuffer.isView(rawPos))) {
            return undefined;
        }

        const pos = rawPos as ArrayLike<unknown>;
        return [toFiniteNumber(pos[0]), toFiniteNumber(pos[1])];
    }

    private dispatchContextMenu(event: MouseEvent | PointerEvent): void {
        const source = this.createPointerSource(event);
        const graphPoint = source.getInnerPoint();
        const hit = this.hitTestService.hitNodeAt(graphPoint.x, graphPoint.y);
        const node = hit?.node || null;

        if (this.canvas.allow_interaction === false || this.canvas.read_only) {
            return;
        }

        const refWindow =
            this.canvas.getCanvasWindow?.() ||
            this.view.ownerDocument?.defaultView ||
            window;
        const liteGraphHost = (globalThis as typeof globalThis & {
            LiteGraph?: {
                closeAllContextMenus?: (refWindow?: Window) => void;
            };
        }).LiteGraph;
        liteGraphHost?.closeAllContextMenus?.(refWindow);

        if (node) {
            const selectedNodes = this.canvas.selected_nodes || {};
            if (
                Object.keys(selectedNodes).length &&
                (selectedNodes[String(node.id)] ||
                    event.shiftKey ||
                    event.ctrlKey ||
                    event.metaKey)
            ) {
                if (!selectedNodes[String(node.id)]) {
                    this.canvas.selectNodes([node], true);
                }
            } else {
                this.canvas.selectNodes([node]);
            }
            this.canvas.sceneSyncController?.repaintAllNodeHosts();
        }

        const contextMenuEvent = createNativeContextMenuEvent({
            event: source,
            hostElement: this.appHost.view,
            nativeEvent: event,
            targets: this.collectTargets(this.toLegacyHost(hit?.host || null)),
            dragging: false,
        });

        this.canvas.processContextMenu?.(node, contextMenuEvent);
    }

    private attachDocumentTracking(): void {
        if (this.documentTrackingBound) {
            return;
        }
        this.documentTrackingBound = true;
        this.doc.addEventListener(
            "pointermove",
            this.handleDocumentPointerMove,
            true
        );
        this.doc.addEventListener(
            "pointerup",
            this.handleDocumentPointerUp,
            true
        );
    }

    private detachDocumentTracking(): void {
        if (!this.documentTrackingBound) {
            return;
        }
        this.documentTrackingBound = false;
        this.doc.removeEventListener(
            "pointermove",
            this.handleDocumentPointerMove,
            true
        );
        this.doc.removeEventListener(
            "pointerup",
            this.handleDocumentPointerUp,
            true
        );
    }

    private stopEvent(event: PointerEvent, immediate = false): void {
        if (immediate) {
            event.stopImmediatePropagation();
        } else {
            event.stopPropagation();
        }
        event.preventDefault();
    }

    private stopPropagationOnly(
        event: MouseEvent | PointerEvent,
        immediate = false
    ): void {
        if (immediate) {
            event.stopImmediatePropagation();
            return;
        }
        event.stopPropagation();
    }

    private shouldHandleLegacyPointerDown(event: PointerEvent): boolean {
        return event.button === 0;
    }

    private shouldHandleLegacyPointerMove(event: PointerEvent): boolean {
        if (this.pointerIsDown) {
            return true;
        }

        if (!event.buttons) {
            return true;
        }

        return Boolean(event.buttons & 1) && !(event.buttons & ~1);
    }
}
