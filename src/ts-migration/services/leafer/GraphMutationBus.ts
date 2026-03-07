import {
    GraphLinksProxy,
    type GraphLinksProxyGraphLike,
    type GraphMutationLinkId,
    type GraphMutationLinkLike,
    type GraphMutationNodeId,
} from "./GraphLinksProxy";

export type {
    GraphMutationLinkId,
    GraphMutationLinkLike,
    GraphMutationNodeId,
};

export interface GraphMutationNodeLike {
    id: GraphMutationNodeId;
    [key: string]: unknown;
}

export interface GraphMutationGraphLike extends GraphLinksProxyGraphLike {
    _nodes?: GraphMutationNodeLike[];
    onNodeAdded?: ((node: GraphMutationNodeLike) => void) | null;
    onNodeRemoved?: ((node: GraphMutationNodeLike) => void) | null;
    clear?: (...args: unknown[]) => unknown;
}

export interface GraphMutationEventMap {
    "graph:clear": {
        graph: GraphMutationGraphLike;
    };
    "node:add": {
        graph: GraphMutationGraphLike;
        nodeId: GraphMutationNodeId;
        node: GraphMutationNodeLike;
    };
    "node:remove": {
        graph: GraphMutationGraphLike;
        nodeId: GraphMutationNodeId;
        node: GraphMutationNodeLike;
    };
    "node:dirty": {
        graph: GraphMutationGraphLike;
        nodeId: GraphMutationNodeId;
        node: GraphMutationNodeLike;
        dirtyForeground?: boolean;
        dirtyBackground?: boolean;
    };
    "link:add": {
        graph: GraphMutationGraphLike;
        linkId: GraphMutationLinkId;
        link: GraphMutationLinkLike;
    };
    "link:remove": {
        graph: GraphMutationGraphLike;
        linkId: GraphMutationLinkId;
        link: GraphMutationLinkLike;
    };
}

export type GraphMutationEventName = keyof GraphMutationEventMap;
export type GraphMutationListener<TEvent extends GraphMutationEventName> = (
    payload: GraphMutationEventMap[TEvent]
) => void;

type GraphInstrumentationListener = <
    TEvent extends GraphMutationEventName,
>(
    eventName: TEvent,
    payload: GraphMutationEventMap[TEvent]
) => void;

interface GraphInstrumentationState {
    graph: GraphMutationGraphLike;
    refCount: number;
    listeners: Set<GraphInstrumentationListener>;
    nodeAddedBridge: (node: GraphMutationNodeLike) => void;
    nodeRemovedBridge: (node: GraphMutationNodeLike) => void;
    clearBridge: (...args: unknown[]) => unknown;
    linksProxy: GraphLinksProxy;
    hadOwnOnNodeAdded: boolean;
    hadOwnOnNodeRemoved: boolean;
    hadOwnClear: boolean;
    userOnNodeAdded?: ((node: GraphMutationNodeLike) => void) | null;
    userOnNodeRemoved?: ((node: GraphMutationNodeLike) => void) | null;
    originalClear?: (...args: unknown[]) => unknown;
}

const instrumentedGraphs = new WeakMap<
    GraphMutationGraphLike,
    GraphInstrumentationState
>();

function dispatchGraphMutation<TEvent extends GraphMutationEventName>(
    state: GraphInstrumentationState,
    eventName: TEvent,
    payload: GraphMutationEventMap[TEvent]
): void {
    for (const listener of Array.from(state.listeners)) {
        listener(eventName, payload);
    }
}

function restoreGraphHook(
    graph: GraphMutationGraphLike,
    key: "onNodeAdded" | "onNodeRemoved",
    hadOwnProperty: boolean,
    userHook?: ((node: GraphMutationNodeLike) => void) | null
): void {
    delete (graph as unknown as Record<string, unknown>)[key];

    if (hadOwnProperty || typeof userHook === "function") {
        (graph as unknown as Record<string, unknown>)[key] =
            userHook || undefined;
    }
}

function teardownGraphInstrumentation(
    state: GraphInstrumentationState
): void {
    const { graph } = state;

    state.linksProxy.destroy();
    restoreGraphHook(
        graph,
        "onNodeAdded",
        state.hadOwnOnNodeAdded,
        state.userOnNodeAdded
    );
    restoreGraphHook(
        graph,
        "onNodeRemoved",
        state.hadOwnOnNodeRemoved,
        state.userOnNodeRemoved
    );

    delete (graph as unknown as Record<string, unknown>).clear;
    if (state.hadOwnClear && state.originalClear) {
        (graph as unknown as Record<string, unknown>).clear =
            state.originalClear;
    }

    instrumentedGraphs.delete(graph);
}

