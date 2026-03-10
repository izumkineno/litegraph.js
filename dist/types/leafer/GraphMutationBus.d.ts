import { type GraphLinksProxyGraphLike, type GraphMutationLinkId, type GraphMutationLinkLike, type GraphMutationNodeId } from "./GraphLinksProxy";
export type { GraphMutationLinkId, GraphMutationLinkLike, GraphMutationNodeId, };
export interface GraphMutationNodeLike {
    id: GraphMutationNodeId;
    [key: string]: unknown;
}
export interface GraphMutationGroupLike {
    title?: string;
    color?: string;
    font_size?: number;
    graph?: GraphMutationGraphLike | null;
    _bounding?: ArrayLike<unknown>;
    _pos?: ArrayLike<unknown>;
    _size?: ArrayLike<unknown>;
    _nodes?: GraphMutationNodeLike[];
    pos?: ArrayLike<unknown>;
    size?: ArrayLike<unknown>;
    move?: (deltaX: number, deltaY: number, ignoreNodes?: boolean) => void;
    recomputeInsideNodes?: () => void;
    isPointInside?: (x: number, y: number, margin?: number, skipTitle?: boolean) => boolean;
    setDirtyCanvas?: (dirtyForeground: boolean, dirtyBackground?: boolean) => void;
    [key: string]: unknown;
}
export interface GraphMutationGraphLike extends GraphLinksProxyGraphLike {
    _nodes?: GraphMutationNodeLike[];
    _groups?: GraphMutationGroupLike[];
    onNodeAdded?: ((node: GraphMutationNodeLike) => void) | null;
    onNodeRemoved?: ((node: GraphMutationNodeLike) => void) | null;
    add?: (...args: unknown[]) => unknown;
    remove?: (...args: unknown[]) => unknown;
    clear?: (...args: unknown[]) => unknown;
    __litegraphBeginSceneBatch?: () => void;
    __litegraphEndSceneBatch?: () => void;
    __litegraphRunSceneBatch?: <T>(work: () => T) => T;
}
export interface GraphMutationEventMap {
    "graph:clear": {
        graph: GraphMutationGraphLike;
    };
    "graph:hydrate": {
        graph: GraphMutationGraphLike;
        sceneAlreadyCleared: boolean;
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
    "node:moved": {
        graph: GraphMutationGraphLike;
        nodeId: GraphMutationNodeId;
        node: GraphMutationNodeLike;
    };
    "group:add": {
        graph: GraphMutationGraphLike;
        group: GraphMutationGroupLike;
    };
    "group:remove": {
        graph: GraphMutationGraphLike;
        group: GraphMutationGroupLike;
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
export type GraphMutationListener<TEvent extends GraphMutationEventName> = (payload: GraphMutationEventMap[TEvent]) => void;
export declare class GraphMutationBus {
    readonly graph: GraphMutationGraphLike;
    private readonly listeners;
    private readonly instrumentationState;
    private readonly bridgeListener;
    private destroyed;
    constructor(graph: GraphMutationGraphLike);
    on<TEvent extends GraphMutationEventName>(eventName: TEvent, listener: GraphMutationListener<TEvent>): () => void;
    emit<TEvent extends GraphMutationEventName>(eventName: TEvent, payload: GraphMutationEventMap[TEvent]): void;
    destroy(): void;
}
