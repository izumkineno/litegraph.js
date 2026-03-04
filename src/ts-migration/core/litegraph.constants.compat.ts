export const GRID_SQUARE_SHAPE_DIFF_ID = "constants.grid-square-alias" as const;
export const GRID_SQUARE_SHAPE_DEFAULT = 6;

export type GridSquareShapeSource = "GRID_SHAPE" | "SQUARE_SHAPE" | "fallback";

export interface LiteGraphShapeAliasHost {
    GRID_SHAPE?: number;
    SQUARE_SHAPE?: number;
    [key: string]: unknown;
}

export interface GridSquareShapeAliasResult {
    diffId: typeof GRID_SQUARE_SHAPE_DIFF_ID;
    value: number;
    source: GridSquareShapeSource;
    changed: boolean;
}

/**
 * Resolve the canonical slot-grid shape value from runtime host values.
 * Runtime source of truth in JS is `GRID_SHAPE`; d.ts uses `SQUARE_SHAPE`.
 */
export function resolveGridSquareShapeValue(
    host: LiteGraphShapeAliasHost,
    fallbackValue = GRID_SQUARE_SHAPE_DEFAULT
): { value: number; source: GridSquareShapeSource } {
    if (typeof host.GRID_SHAPE === "number") {
        return { value: host.GRID_SHAPE, source: "GRID_SHAPE" };
    }
    if (typeof host.SQUARE_SHAPE === "number") {
        return { value: host.SQUARE_SHAPE, source: "SQUARE_SHAPE" };
    }
    return { value: fallbackValue, source: "fallback" };
}

/**
 * Task 37 compatibility layer:
 * enforce alias parity between `GRID_SHAPE` (runtime) and `SQUARE_SHAPE` (d.ts).
 */
export function applyGridSquareShapeAlias(
    host: LiteGraphShapeAliasHost,
    fallbackValue = GRID_SQUARE_SHAPE_DEFAULT
): GridSquareShapeAliasResult {
    const beforeGrid = host.GRID_SHAPE;
    const beforeSquare = host.SQUARE_SHAPE;
    const resolved = resolveGridSquareShapeValue(host, fallbackValue);

    host.GRID_SHAPE = resolved.value;
    host.SQUARE_SHAPE = resolved.value;

    return {
        diffId: GRID_SQUARE_SHAPE_DIFF_ID,
        value: resolved.value,
        source: resolved.source,
        changed:
            beforeGrid !== host.GRID_SHAPE || beforeSquare !== host.SQUARE_SHAPE,
    };
}

export function isGridSquareShapeAliasSynced(
    host: LiteGraphShapeAliasHost
): boolean {
    return (
        typeof host.GRID_SHAPE === "number" &&
        typeof host.SQUARE_SHAPE === "number" &&
        host.GRID_SHAPE === host.SQUARE_SHAPE
    );
}
