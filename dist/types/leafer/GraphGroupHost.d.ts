import { Group } from "leafer-ui";
import type { GraphMutationGroupLike } from "./GraphMutationBus";
interface RenderBoundsLike {
    x: number;
    y: number;
    width: number;
    height: number;
}
export declare class GraphGroupHost {
    private readonly group;
    readonly root: Group;
    private readonly fillRect;
    private readonly strokeRect;
    private readonly titleText;
    constructor(group: GraphMutationGroupLike);
    repaint(): void;
    destroy(): void;
    captureRenderBounds(): RenderBoundsLike;
    private resolvePosition;
    private resolveSize;
}
export {};
