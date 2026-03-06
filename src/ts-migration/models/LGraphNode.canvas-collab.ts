import type { Vector2 } from "../types/core-types";
import type {
    GraphCanvasCapturePort,
    GraphCanvasViewportPort,
} from "../contracts/canvas";
import { createClassHostResolver } from "../core/host-resolver";
import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import { LGraphNodeConnectGeometry } from "./LGraphNode.connect-geometry";

interface LGraphNodeCanvasCollabHost
    extends Pick<LiteGraphConstantsShape, "CANVAS_GRID_SIZE" | "node_images_path"> {}

type LGraphNodeCanvasLike = GraphCanvasCapturePort<LGraphNodeCanvasCollab>;

interface LGraphNodeCanvasCollabGraphLike {
    _version: number;
    list_of_graphcanvas?: LGraphNodeCanvasLike[];
    onNodeTrace?: (node: LGraphNodeCanvasCollab, msg: string) => void;
    sendActionToCanvas: (
        action: string,
        params: [boolean | undefined, boolean | undefined]
    ) => void;
}

interface LGraphNodeCanvasCollabClassMeta extends Function {
    collapsable?: boolean;
    MAX_CONSOLE?: number;
}

type ReadyImage = HTMLImageElement & { ready: boolean };

const defaultCanvasCollabHost: LGraphNodeCanvasCollabHost = {
    CANVAS_GRID_SIZE: 10,
    node_images_path: "",
};

const resolveCanvasCollabHost = createClassHostResolver(defaultCanvasCollabHost, {
    cacheKey: "LGraphNode.canvas-collab",
    fallbackOwners: [() => LGraphNodeCanvasCollab],
});

/**
 * LGraphNode canvas-collaboration methods.
 * Source: `alignToGrid/trace/setDirtyCanvas/loadImage/executeAction/captureInput/collapse/pin/localToScreen`.
 */
export class LGraphNodeCanvasCollab extends LGraphNodeConnectGeometry {
    console?: string[];

    private canvasGraphRef(): LGraphNodeCanvasCollabGraphLike | null {
        return (this.graph as unknown as LGraphNodeCanvasCollabGraphLike) || null;
    }

    /* Force align to grid */
    alignToGrid(): void {
        const host = resolveCanvasCollabHost(this);
        this.pos[0] =
            host.CANVAS_GRID_SIZE *
            Math.round(this.pos[0] / host.CANVAS_GRID_SIZE);
        this.pos[1] =
            host.CANVAS_GRID_SIZE *
            Math.round(this.pos[1] / host.CANVAS_GRID_SIZE);
    }

    /* Console output */
    trace(msg: string): void {
        const consoleLines = this.console || (this.console = []);
        const maxConsoleLines =
            (this.constructor as LGraphNodeCanvasCollabClassMeta).MAX_CONSOLE ??
            100;

        consoleLines.push(msg);
        if (consoleLines.length > maxConsoleLines) {
            consoleLines.shift();
        }

        const graph = this.graph as unknown as LGraphNodeCanvasCollabGraphLike;
        if (graph.onNodeTrace) {
            graph.onNodeTrace(this, msg);
        }
    }

    /* Forces to redraw or the main canvas (LGraphNode) or the bg canvas (links) */
    setDirtyCanvas(
        dirty_foreground: boolean,
        dirty_background?: boolean
    ): void {
        const anyThis = this as unknown as {
            canvasGraphRef?: () => LGraphNodeCanvasCollabGraphLike | null;
            graphRef?: () => LGraphNodeCanvasCollabGraphLike | null;
            graph?: LGraphNodeCanvasCollabGraphLike | null;
        };
        const graph =
            (typeof anyThis.canvasGraphRef === "function" &&
                anyThis.canvasGraphRef()) ||
            (typeof anyThis.graphRef === "function" && anyThis.graphRef()) ||
            anyThis.graph ||
            null;
        if (!graph) {
            return;
        }
        graph.sendActionToCanvas("setDirty", [
            dirty_foreground,
            dirty_background,
        ]);
    }

    loadImage(url: string): ReadyImage {
        const host = resolveCanvasCollabHost(this);
        const img = new Image() as ReadyImage;
        img.src = host.node_images_path + url;
        img.ready = false;

        img.onload = () => {
            img.ready = true;
            this.setDirtyCanvas(true);
        };
        return img;
    }

    // safe LGraphNode action execution (not sure if safe)
    // Intentionally kept disabled to mirror source behavior, where this block is commented out.
    /*
    executeAction(action: string): boolean {
        return false;
    }
    */

    /* Allows to get onMouseMove and onMouseUp events even if the mouse is out of focus */
    captureInput(v: any): void {
        const graph = this.canvasGraphRef();
        if (!graph || !graph.list_of_graphcanvas) {
            return;
        }

        const list = graph.list_of_graphcanvas;
        for (let i = 0; i < list.length; ++i) {
            const c = list[i];
            // releasing somebody else's capture?!
            if (!v && c.node_capturing_input != this) {
                continue;
            }

            // change
            c.node_capturing_input = v ? this : null;
        }
    }

    /**
     * Collapse the node to make it smaller on the canvas
     * @method collapse
     **/
    collapse(force: boolean): void {
        const graph = this.graph as unknown as LGraphNodeCanvasCollabGraphLike;
        graph._version++;
        if (
            (this.constructor as LGraphNodeCanvasCollabClassMeta).collapsable ===
                false &&
            !force
        ) {
            return;
        }
        this.flags.collapsed = !this.flags.collapsed;
        this.setDirtyCanvas(true, true);
    }

    /**
     * Forces the node to do not move or realign on Z
     * @method pin
     **/
    pin(v?: boolean): void {
        const graph = this.graph as unknown as LGraphNodeCanvasCollabGraphLike;
        graph._version++;
        if (v === undefined) {
            this.flags.pinned = !this.flags.pinned;
        } else {
            this.flags.pinned = v;
        }
    }

    localToScreen(
        x: number,
        y: number,
        graphCanvas: GraphCanvasViewportPort
    ): Vector2 {
        return [
            (x + this.pos[0]) * graphCanvas.ds.scale + graphCanvas.ds.offset[0],
            (y + this.pos[1]) * graphCanvas.ds.scale + graphCanvas.ds.offset[1],
        ] as Vector2;
    }
}
