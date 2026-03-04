// TODO: Import LGraph from its future module
// TODO: Import LGraphNode from its future module
// TODO: Import LGraphGroup from its future module

import type { INodeInputSlot, INodeOutputSlot, Vector2, Vector4 } from "./core-types";

export type JSONLikeObject = Record<string, any>;

export interface SerializedLGraphNodeLike {
    id: number;
    type: string | null;
    pos: Vector2;
    size: Vector2;
    flags: Partial<{
        collapsed: boolean;
    }>;
    mode?: number;
    inputs: INodeInputSlot[];
    outputs: INodeOutputSlot[];
    title: string;
    properties: Record<string, any>;
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

export interface SerializedLGraphGroup {
    title: string;
    bounding: Vector4;
    color: string;
    font: string;
}

export type serializedLGraph<
    TNode = SerializedLGraphNode,
    // https://github.com/jagenjo/litegraph.js/issues/74
    TLink = [number, number, number, number, number, string],
    TGroup = SerializedLGraphGroup
> = {
    last_node_id: number;
    last_link_id: number;
    nodes: TNode[];
    links: TLink[];
    groups: TGroup[];
    config: object;
    version: number;
};

export type SerializedLGraph<
    TNode = SerializedLGraphNode,
    TLink = [number, number, number, number, number, string],
    TGroup = SerializedLGraphGroup
> = serializedLGraph<TNode, TLink, TGroup>;
