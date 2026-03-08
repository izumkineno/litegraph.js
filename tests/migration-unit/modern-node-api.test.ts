import {
    ModernNodeBase,
    ModernNodeChangeMask,
    registerModernNode,
    registerModernNodes,
} from "../../src/ts-migration/leafer";
import { discriminateNodeRuntime } from "../../src/ts-migration/leafer";

class DemoModernNode extends ModernNodeBase {
    static type = "modern/demo";
    static title = "Demo Modern";

    protected definePorts() {
        return {
            inputs: [{ name: "in", type: "number" }],
            outputs: [{ name: "out", type: "number" }],
        };
    }

    protected mountView(_context: any): unknown {
        return null;
    }
}

class DemoModernNodeB extends ModernNodeBase {
    static type = "modern/demo_b";
    static title = "Demo Modern B";

    protected definePorts() {
        return {
            inputs: [{ name: "event", type: "event" }],
            outputs: [{ name: "tick", type: "event" }],
        };
    }

    protected mountView(_context: any): unknown {
        return null;
    }
}

const testLiteGraphHost = {
    auto_load_slot_types: false,
    registerNodeAndSlotType: () => {},
};

(DemoModernNode as unknown as { liteGraph: object }).liteGraph = testLiteGraphHost;
(DemoModernNodeB as unknown as { liteGraph: object }).liteGraph = testLiteGraphHost;

describe("modern node API", () => {
    test("ModernNodeBase keeps legacy-compatible slot data semantics", () => {
        const node = new DemoModernNode();
        node.ensureModernPorts();

        expect(node.renderRuntime).toBe("modern");
        expect(Array.isArray(node.inputs)).toBe(true);
        expect(Array.isArray(node.outputs)).toBe(true);
        expect(node.inputs).toHaveLength(1);
        expect(node.outputs).toHaveLength(1);
        expect(node.inputs[0]?.name).toBe("in");
        expect(node.outputs[0]?.name).toBe("out");
    });

    test("ModernNodeBase produces change-mask patches after state updates", () => {
        const node = new DemoModernNode();
        node.consumeModernChangeMask();

        node.setProperty("value", 42);
        const propertyMask = node.consumeModernChangeMask();
        expect((propertyMask & ModernNodeChangeMask.Data) !== 0).toBe(true);
        expect((propertyMask & ModernNodeChangeMask.Style) !== 0).toBe(true);

        node.refreshModernPorts();
        const portMask = node.consumeModernChangeMask();
        expect((portMask & ModernNodeChangeMask.Ports) !== 0).toBe(true);
        expect((portMask & ModernNodeChangeMask.Layout) !== 0).toBe(true);
    });

    test("registerModernNode and registerModernNodes use class-declared type", () => {
        const host = {
            registerNodeType: jest.fn(),
            registered_node_types: {},
        };

        const type = registerModernNode(DemoModernNode, host);
        expect(type).toBe("modern/demo");
        expect(host.registerNodeType).toHaveBeenCalledWith(
            "modern/demo",
            DemoModernNode
        );

        const types = registerModernNodes([DemoModernNodeB], host);
        expect(types).toEqual(["modern/demo_b"]);
        expect(host.registerNodeType).toHaveBeenCalledWith(
            "modern/demo_b",
            DemoModernNodeB
        );
    });

    test("runtime discriminator detects new modern contract first", () => {
        const modernNode = new DemoModernNode();
        expect(
            discriminateNodeRuntime(
                modernNode as unknown as { id: number | string; renderRuntime: "modern" }
            )
        ).toBe("modern");
        expect(
            discriminateNodeRuntime({
                mountView: () => null,
            })
        ).toBe("modern");
        expect(discriminateNodeRuntime({ id: 1 })).toBe("legacy");
    });
});
