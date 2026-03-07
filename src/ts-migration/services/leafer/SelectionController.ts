import { overlapBounding } from "../../utils/math-geometry";
import type {
    GraphMutationGraphLike,
    GraphMutationNodeLike,
} from "./GraphMutationBus";
import { OverlayPrimitives, type OverlayWorldBounds } from "./OverlayPrimitives";
import type { SceneSyncController } from "./SceneSyncController";

interface SelectionCanvasHost {
    selectNodes: (nodes?: GraphMutationNodeLike[], addToCurrentSelection?: boolean) => void;
}

interface SelectableNodeLike extends GraphMutationNodeLike {
    getBounding?: (
        out?: Float32Array | [number, number, number, number],
        computeOuter?: boolean
    ) => [number, number, number, number];
}

interface SelectionGraphLike extends GraphMutationGraphLike {
    _nodes?: SelectableNodeLike[];
}

interface ActiveSelection {
    readonly startX: number;
    readonly startY: number;
    readonly additive: boolean;
}

function normalizeBounds(
    startX: number,
    startY: number,
    endX: number,
    endY: number
): OverlayWorldBounds {
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    return {
        x: left,
        y: top,
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
    };
}

export class SelectionController {
    private activeSelection: ActiveSelection | null = null;

    constructor(
        private readonly graph: SelectionGraphLike,
        private readonly canvas: SelectionCanvasHost,
        private readonly sceneSyncController: SceneSyncController,
        private readonly overlayPrimitives: OverlayPrimitives
    ) {}

    destroy(): void {
        this.cancel();
    }

    begin(worldX: number, worldY: number, additive: boolean): void {
        this.activeSelection = {
            startX: worldX,
            startY: worldY,
            additive,
        };
        this.update(worldX, worldY);
    }

    update(worldX: number, worldY: number): void {
        if (!this.activeSelection) {
            return;
        }

        this.overlayPrimitives.setSelectionBounds(
            normalizeBounds(
                this.activeSelection.startX,
                this.activeSelection.startY,
                worldX,
                worldY
            )
        );
    }

    finish(worldX: number, worldY: number): GraphMutationNodeLike[] {
        if (!this.activeSelection) {
            return [];
        }

        const selection = this.activeSelection;
        const bounds = normalizeBounds(
            selection.startX,
            selection.startY,
            worldX,
            worldY
        );
        const normalizedBounding = [
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
        ] as [number, number, number, number];
        const selectedNodes: GraphMutationNodeLike[] = [];
        const tempBounds = new Float32Array(4) as unknown as [
            number,
            number,
            number,
            number,
        ];
        const nodes = Array.isArray(this.graph._nodes) ? this.graph._nodes : [];

        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            const nodeBounds = node.getBounding?.(tempBounds, true);
            if (!nodeBounds) {
                continue;
            }
            if (
                overlapBounding(
                    normalizedBounding,
                    nodeBounds
                )
            ) {
                selectedNodes.push(node);
            }
        }

        this.canvas.selectNodes(selectedNodes, selection.additive);
        this.sceneSyncController.repaintAllNodeHosts();
        this.overlayPrimitives.hideSelectionBox();
        this.activeSelection = null;

        return selectedNodes;
    }

    cancel(): void {
        this.activeSelection = null;
        this.overlayPrimitives.hideSelectionBox();
    }

    isActive(): boolean {
        return Boolean(this.activeSelection);
    }
}
