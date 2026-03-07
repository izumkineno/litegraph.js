import type {
    GraphMutationGraphLike,
    GraphMutationNodeId,
    GraphMutationNodeLike,
} from "./GraphMutationBus";
import { HitTestService } from "./HitTestService";
import type { LeaferAppHost } from "./LeaferAppHost";
import {
    createLegacyPointerEvent,
    type LegacyPointerEventSource,
    type LegacyPointerTarget,
} from "./LegacyPointerEventAdapter";
import type { LegacyNodeHost } from "./LegacyNodeHost";
import type { SceneSyncController } from "./SceneSyncController";

interface InteractionCanvasHost {
    readonly graph: GraphMutationGraphLike | null;
    readonly leaferAppHost: LeaferAppHost | null;
    readonly sceneSyncController: SceneSyncController | null;
    readonly node_widget: [unknown, unknown] | null;
    readonly node_capturing_input: unknown;
    readonly node_over: unknown;
    processMouseDown: (event: unknown) => boolean | undefined;
    processMouseMove: (event: unknown) => boolean | undefined;
    processMouseUp: (event: unknown) => boolean | undefined;
}

export class InteractionController {
    private readonly hitTestService: HitTestService;
    private readonly view: HTMLElement;
    private readonly doc: Document;
    private pointerDownAt = 0;
    private pointerIsDown = false;
    private lastPagePoint: { x: number; y: number } | null = null;
    private documentTrackingBound = false;

    constructor(
        graph: GraphMutationGraphLike,
        private readonly canvas: InteractionCanvasHost,
        private readonly appHost: LeaferAppHost,
        sceneSyncController: SceneSyncController
    ) {
        this.hitTestService = new HitTestService(graph, sceneSyncController);
        this.view = this.appHost.view;
        this.doc = this.view.ownerDocument || document;

        this.view.addEventListener("pointerdown", this.handleViewPointerDown, true);
        this.view.addEventListener("pointermove", this.handleViewPointerMove, true);
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
        this.detachDocumentTracking();
        this.pointerIsDown = false;
        this.pointerDownAt = 0;
        this.lastPagePoint = null;
    }

    private readonly handleViewPointerDown = (event: PointerEvent): void => {
        const source = this.createPointerSource(event);
        const pagePoint = source.getPagePoint();
        const hit = this.hitTestService.hitLegacyNodeAt(pagePoint.x, pagePoint.y);
        const targets = this.collectTargets(hit?.host || null);
        if (!targets.length) {
            return;
        }

        this.pointerIsDown = true;
        this.pointerDownAt = Date.now();
        this.lastPagePoint = {
            x: Number(pagePoint.x) || 0,
            y: Number(pagePoint.y) || 0,
        };
        this.attachDocumentTracking();

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
        this.stopEvent(event);
    };

    private readonly handleViewPointerMove = (event: PointerEvent): void => {
        if (this.pointerIsDown) {
            return;
        }
        this.dispatchPointerMove(event);
    };

    private readonly handleDocumentPointerMove = (event: PointerEvent): void => {
        this.dispatchPointerMove(event);
    };

    private dispatchPointerMove(event: PointerEvent): void {
        const source = this.createPointerSource(event);
        const pagePoint = source.getPagePoint();
        const hit = this.hitTestService.hitLegacyNodeAt(pagePoint.x, pagePoint.y);
        const targets = this.collectTargets(hit?.host || null);
        const shouldDispatch =
            targets.length > 0 ||
            Boolean(this.canvas.node_widget) ||
            Boolean(this.canvas.node_over) ||
            Boolean(this.canvas.node_capturing_input);

        const deltaX = this.lastPagePoint
            ? (Number(pagePoint.x) || 0) - this.lastPagePoint.x
            : 0;
        const deltaY = this.lastPagePoint
            ? (Number(pagePoint.y) || 0) - this.lastPagePoint.y
            : 0;
        this.lastPagePoint = {
            x: Number(pagePoint.x) || 0,
            y: Number(pagePoint.y) || 0,
        };

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

    private readonly handleDocumentPointerUp = (event: PointerEvent): void => {
        const source = this.createPointerSource(event);
        const pagePoint = source.getPagePoint();
        const hit = this.hitTestService.hitLegacyNodeAt(pagePoint.x, pagePoint.y);
        const targets = this.collectTargets(hit?.host || null);
        const shouldDispatch =
            this.pointerIsDown ||
            targets.length > 0 ||
            Boolean(this.canvas.node_widget) ||
            Boolean(this.canvas.node_over) ||
            Boolean(this.canvas.node_capturing_input);

        const deltaX = this.lastPagePoint
            ? (Number(pagePoint.x) || 0) - this.lastPagePoint.x
            : 0;
        const deltaY = this.lastPagePoint
            ? (Number(pagePoint.y) || 0) - this.lastPagePoint.y
            : 0;

        this.lastPagePoint = {
            x: Number(pagePoint.x) || 0,
            y: Number(pagePoint.y) || 0,
        };

        if (shouldDispatch) {
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

        this.pointerIsDown = false;
        this.pointerDownAt = 0;
        this.detachDocumentTracking();
    };

    private collectTargets(
        hitHost: LegacyNodeHost | null
    ): LegacyPointerTarget[] {
        const targets = new Map<string, LegacyPointerTarget>();
        const pushHost = (
            nodeId: GraphMutationNodeId,
            host: LegacyNodeHost | null
        ): void => {
            if (!host) {
                return;
            }
            targets.set(String(nodeId), {
                nodeId,
                nodeRoot: host.eventRoot,
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
            pushHost(
                hoveredNode.id,
                this.hitTestService.getLegacyHostForNode(hoveredNode)
            );
        }

        const capturedNode = this.canvas.node_capturing_input as
            | GraphMutationNodeLike
            | null
            | undefined;
        if (capturedNode) {
            pushHost(
                capturedNode.id,
                this.hitTestService.getLegacyHostForNode(capturedNode)
            );
        }

        const widgetNode = this.canvas.node_widget?.[0] as
            | GraphMutationNodeLike
            | undefined;
        if (widgetNode) {
            pushHost(
                widgetNode.id,
                this.hitTestService.getLegacyHostForNode(widgetNode)
            );
        }

        return Array.from(targets.values());
    }

    private createPointerSource(event: PointerEvent): LegacyPointerEventSource {
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
            left: event.button === 0 || Boolean(event.buttons & 1),
            middle: event.button === 1 || Boolean(event.buttons & 4),
            right: event.button === 2 || Boolean(event.buttons & 2),
            getPagePoint: () => pagePoint,
            getInnerPoint: (relative) => {
                if (!relative) {
                    return worldPoint;
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

    private stopEvent(event: PointerEvent): void {
        event.stopPropagation();
        event.preventDefault();
    }
}
