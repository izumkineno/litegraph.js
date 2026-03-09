import type { GraphDeserializeTarget, GraphDeserializerFactories } from "./graph-persistence.types";
import type { RepairedSerializedGraphData } from "./serialization-repair";
export declare function deserializeGraphData(target: GraphDeserializeTarget, data: RepairedSerializedGraphData, factories: GraphDeserializerFactories): void;
