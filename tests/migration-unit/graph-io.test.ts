import { deserializeGraphData } from "../../src/ts-migration/models/graph-deserializer";
import { serializeGraphData } from "../../src/ts-migration/models/graph-serializer";

describe("graph serializer / deserializer", () => {
    test("serializeGraphData 只做纯映射", () => {
        const node = { serialize: jest.fn(() => ({ id: 1, type: "demo" })) };
        const link = { serialize: jest.fn(() => [5, 1, 0, 2, 0, "number"]) };
        const group = {
            serialize: jest.fn(() => ({
                title: "G",
                bounding: [0, 0, 10, 10],
                color: "#fff",
                font_size: 24,
            })),
        };

        const data = serializeGraphData({
            last_node_id: 1,
            last_link_id: 5,
            nodes: [node as never],
            links: [link as never],
            groups: [group as never],
            config: { align_to_grid: true },
            extra: { meta: 1 },
            version: 9,
        });

        expect(data).toEqual({
            last_node_id: 1,
            last_link_id: 5,
            nodes: [{ id: 1, type: "demo" }],
            links: [[5, 1, 0, 2, 0, "number"]],
            groups: [
                {
                    title: "G",
                    bounding: [0, 0, 10, 10],
                    color: "#fff",
                    font_size: 24,
                },
            ],
            config: { align_to_grid: true },
            extra: { meta: 1 },
            version: 9,
        });
    });

    test("deserializeGraphData 只消费干净数据和工厂", () => {
        const configuredNodes: unknown[] = [];
        const configuredGroups: unknown[] = [];
        const target: any = {
            _nodes: [] as any[],
            _groups: [] as any[],
            links: {} as Record<number, any>,
            extra: {},
            _version: 0,
            add(item: any): void {
                if (typeof item.disconnectInput === "function") {
                    this._nodes.push(item);
                    return;
                }
                this._groups.push(item);
            },
            getNodeById(id: number): any {
                return this._nodes.find((node) => node.id === id) || null;
            },
            updateExecutionOrder: jest.fn(),
            setDirtyCanvas: jest.fn(),
            onConfigure: jest.fn(),
        };

        deserializeGraphData(
            target,
            {
                last_node_id: 3,
                last_link_id: 8,
                config: { foo: "bar" },
                version: 1,
                nodes: [{ id: 3, type: "demo/node", title: "N" }],
                links: [[8, 3, 0, 4, 1, "event"]],
                groups: [{ title: "G" }],
                extra: { saved: true },
            },
            {
                createLink: () => ({
                    id: 0,
                    target_id: 0,
                    target_slot: 0,
                    serialize: () => null,
                    configure(data: any): void {
                        this.id = data[0];
                        this.target_id = data[3];
                        this.target_slot = data[4];
                    },
                }),
                createNode: () => ({
                    id: -1,
                    graph: null,
                    serialize: () => null,
                    disconnectInput: () => undefined,
                    configure(data: unknown): void {
                        configuredNodes.push(data);
                    },
                }),
                createGroup: () => ({
                    graph: null,
                    serialize: () => null,
                    configure(data: unknown): void {
                        configuredGroups.push(data);
                    },
                }),
            }
        );

        expect(target.last_node_id).toBe(3);
        expect(target.last_link_id).toBe(8);
        expect(target.config).toEqual({ foo: "bar" });
        expect(target.links[8]).toBeDefined();
        expect(configuredNodes).toEqual([{ id: 3, type: "demo/node", title: "N" }]);
        expect(configuredGroups).toEqual([{ title: "G" }]);
        expect(target.extra).toEqual({ saved: true });
        expect(target.updateExecutionOrder).toHaveBeenCalledTimes(1);
        expect(target.setDirtyCanvas).toHaveBeenCalledWith(true, true);
        expect(target.onConfigure).toHaveBeenCalledTimes(1);
        expect(target._version).toBe(1);
    });
});
