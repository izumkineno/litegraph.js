import * as leafer from "leafer-ui";
import { Group, Rect, Text, UI } from "leafer-ui";

import type { GraphMutationNodeLike } from "./GraphMutationBus";
import {
    PORT_DIRECTION_LEFT,
    PORT_DIRECTION_RIGHT,
} from "./NodePortAdapter";
import type {
    NodeViewHost,
    NodeViewPortHit,
    NodeViewPortKind,
} from "./NodeViewHost";

export interface ModernNodePortLayout {
    x: number;
    y: number;
    dir?: number;
    radius?: number;
    space?: "local" | "world";
}

export interface ModernNodeBuildContext {
    readonly node: ModernNodeLike;
    readonly host: ModernNodeHost;
    readonly root: Group;
    readonly content: UI | Group | null;
    readonly leafer: typeof leafer;
}

export interface ModernNodeLike extends GraphMutationNodeLike {
    pos: [number, number] | Float32Array;
    size: [number, number] | Float32Array;
    title?: string;
    inputs?: Array<unknown> | null;
    outputs?: Array<unknown> | null;
    buildUI?: (context: ModernNodeBuildContext) => unknown;
    updateUI?: (context: ModernNodeBuildContext) => void;
    getPortLayout?: (
        kind: NodeViewPortKind,
        slotIndex: number,
        context: ModernNodeBuildContext
    ) => ModernNodePortLayout | null;
    getConnectionPos?: (
        isInput: boolean,
        slotIndex: number,
        out?: [number, number]
    ) => [number, number] | Float32Array;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toPoint(value: unknown): [number, number] | null {
    if (
        value &&
        typeof value === "object" &&
        ("0" in (value as Record<string, unknown>) ||
            ArrayBuffer.isView(value as ArrayBufferView))
    ) {
        const indexed = value as ArrayLike<unknown>;
        return [toFiniteNumber(indexed[0]), toFiniteNumber(indexed[1])];
    }

    if (
        value &&
        typeof value === "object" &&
        "x" in (value as Record<string, unknown>) &&
        "y" in (value as Record<string, unknown>)
    ) {
        const point = value as { x?: unknown; y?: unknown };
        return [toFiniteNumber(point.x), toFiniteNumber(point.y)];
    }

    return null;
}

function createFallbackContent(node: ModernNodeLike): Group {
    const width = Math.max(toFiniteNumber(node.size?.[0], 160), 120);
    const height = Math.max(toFiniteNumber(node.size?.[1], 80), 60);
    const group = new Group({
        name: `litegraph-modern-node-fallback:${String(node.id)}`,
        hittable: false,
    });
    group.add([
        new Rect({
            x: 0,
            y: 0,
            width,
            height,
            cornerRadius: 14,
            fill: "#1F2733",
            stroke: "#87B6FF",
            strokeWidth: 2,
            hittable: false,
        }),
        new Text({
            x: 14,
            y: 12,
            text: String(node.title || node.id || "Modern Node"),
            fontSize: 16,
            fontWeight: "bold",
            fill: "#F7FAFF",
            hittable: false,
        }),
    ]);
    return group;
}

function toUI(result: unknown, node: ModernNodeLike): UI | Group {
    if (result instanceof UI) {
        return result;
    }

    if (result && typeof result === "object") {
        return new Group(result as Record<string, unknown>);
    }

    return createFallbackContent(node);
}

export class ModernNodeHost implements NodeViewHost {
    readonly runtime = "modern" as const;
    readonly node: ModernNodeLike;
    readonly root: Group;

    private content: UI | Group | null = null;

    constructor(node: ModernNodeLike) {
        this.node = node;
        this.root = new Group({
            name: `litegraph-modern-node:${String(node.id)}`,
            hittable: true,
            data: {
                litegraphNodeId: String(node.id),
                litegraphRuntime: "modern",
            },
        });

        this.repaint();
    }

    repaint(): void {
        if (!this.content) {
            const built = this.node.buildUI?.(this.createContext()) || null;
            this.content = toUI(built, this.node);
            this.root.add(this.content);
        }

        this.node.updateUI?.(this.createContext());
        this.syncPosition();
    }

    syncPosition(): void {
        this.root.x = toFiniteNumber(this.node.pos?.[0]);
        this.root.y = toFiniteNumber(this.node.pos?.[1]);
    }

    destroy(): void {
        this.root.destroy();
    }

    getPortAnchor(
        kind: NodeViewPortKind,
        slotIndex: number
    ): readonly [number, number] | null {
        const layout = this.resolvePortLayout(kind, slotIndex);
        if (layout) {
            if (layout.space === "world") {
                return [layout.x, layout.y];
            }

            return [
                toFiniteNumber(this.node.pos?.[0]) + layout.x,
                toFiniteNumber(this.node.pos?.[1]) + layout.y,
            ];
        }

        const fallbackPoint = toPoint(
            this.node.getConnectionPos?.(kind === "input", slotIndex)
        );
        return fallbackPoint || null;
    }

    getPortDirection(
        kind: NodeViewPortKind,
        slotIndex: number
    ): number | null {
        const layout = this.resolvePortLayout(kind, slotIndex);
        if (layout?.dir != null) {
            return toFiniteNumber(layout.dir);
        }

        return kind === "input" ? PORT_DIRECTION_LEFT : PORT_DIRECTION_RIGHT;
    }

    hitPortAt(worldX: number, worldY: number): NodeViewPortHit | null {
        let bestHit: (NodeViewPortHit & { distance: number }) | null = null;
        const kinds: NodeViewPortKind[] = ["output", "input"];

        for (let kindIndex = 0; kindIndex < kinds.length; ++kindIndex) {
            const kind = kinds[kindIndex];
            const slotCount = this.getSlotCount(kind);
            for (let slotIndex = 0; slotIndex < slotCount; ++slotIndex) {
                const anchor = this.getPortAnchor(kind, slotIndex);
                if (!anchor) {
                    continue;
                }

                const radius =
                    this.resolvePortLayout(kind, slotIndex)?.radius ?? 12;
                const dx = worldX - anchor[0];
                const dy = worldY - anchor[1];
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius) {
                    continue;
                }

                if (!bestHit || dist < bestHit.distance) {
                    bestHit = {
                        kind,
                        slotIndex,
                        anchor,
                        dir: this.getPortDirection(kind, slotIndex) || undefined,
                        distance: dist,
                    };
                }
            }
        }

        if (!bestHit) {
            return null;
        }

        return {
            kind: bestHit.kind,
            slotIndex: bestHit.slotIndex,
            anchor: bestHit.anchor,
            dir: bestHit.dir,
        };
    }

    private createContext(): ModernNodeBuildContext {
        return {
            node: this.node,
            host: this,
            root: this.root,
            content: this.content,
            leafer,
        };
    }

    private getSlotCount(kind: NodeViewPortKind): number {
        const list = kind === "input" ? this.node.inputs : this.node.outputs;
        return Array.isArray(list) ? list.length : 0;
    }

    private resolvePortLayout(
        kind: NodeViewPortKind,
        slotIndex: number
    ): ModernNodePortLayout | null {
        return this.node.getPortLayout?.(kind, slotIndex, this.createContext()) || null;
    }
}