function instrumentGraph(
    graph: GraphMutationGraphLike
): GraphInstrumentationState {
    const existing = instrumentedGraphs.get(graph);
    if (existing) {
        return existing;
    }

    const state = {} as GraphInstrumentationState;
    state.graph = graph;
    state.refCount = 0;
    state.listeners = new Set<GraphInstrumentationListener>();
    state.hadOwnOnNodeAdded = Object.prototype.hasOwnProperty.call(
        graph,
        "onNodeAdded"
    );
    state.hadOwnOnNodeRemoved = Object.prototype.hasOwnProperty.call(
        graph,
        "onNodeRemoved"
    );
    state.hadOwnClear = Object.prototype.hasOwnProperty.call(graph, "clear");
    state.userOnNodeAdded =
        typeof graph.onNodeAdded === "function" ? graph.onNodeAdded : null;
    state.userOnNodeRemoved =
        typeof graph.onNodeRemoved === "function" ? graph.onNodeRemoved : null;
    state.originalClear =
        typeof graph.clear === "function" ? graph.clear.bind(graph) : undefined;

    state.nodeAddedBridge = (node: GraphMutationNodeLike) => {
        state.userOnNodeAdded?.call(graph, node);
        dispatchGraphMutation(state, "node:add", {
            graph,
            nodeId: node.id,
            node,
        });
    };

    state.nodeRemovedBridge = (node: GraphMutationNodeLike) => {
        state.userOnNodeRemoved?.call(graph, node);
        dispatchGraphMutation(state, "node:remove", {
            graph,
            nodeId: node.id,
            node,
        });
    };

    state.clearBridge = (...args: unknown[]) => {
        const result = state.originalClear?.(...args);
        dispatchGraphMutation(state, "graph:clear", {
            graph,
        });
        return result;
    };

    Object.defineProperty(graph, "onNodeAdded", {
        configurable: true,
        enumerable: true,
        get: () => state.nodeAddedBridge,
        set: (nextHook: unknown) => {
            state.userOnNodeAdded =
                typeof nextHook === "function"
                    ? (nextHook as (node: GraphMutationNodeLike) => void)
                    : null;
        },
    });

    Object.defineProperty(graph, "onNodeRemoved", {
        configurable: true,
        enumerable: true,
        get: () => state.nodeRemovedBridge,
        set: (nextHook: unknown) => {
            state.userOnNodeRemoved =
                typeof nextHook === "function"
                    ? (nextHook as (node: GraphMutationNodeLike) => void)
                    : null;
        },
    });

    (graph as unknown as Record<string, unknown>).clear = state.clearBridge;
    state.linksProxy = new GraphLinksProxy(graph, {
        onLinkAdded: (linkId, link) => {
            dispatchGraphMutation(state, "link:add", {
                graph,
                linkId,
                link,
            });
        },
        onLinkRemoved: (linkId, link) => {
            dispatchGraphMutation(state, "link:remove", {
                graph,
                linkId,
                link,
            });
        },
    });

    instrumentedGraphs.set(graph, state);
    return state;
}

export class GraphMutationBus {
    readonly graph: GraphMutationGraphLike;

    private readonly listeners = new Map<
        GraphMutationEventName,
        Set<GraphMutationListener<GraphMutationEventName>>
    >();
    private readonly instrumentationState: GraphInstrumentationState;
    private readonly bridgeListener: GraphInstrumentationListener;
    private destroyed = false;

    constructor(graph: GraphMutationGraphLike) {
        this.graph = graph;
        this.instrumentationState = instrumentGraph(graph);
        this.instrumentationState.refCount += 1;

        this.bridgeListener = (eventName, payload) => {
            this.emit(eventName, payload);
        };
        this.instrumentationState.listeners.add(this.bridgeListener);
    }

    on<TEvent extends GraphMutationEventName>(
        eventName: TEvent,
        listener: GraphMutationListener<TEvent>
    ): () => void {
        const listeners =
            this.listeners.get(eventName) ||
            new Set<GraphMutationListener<GraphMutationEventName>>();
        listeners.add(
            listener as GraphMutationListener<GraphMutationEventName>
        );
        this.listeners.set(eventName, listeners);

        return () => {
            listeners.delete(
                listener as GraphMutationListener<GraphMutationEventName>
            );
            if (!listeners.size) {
                this.listeners.delete(eventName);
            }
        };
    }

    emit<TEvent extends GraphMutationEventName>(
        eventName: TEvent,
        payload: GraphMutationEventMap[TEvent]
    ): void {
        const listeners = this.listeners.get(eventName);
        if (!listeners || !listeners.size) {
            return;
        }

        for (const listener of Array.from(listeners)) {
            (
                listener as GraphMutationListener<TEvent>
            )(payload);
        }
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.listeners.clear();
        this.instrumentationState.listeners.delete(this.bridgeListener);
        this.instrumentationState.refCount -= 1;

        if (this.instrumentationState.refCount <= 0) {
            teardownGraphInstrumentation(this.instrumentationState);
        }
    }
}
