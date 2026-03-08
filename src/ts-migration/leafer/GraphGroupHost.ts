import { Group, Rect, Text } from "leafer-ui";

import { hex2num } from "../utils/color";
import type { GraphMutationGroupLike } from "./GraphMutationBus";

interface RenderBoundsLike {
    x: number;
    y: number;
    width: number;
    height: number;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toAlphaFill(color: unknown, alpha: number): string {
    if (typeof color !== "string") {
        return `rgba(136,136,170,${alpha})`;
    }

    const normalized = color.trim();
    const expandedHex = /^#[0-9a-fA-F]{3}$/.test(normalized)
        ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
        : normalized;

    if (/^#[0-9a-fA-F]{6}$/.test(expandedHex)) {
        const [r, g, b] = hex2num(expandedHex);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    return normalized;
}

export class GraphGroupHost {
    readonly root: Group;

    private readonly fillRect: Rect;
    private readonly strokeRect: Rect;
    private readonly titleText: Text;

    constructor(private readonly group: GraphMutationGroupLike) {
        this.root = new Group({
            name: "litegraph-group-host",
            hittable: false,
            visible: true,
            data: {
                litegraphPlaceholderKind: "graph-group",
            },
        });
        this.fillRect = new Rect({
            name: "litegraph-group-fill",
            x: 0,
            y: 0,
            width: 140,
            height: 80,
            fill: toAlphaFill(group.color, 0.25),
            stroke: "transparent",
            hittable: false,
        });
        this.strokeRect = new Rect({
            name: "litegraph-group-stroke",
            x: 0.5,
            y: 0.5,
            width: 140,
            height: 80,
            fill: "transparent",
            stroke: typeof group.color === "string" ? group.color : "#88A",
            strokeWidth: 1,
            hittable: false,
        });
        this.titleText = new Text({
            name: "litegraph-group-title",
            x: 4,
            y: 4,
            text: typeof group.title === "string" ? group.title : "Group",
            fontSize: Math.max(12, toFiniteNumber(group.font_size, 24)),
            fill: typeof group.color === "string" ? group.color : "#88A",
            hittable: false,
        });

        this.root.add([this.fillRect, this.strokeRect, this.titleText]);
    }

    repaint(): void {
        const position = this.resolvePosition();
        const size = this.resolveSize();
        const fontSize = Math.max(12, toFiniteNumber(this.group.font_size, 24));
        const color =
            typeof this.group.color === "string" && this.group.color
                ? this.group.color
                : "#88A";

        this.root.x = position[0];
        this.root.y = position[1];

        this.fillRect.width = size[0];
        this.fillRect.height = size[1];
        this.fillRect.fill = toAlphaFill(color, 0.25);

        this.strokeRect.width = size[0];
        this.strokeRect.height = size[1];
        this.strokeRect.stroke = color;

        this.titleText.text =
            typeof this.group.title === "string" ? this.group.title : "Group";
        this.titleText.fontSize = fontSize;
        this.titleText.fill = color;
    }

    destroy(): void {
        this.root.destroy();
    }

    captureRenderBounds(): RenderBoundsLike {
        const worldBounds =
            (this.root as unknown as { worldRenderBounds?: RenderBoundsLike })
                .worldRenderBounds || null;
        if (worldBounds?.width && worldBounds?.height) {
            return {
                x: toFiniteNumber(worldBounds.x),
                y: toFiniteNumber(worldBounds.y),
                width: Math.max(0, toFiniteNumber(worldBounds.width)),
                height: Math.max(0, toFiniteNumber(worldBounds.height)),
            };
        }

        const [x, y] = this.resolvePosition();
        const [width, height] = this.resolveSize();
        const fontSize = Math.max(12, toFiniteNumber(this.group.font_size, 24));
        return {
            x,
            y,
            width,
            height: Math.max(height, fontSize + 8),
        };
    }

    private resolvePosition(): readonly [number, number] {
        const pos = this.group.pos || this.group._pos;
        return [
            toFiniteNumber(pos?.[0]),
            toFiniteNumber(pos?.[1]),
        ] as const;
    }

    private resolveSize(): readonly [number, number] {
        const size = this.group.size || this.group._size;
        return [
            Math.max(140, toFiniteNumber(size?.[0], 140)),
            Math.max(80, toFiniteNumber(size?.[1], 80)),
        ] as const;
    }
}
