import { LGraphGroup as MigratedLGraphGroup } from "../../src/ts-migration/models/LGraphGroup";
import { LLink as MigratedLLink } from "../../src/ts-migration/models/LLink";
import {
    denormalizeSerializedLLinkTuple,
    normalizeSerializedLGraphGroup,
    normalizeSerializedLLinkTuple,
} from "../../src/ts-migration/types/litegraph-compat";

type LegacyModule = {
    LLink?: new (
        id: number,
        type: string,
        origin_id: number,
        origin_slot: number,
        target_id: number,
        target_slot: number
    ) => {
        configure: (o: unknown) => void;
        serialize: () => [number, number, number, number, number, string];
    };
    LGraphGroup: new (title?: string) => {
        configure: (o: unknown) => void;
        serialize: () => {
            title: string;
            bounding: [number, number, number, number];
            color: string;
            font_size: number;
        };
    };
    LiteGraph?: {
        LLink?: new (
            id: number,
            type: string,
            origin_id: number,
            origin_slot: number,
            target_id: number,
            target_slot: number
        ) => {
            configure: (o: unknown) => void;
            serialize: () => [number, number, number, number, number, string];
        };
    };
};

function loadLegacy(): LegacyModule {
    return require("../../src/litegraph") as LegacyModule;
}

function createLegacyLink(legacy: LegacyModule): {
    configure: (o: unknown) => void;
    serialize: () => [number, number, number, number, number, string];
} {
    const Ctor = legacy.LLink || legacy.LiteGraph?.LLink;
    if (!Ctor) {
        throw new Error("Legacy LLink constructor not found");
    }
    return new Ctor(0, "", 0, 0, 0, 0);
}

describe("migration parity: serialization configure/serialize", () => {
    beforeEach(() => {
        jest.resetModules();
    });

    describe("LLink serialize/configure parity", () => {
        test("runtime tuple: 迁移实现与旧实现一致", () => {
            const legacy = loadLegacy();
            const runtimeTuple = [101, 11, 2, 22, 3, "number"] as const;

            const legacyLink = createLegacyLink(legacy);
            legacyLink.configure(runtimeTuple);

            const migratedLink = new MigratedLLink(0, "", 0, 0, 0, 0);
            migratedLink.configure(runtimeTuple);

            expect(migratedLink.serialize()).toEqual(legacyLink.serialize());
        });

        test("d.ts tuple: 通过兼容归一化后保持与旧实现一致", () => {
            const legacy = loadLegacy();
            const dtsTuple = [102, "event", 31, 1, 32, 0] as const;
            const normalizedRuntime = normalizeSerializedLLinkTuple(dtsTuple);

            const legacyLink = createLegacyLink(legacy);
            legacyLink.configure(normalizedRuntime);

            const migratedLink = new MigratedLLink(0, "", 0, 0, 0, 0);
            migratedLink.configure(dtsTuple);

            expect(migratedLink.serialize()).toEqual(legacyLink.serialize());
            expect(
                denormalizeSerializedLLinkTuple(migratedLink.serialize(), "dts")
            ).toEqual([102, "event", 31, 1, 32, 0]);
        });

        test("object payload: 迁移实现与旧实现一致", () => {
            const legacy = loadLegacy();
            const payload = {
                id: 103,
                type: "float",
                origin_id: 41,
                origin_slot: 4,
                target_id: 42,
                target_slot: 5,
            };

            const legacyLink = createLegacyLink(legacy);
            legacyLink.configure(payload);

            const migratedLink = new MigratedLLink(0, "", 0, 0, 0, 0);
            migratedLink.configure(payload);

            expect(migratedLink.serialize()).toEqual(legacyLink.serialize());
        });
    });

    describe("LGraphGroup serialize/configure parity", () => {
        test("runtime font_size payload: 迁移实现与旧实现一致", () => {
            const legacy = loadLegacy();
            const payload = {
                title: "Group-A",
                bounding: [10, 20, 140, 80] as [number, number, number, number],
                color: "#999",
                font_size: 28,
            };

            const legacyGroup = new legacy.LGraphGroup("Legacy-A");
            legacyGroup.configure(payload);

            const migratedGroup = new MigratedLGraphGroup("Migrated-A");
            migratedGroup.configure(payload);

            expect(migratedGroup.serialize()).toEqual(legacyGroup.serialize());
        });

        test("d.ts font payload: 兼容归一化后保持与旧实现一致", () => {
            const legacy = loadLegacy();
            const dtsLikePayload = {
                title: "Group-B",
                bounding: [1, 2, 140, 80] as [number, number, number, number],
                color: "#abc",
                font: "19",
            };
            const normalizedRuntime = normalizeSerializedLGraphGroup(dtsLikePayload);

            const legacyGroup = new legacy.LGraphGroup("Legacy-B");
            legacyGroup.configure(normalizedRuntime);

            const migratedGroup = new MigratedLGraphGroup("Migrated-B");
            migratedGroup.configure(dtsLikePayload);

            expect(migratedGroup.serialize()).toEqual(legacyGroup.serialize());
        });

        test("missing font fields: 默认值归一化后与旧实现一致", () => {
            const legacy = loadLegacy();
            const payloadWithoutFont = {
                title: "Group-C",
                bounding: [3, 4, 140, 80] as [number, number, number, number],
                color: "#def",
            };
            const normalizedRuntime = normalizeSerializedLGraphGroup(payloadWithoutFont);

            const legacyGroup = new legacy.LGraphGroup("Legacy-C");
            legacyGroup.configure(normalizedRuntime);

            const migratedGroup = new MigratedLGraphGroup("Migrated-C");
            migratedGroup.configure(payloadWithoutFont);

            expect(migratedGroup.serialize()).toEqual(legacyGroup.serialize());
            expect(migratedGroup.serialize().font_size).toBe(24);
        });
    });
});
