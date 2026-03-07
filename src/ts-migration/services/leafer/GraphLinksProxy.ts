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
    onLinkRemoved: (
        linkId: GraphMutationLinkId,
        link: GraphMutationLinkLike
    ) => void;
}

function normalizeLinkKey(property: PropertyKey): string | null {
    if (typeof property === "symbol") {
        return null;
    }
    return String(property);
}

function isPlainRecord(
    value: unknown
): value is Record<string, GraphMutationLinkLike> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLinkLike(value: unknown): value is GraphMutationLinkLike {
    if (!value || typeof value !== "object") {
        return false;
    }

    const link = value as Partial<GraphMutationLinkLike>;
    return (
        link.id !== undefined &&
        link.origin_id !== undefined &&
        typeof link.origin_slot === "number" &&
        link.target_id !== undefined &&
        typeof link.target_slot === "number"
    );
}

export class GraphLinksProxy {
    private currentTarget: Record<string, GraphMutationLinkLike>;
    private proxy: Record<string, GraphMutationLinkLike>;

    constructor(
        private readonly graph: GraphLinksProxyGraphLike,
        private readonly handlers: GraphLinksProxyHandlers
    ) {
        this.currentTarget = this.normalizeTarget(graph.links);
        this.proxy = this.createProxy(this.currentTarget);

        Object.defineProperty(this.graph, "links", {
            configurable: true,
            enumerable: true,
            get: () => this.proxy,
            set: (nextValue: unknown) => {
                this.replaceTarget(nextValue, true);
            },
        });
    }

    destroy(): void {
        const rawTarget = this.currentTarget;
        delete (this.graph as unknown as Record<string, unknown>).links;
        (this.graph as unknown as Record<string, unknown>).links = rawTarget;
    }

    private replaceTarget(nextValue: unknown, emitMutations: boolean): void {
        if (emitMutations) {
            for (const [linkId, link] of Object.entries(this.currentTarget)) {
                if (isLinkLike(link)) {
                    this.handlers.onLinkRemoved(linkId, link);
                }
            }
        }

        this.currentTarget = this.normalizeTarget(nextValue);
        this.proxy = this.createProxy(this.currentTarget);

        if (emitMutations) {
            for (const [linkId, link] of Object.entries(this.currentTarget)) {
                if (isLinkLike(link)) {
                    this.handlers.onLinkAdded(linkId, link);
                }
            }
        }
    }

    private normalizeTarget(
        value: unknown
    ): Record<string, GraphMutationLinkLike> {
        if (isPlainRecord(value)) {
            return value;
        }
        return {};
    }

    private createProxy(
        target: Record<string, GraphMutationLinkLike>
    ): Record<string, GraphMutationLinkLike> {
        return new Proxy(target, {
            set: (innerTarget, property, value) => {
                const key = normalizeLinkKey(property);
                const previousValue =
                    key == null ? undefined : innerTarget[key];
                const didSet = Reflect.set(
                    innerTarget,
                    property,
                    value as GraphMutationLinkLike
                );

                if (!didSet || key == null) {
                    return didSet;
                }

                if (isLinkLike(previousValue) && previousValue !== value) {
                    this.handlers.onLinkRemoved(key, previousValue);
                }
                if (isLinkLike(value)) {
                    this.handlers.onLinkAdded(key, value);
                }

                return true;
            },
            deleteProperty: (innerTarget, property) => {
                const key = normalizeLinkKey(property);
                const previousValue =
                    key == null ? undefined : innerTarget[key];
                const didDelete = Reflect.deleteProperty(innerTarget, property);

                if (didDelete && key != null && isLinkLike(previousValue)) {
                    this.handlers.onLinkRemoved(key, previousValue);
                }

                return didDelete;
            },
        });
    }
}
