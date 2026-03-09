import {
    DefaultModernNodeBase,
    autoInstallModernNodeModule,
    flushPendingModernNodeModules,
    installModernNodeModule,
    installModernNodeModules,
    type ModernNodeModuleDefinition,
} from "../../src/ts-migration/leafer";

class ModuleTestNode extends DefaultModernNodeBase {
    static type = "modern/module_test";
    static title = "Module Test";

    protected definePorts() {
        return { inputs: [], outputs: [] };
    }

    protected mountContent(): unknown {
        return null;
    }
}

function createHost() {
    const host = {
        registered_node_types: {} as Record<string, unknown>,
        registerNodeType: jest.fn((type: string, NodeClass: unknown) => {
            host.registered_node_types[type] = NodeClass;
        }),
    };
    return host;
}

describe("modern node modules", () => {
    test("installModernNodeModule registers classes returned by module definition", () => {
        const host = createHost();
        const moduleDefinition: ModernNodeModuleDefinition = {
            id: "fixture/module",
            define: () => [ModuleTestNode],
        };

        const registeredTypes = installModernNodeModule(moduleDefinition, host);

        expect(registeredTypes).toEqual(["modern/module_test"]);
        expect(host.registerNodeType).toHaveBeenCalledWith(
            "modern/module_test",
            ModuleTestNode
        );
        expect(moduleDefinition.__registeredTypes).toEqual([
            "modern/module_test",
        ]);
    });

    test("installModernNodeModules deduplicates by module id", () => {
        const host = createHost();
        const moduleDefinition: ModernNodeModuleDefinition = {
            id: "fixture/module-batch",
            define: jest.fn(() => [ModuleTestNode]),
        };

        const firstTypes = installModernNodeModules([moduleDefinition], host);
        const secondTypes = installModernNodeModules([moduleDefinition], host);

        expect(firstTypes).toEqual(["modern/module_test"]);
        expect(secondTypes).toEqual([]);
        expect(moduleDefinition.define).toHaveBeenCalledTimes(1);
    });

    test("autoInstallModernNodeModule queues modules until LiteGraph host becomes available", () => {
        const scope = {} as {
            LiteGraph?: ReturnType<typeof createHost>;
            __LITEGRAPH_PENDING_MODERN_NODE_MODULES__?: ModernNodeModuleDefinition[];
        };
        const moduleDefinition: ModernNodeModuleDefinition = {
            id: "fixture/queued-module",
            define: () => [ModuleTestNode],
        };

        const queuedTypes = autoInstallModernNodeModule(moduleDefinition, scope);
        expect(queuedTypes).toEqual([]);
        expect(scope.__LITEGRAPH_PENDING_MODERN_NODE_MODULES__).toHaveLength(1);

        scope.LiteGraph = createHost();
        const flushedTypes = flushPendingModernNodeModules(scope, scope.LiteGraph);

        expect(flushedTypes).toEqual(["modern/module_test"]);
        expect(scope.__LITEGRAPH_PENDING_MODERN_NODE_MODULES__).toEqual([]);
        expect(scope.LiteGraph.registerNodeType).toHaveBeenCalledWith(
            "modern/module_test",
            ModuleTestNode
        );
    });
});
