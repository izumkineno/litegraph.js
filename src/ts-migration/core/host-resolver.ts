type HostOwner = object | Function;
type HostFallbackResolver = () => HostOwner | null | undefined;

interface CachedHostEntry<TResolved extends object, TSource extends object> {
    defaultsRef: TSource;
    sourceRefs: Array<Partial<TSource> | undefined>;
    value: TResolved;
}

export interface ClassHostResolverOptions<
    TSource extends object,
    TResolved extends object = TSource,
> {
    cacheKey?: string;
    fallbackOwners?: ReadonlyArray<HostFallbackResolver>;
    hostField?: string;
    transform?: (merged: TSource, source?: Partial<TSource>) => TResolved;
}

const classHostCache = new WeakMap<
    Function,
    Map<string, CachedHostEntry<object, object>>
>();

function resolveOwnerConstructor(owner: HostOwner): Function | null {
    if (typeof owner === "function") {
        return owner;
    }
    if (!owner || typeof owner !== "object") {
        return null;
    }
    const ctor = (owner as { constructor?: unknown }).constructor;
    return typeof ctor === "function" ? ctor : null;
}

function resolveHostSource<TSource extends object>(
    owner: HostOwner | null | undefined,
    hostField: string
): Partial<TSource> | undefined {
    if (!owner) {
        return undefined;
    }
    const ctor = resolveOwnerConstructor(owner);
    if (!ctor) {
        return undefined;
    }
    return (ctor as unknown as Record<string, unknown>)[hostField] as
        | Partial<TSource>
        | undefined;
}

export function createClassHostResolver<
    TSource extends object,
    TResolved extends object = TSource,
>(
    defaults: TSource,
    options?: ClassHostResolverOptions<TSource, TResolved>
): (owner: HostOwner) => TResolved {
    const hostField = options?.hostField || "liteGraph";
    const cacheKey = options?.cacheKey || hostField;
    const fallbackOwners = options?.fallbackOwners || [];
    const transform =
        options?.transform ||
        ((merged: TSource): TResolved => merged as unknown as TResolved);

    return function resolveClassHost(owner: HostOwner): TResolved {
        const ctor = resolveOwnerConstructor(owner);
        if (!ctor) {
            return transform(defaults);
        }

        let bucket = classHostCache.get(ctor);
        if (!bucket) {
            bucket = new Map<string, CachedHostEntry<object, object>>();
            classHostCache.set(ctor, bucket);
        }

        const cached = bucket.get(cacheKey) as
            | CachedHostEntry<TResolved, TSource>
            | undefined;
        if (cached && cached.defaultsRef === defaults) {
            let cacheMatches = cached.sourceRefs.length === fallbackOwners.length + 1;
            if (cacheMatches) {
                for (let i = 0; i < fallbackOwners.length; ++i) {
                    if (
                        cached.sourceRefs[i] !==
                        resolveHostSource<TSource>(fallbackOwners[i](), hostField)
                    ) {
                        cacheMatches = false;
                        break;
                    }
                }
            }
            if (
                cacheMatches &&
                cached.sourceRefs[fallbackOwners.length] ===
                    resolveHostSource<TSource>(ctor, hostField)
            ) {
                return cached.value;
            }
        }

        const sourceRefs: Array<Partial<TSource> | undefined> = [];
        let merged = defaults;
        let didMerge = false;
        let lastSource: Partial<TSource> | undefined;

        for (let i = 0; i < fallbackOwners.length; ++i) {
            const source = resolveHostSource<TSource>(fallbackOwners[i](), hostField);
            sourceRefs.push(source);
            if (!source) {
                continue;
            }
            merged = didMerge
                ? ({ ...merged, ...source } as TSource)
                : ({ ...defaults, ...source } as TSource);
            didMerge = true;
            lastSource = source;
        }

        const ownerSource = resolveHostSource<TSource>(ctor, hostField);
        sourceRefs.push(ownerSource);
        if (ownerSource) {
            merged = didMerge
                ? ({ ...merged, ...ownerSource } as TSource)
                : ({ ...defaults, ...ownerSource } as TSource);
            didMerge = true;
            lastSource = ownerSource;
        }

        const value = transform(merged, lastSource);

        bucket.set(cacheKey, {
            defaultsRef: defaults,
            sourceRefs,
            value,
        });

        return value;
    };
}

export function invalidateResolvedClassHost(
    owner: HostOwner,
    cacheKey?: string
): void {
    const ctor = resolveOwnerConstructor(owner);
    if (!ctor) {
        return;
    }
    const bucket = classHostCache.get(ctor);
    if (!bucket) {
        return;
    }
    if (cacheKey) {
        bucket.delete(cacheKey);
        if (bucket.size === 0) {
            classHostCache.delete(ctor);
        }
        return;
    }
    classHostCache.delete(ctor);
}
