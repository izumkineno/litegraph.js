type HostOwner = object | Function;
type HostFallbackResolver = () => HostOwner | null | undefined;
export interface ClassHostResolverOptions<TSource extends object, TResolved extends object = TSource> {
    cacheKey?: string;
    fallbackOwners?: ReadonlyArray<HostFallbackResolver>;
    hostField?: string;
    transform?: (merged: TSource, source?: Partial<TSource>) => TResolved;
}
export declare function createClassHostResolver<TSource extends object, TResolved extends object = TSource>(defaults: TSource, options?: ClassHostResolverOptions<TSource, TResolved>): (owner: HostOwner) => TResolved;
export declare function invalidateResolvedClassHost(owner: HostOwner, cacheKey?: string): void;
export {};
