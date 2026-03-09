export type GraphMutationNodeId = number | string;
export type GraphMutationLinkId = number | string;
export interface GraphMutationLinkLike {
    id: GraphMutationLinkId;
    origin_id: GraphMutationNodeId;
    origin_slot: number;
    target_id: GraphMutationNodeId;
    target_slot: number;
    type?: unknown;
    [key: string]: unknown;
}
export interface GraphLinksProxyGraphLike {
    links: Record<string, GraphMutationLinkLike>;
}
export interface GraphLinksProxyHandlers {
    onLinkAdded: (linkId: GraphMutationLinkId, link: GraphMutationLinkLike) => void;
    onLinkRemoved: (linkId: GraphMutationLinkId, link: GraphMutationLinkLike) => void;
}
export declare class GraphLinksProxy {
    private readonly graph;
    private readonly handlers;
    private currentTarget;
    private proxy;
    constructor(graph: GraphLinksProxyGraphLike, handlers: GraphLinksProxyHandlers);
    destroy(): void;
    private replaceTarget;
    private normalizeTarget;
    private createProxy;
}
