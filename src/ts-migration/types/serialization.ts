import type { INodeInputSlot, INodeOutputSlot, Vector4 } from "./core-types";
import type { LGraphPersistence as LGraph } from "../models/LGraph.persistence";
import type { LGraphGroup } from "../models/LGraphGroup";
import type { LGraphNodeCanvasCollab as LGraphNode } from "../models/LGraphNode.canvas-collab";

export type JSONLikeObject = Record<string, any>;

type SerializedLGraphNodeBase = Omit<
    Pick<
        LGraphNode,
        "id" | "type" | "pos" | "size" | "mode" | "inputs" | "outputs" | "title" | "properties"
    >,
    "id" | "inputs" | "outputs"
>;

export interface SerializedLGraphNodeLike extends SerializedLGraphNodeBase {
    id: number;
    flags: Partial<{
        collapsed: boolean;
    }>;
    inputs: INodeInputSlot[];
    outputs: INodeOutputSlot[];
    widgets_values?: any[];
}

export type SerializedLGraphNode<
    TNode extends SerializedLGraphNodeLike = SerializedLGraphNodeLike
> = {
    id: TNode["id"];
    type: TNode["type"];
    pos: TNode["pos"];
    size: TNode["size"];
    flags: TNode["flags"];
    mode: TNode["mode"];
    inputs: TNode["inputs"];
    outputs: TNode["outputs"];
    title: TNode["title"];
    properties: TNode["properties"];
    widgets_values?: TNode["widgets_values"];
};

/**
 * Serialized LLink tuple as declared in `src/litegraph.d.ts`.
 * Note: runtime compatibility for alternate tuple orders is handled in later tasks.
 */
export type SerializedLLink = [number, string, number, number, number, number];

export interface SerializedLGraphGroup
    extends Pick<LGraphGroup, "title" | "color"> {
    bounding: Vector4;
    font: string;
}

type SerializedLGraphBase = Pick<LGraph, "last_node_id" | "last_link_id" | "config">;

export type serializedLGraph<
    TNode = SerializedLGraphNode,
    // https://github.com/jagenjo/litegraph.js/issues/74
    TLink = [number, number, number, number, number, string],
    TGroup = SerializedLGraphGroup
> = SerializedLGraphBase & {
    nodes: TNode[];
    links: TLink[];
    groups: TGroup[];
    version: number;
};

export type SerializedLGraph<
    TNode = SerializedLGraphNode,
    TLink = [number, number, number, number, number, string],
    TGroup = SerializedLGraphGroup
> = serializedLGraph<TNode, TLink, TGroup>;
