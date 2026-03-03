export function clamp(v: number, a: number, b: number): number {
    return a > v ? a : b < v ? b : v;
}

/**
 * Source runtime exposes `clamp` through global scope.
 * This helper keeps that behavior optional and explicit in migration layer.
 */
export function attachClampToGlobal(globalScope: Record<string, unknown>): void {
    globalScope.clamp = clamp;
}

