import { LLink } from "../../src/ts-migration/models/LLink";
import {
    createNodeWithSerializationRepair,
    prepareGraphForSerialization,
    repairSerializedGraphForDeserialization,
} from "../../src/ts-migration/models/serialization-repair";

describe("serialization repair layer", () => {
    test("serialize 前修补缺少 serialize 的脏 link 对象", () => {
        const graph = {
            _nodes: [],
            _groups: [],
            links: {
                "7": {
                    id: 7,
                    type: "number",
                    origin_id: 1,
                    origin_slot: 0,
                    target_id: 2,
                    target_slot: 1,
                },
            },
            last_node_id: 2,
            last_link_id: 7,
            config: {},
            extra: { tag: "x" },
            version: 3,
        };

        const repaired = prepareGraphForSerialization(
            graph,
            () => new LLink(0, "", 0, 0, 0, 0)
        );

        expect(repaired.repairedLinks).toBe(1);
        expect(repaired.warnings).toEqual([
            "weird LLink bug, link info is not a LLink but a regular object",
        ]);
        expect(typeof (graph.links["7"] as any).serialize).toBe("function");
        expect(repaired.source.links[0].serialize()).toEqual([
            7,
            1,
            0,
            2,
            1,
            "number",
        ]);
    });

    test("deserialize 前清洗 links 容器并跳过坏条目", () => {
        const repaired = repairSerializedGraphForDeserialization({
            links: [null, [11, 21, 1, 31, 2, "event"]],
        });

        expect(repaired.skippedLinks).toBe(1);
        expect(repaired.warnings).toEqual([
            "serialized graph link data contains errors, skipping.",
        ]);
        expect(repaired.data.links).toEqual([[11, 21, 1, 31, 2, "event"]]);
        expect(repaired.data.nodes).toEqual([]);
        expect(repaired.data.groups).toEqual([]);
        expect(repaired.data.extra).toEqual({});
    });

    test("缺失节点类型时由 repair 层创建 fallback node", () => {
        class FallbackNode {
            id = -1;
            graph = null;
            serialize(): unknown {
                return {};
            }
            configure(): void {}
            disconnectInput(): void {}
        }

        const serialized = {
            id: 12,
            type: "missing/type",
            title: "X",
        };

        const result = createNodeWithSerializationRepair(
            {
                debug: false,
                getTime: () => Date.now(),
                VERSION: 0,
                createNode: () => null,
                LGraphNode: FallbackNode as never,
            },
            serialized
        );

        expect(result.usedFallback).toBe(true);
        expect(result.node.has_errors).toBe(true);
        expect(result.node.last_serialization).toBe(serialized);
    });
});
