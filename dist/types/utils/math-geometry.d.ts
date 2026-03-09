import type { Vector2, Vector4 } from "../types/core-types";
export type BoundingCorners = [Vector2, Vector2];
export type BoundingLike = Vector4 | BoundingCorners;
export declare function compareObjects(a: Record<string, unknown>, b: Record<string, unknown>): boolean;
export declare function distance(a: Vector2, b: Vector2): number;
export declare function isInsideRectangle(x: number, y: number, left: number, top: number, width: number, height: number): boolean;
export declare function growBounding(bounding: Vector4, x: number, y: number): Vector4;
export declare function isInsideBounding(p: Vector2, bb: BoundingLike): boolean;
export declare function overlapBounding(a: Vector4, b: Vector4): boolean;
