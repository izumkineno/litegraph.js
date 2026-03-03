import type { Vector2, Vector4 } from "../types/core-types";

export type BoundingCorners = [Vector2, Vector2];
export type BoundingLike = Vector4 | BoundingCorners;

// API *************************************************
export function compareObjects(
    a: Record<string, unknown>,
    b: Record<string, unknown>
): boolean {
    for (const i in a) {
        if (a[i] != b[i]) {
            return false;
        }
    }
    return true;
}

export function distance(a: Vector2, b: Vector2): number {
    return Math.sqrt(
        (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])
    );
}

export function isInsideRectangle(
    x: number,
    y: number,
    left: number,
    top: number,
    width: number,
    height: number
): boolean {
    if (left < x && left + width > x && top < y && top + height > y) {
        return true;
    }
    return false;
}

// [minx,miny,maxx,maxy]
export function growBounding(
    bounding: Vector4,
    x: number,
    y: number
): Vector4 {
    if (x < bounding[0]) {
        bounding[0] = x;
    } else if (x > bounding[2]) {
        bounding[2] = x;
    }

    if (y < bounding[1]) {
        bounding[1] = y;
    } else if (y > bounding[3]) {
        bounding[3] = y;
    }
    return bounding;
}

// point inside bounding box
export function isInsideBounding(p: Vector2, bb: BoundingLike): boolean {
    // Keep source behavior first: bb as [[minx,miny],[maxx,maxy]]
    if (Array.isArray(bb[0])) {
        const corners = bb as BoundingCorners;
        if (
            p[0] < corners[0][0] ||
            p[1] < corners[0][1] ||
            p[0] > corners[1][0] ||
            p[1] > corners[1][1]
        ) {
            return false;
        }
        return true;
    }

    // Compatibility branch: bb as [minx,miny,maxx,maxy]
    const flat = bb as Vector4;
    if (p[0] < flat[0] || p[1] < flat[1] || p[0] > flat[2] || p[1] > flat[3]) {
        return false;
    }
    return true;
}

// bounding overlap, format: [ startx, starty, width, height ]
export function overlapBounding(a: Vector4, b: Vector4): boolean {
    const aEndX = a[0] + a[2];
    const aEndY = a[1] + a[3];
    const bEndX = b[0] + b[2];
    const bEndY = b[1] + b[3];

    if (a[0] > bEndX || a[1] > bEndY || aEndX < b[0] || aEndY < b[1]) {
        return false;
    }
    return true;
}

