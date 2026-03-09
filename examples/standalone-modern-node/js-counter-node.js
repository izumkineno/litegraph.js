const PENDING_KEY = "__LITEGRAPH_PENDING_MODERN_NODE_MODULES__";

function queueModule(globalScope, moduleDef) {
    const queue = Array.isArray(globalScope[PENDING_KEY])
        ? globalScope[PENDING_KEY]
        : [];
    if (!queue.some((entry) => entry && entry.id === moduleDef.id)) {
        queue.push(moduleDef);
    }
    globalScope[PENDING_KEY] = queue;
}

function autoInstall(moduleDef) {
    if (
        globalThis.LiteGraph &&
        typeof globalThis.LiteGraph.installModernNodeModule === "function"
    ) {
        return globalThis.LiteGraph.installModernNodeModule(moduleDef) || [];
    }

    queueModule(globalThis, moduleDef);
    return [];
}

export const moduleDef = {
    id: "examples/standalone-counter-js",
    define(api) {
        class StandaloneCounterJsNode extends api.DefaultModernNodeBase {
            static type = "examples/standalone_counter_js";
            static title = "Standalone Counter JS";

            constructor(title) {
                super(title);
                this.addInput("tick", api.liteGraph.ACTION);
                this.addOutput("value", "number");
                this.addProperty("step", 1);
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

            onAction() {
                this._value += Number(this.properties.step) || 1;
                this.requestModernPatch(api.ModernNodeChangeMask.Data);
            }

            onExecute() {
                this.setOutputData(0, this._value);
            }
        }

        return [StandaloneCounterJsNode];
    },
};

export function install(host = globalThis.LiteGraph) {
    return host && typeof host.installModernNodeModule === "function"
        ? host.installModernNodeModule(moduleDef)
        : [];
}

void autoInstall(moduleDef);
