import type { GraphDataForSerialize, GraphNodePersistenceLike, SerializedGraphPersistenceLike } from "./graph-persistence.types";
import { LGraphIOEvents } from "./LGraph.io-events";
/**
 * LGraph persistence methods.
 * Source: `removeLink/serialize/configure/load/onNodeTrace`.
 */
export declare class LGraphPersistence extends LGraphIOEvents {
    onSerialize?: (data: GraphDataForSerialize) => void;
    onConfigure?: (data: SerializedGraphPersistenceLike) => void;
    /**
     * Destroys a link
     * @method removeLink
     * @param {Number} link_id
     */
    removeLink(link_id: number): void;
    /**
     * Creates a Object containing all the info about this graph, it can be serialized
     * @method serialize
     * @return {Object} value of the node
     */
    serialize(): GraphDataForSerialize;
    /**
     * Configure a graph from a JSON string
     * @method configure
     * @param {String} str configure a graph from a JSON string
     * @param {Boolean} returns if there was any error parsing
     */
    configure(data: object, keep_old?: boolean): boolean | undefined;
    load(url: string | File | Blob, callback?: (() => void) | undefined): void;
    onNodeTrace(_node: GraphNodePersistenceLike, _msg: string, _color?: string): void;
}
