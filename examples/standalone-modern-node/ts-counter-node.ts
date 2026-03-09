import type {
    LiteGraphModernInstallHost,
    ModernNodeLifecycleContext,
    ModernNodeModuleDefinition,
} from "litegraph.js/modern-types";

type InstallHost = Pick<LiteGraphModernInstallHost, "installModernNodeModule">;

const PENDING_KEY = "__LITEGRAPH_PENDING_MODERN_NODE_MODULES__";

function queueModule(globalScope: Record<string, unknown>, moduleDef: ModernNodeModuleDefinition): void {
    const queue = Array.isArray(globalScope[PENDING_KEY])
        ? (globalScope[PENDING_KEY] as ModernNodeModuleDefinition[])
        : [];
    if (!queue.some((entry) => entry.id === moduleDef.id)) {
        queue.push(moduleDef);
    }
    globalScope[PENDING_KEY] = queue;
}

function autoInstall(moduleDef: ModernNodeModuleDefinition): string[] {
    const globalScope = globalThis as typeof globalThis & {
        LiteGraph?: InstallHost;
        [PENDING_KEY]?: ModernNodeModuleDefinition[];
    };

    if (globalScope.LiteGraph?.installModernNodeModule) {
        return globalScope.LiteGraph.installModernNodeModule(moduleDef) || [];
    }

    queueModule(globalScope as Record<string, unknown>, moduleDef);
    return [];
}

export const moduleDef = {
    id: "examples/standalone-counter",
    define(api) {
        class StandaloneCounterNode extends api.DefaultModernNodeBase {
            static type = "examples/standalone_counter";
            static title = "Standalone Counter";

            declare _value: number;

            constructor(title?: string) {
                super(title);
                this.addInput("tick", api.liteGraph.ACTION ?? -1);
                this.addOutput("value", "number");
                this.addProperty("step", 1, "number");
                this._value = 0;
                this.size = [180, 60];
            }

            defineWidgets() {
                return [
                    {
                        id: "step",
                        type: "number",
                        name: "step",
                        label: "Step",
                        value: this.properties.step,
                        property: "step",
                        options: { step: 1 },
                    },
                ];
            }

            onAction = () => {
                this._value += Number(this.properties.step) || 1;
                this.requestModernPatch(api.ModernNodeChangeMask.Data);
            };

            onExecute = () => {
                this.setOutputData(0, this._value);
            };

            getShellState(
                context: ModernNodeLifecycleContext<this>
            ) {
                const shellState = super.getShellState(context);
                shellState.headerMetaText = String(this._value);
                shellState.minimumWidth = 180;
                return shellState;
            }
        }

        return [StandaloneCounterNode];
    },
} satisfies ModernNodeModuleDefinition;

export function install(host?: InstallHost): string[] {
    const targetHost =
        host ||
        ((globalThis as typeof globalThis & { LiteGraph?: InstallHost }).LiteGraph ??
            undefined);
    return targetHost?.installModernNodeModule?.(moduleDef) || [];
}

void autoInstall(moduleDef);
