import type { SerializedLGraphNodeState } from "../models/LGraphNode.state";
import { LGraphNodeCanvasCollab } from "../models/LGraphNode.canvas-collab";
import type { NodeViewPortKind } from "../services/leafer/NodeViewHost";
import {
    MODERN_NODE_MARKER_KEY,
    ModernNodeChangeMask,
    type ModernNodeChangeMaskValue,
    type ModernNodeLifecycleContext,
    type ModernNodePortDefinition,
    type ModernNodePortLayout,
    type ModernNodePortSchema,
} from "./ModernNodeContracts";
import type { ModernWidgetSchema } from "./ModernWidgetContracts";

function toFiniteNumber(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

export abstract class ModernNodeBase extends LGraphNodeCanvasCollab {
    static readonly modernContractVersion = 1;

    renderRuntime: "modern" = "modern";
    [MODERN_NODE_MARKER_KEY] = true;

    private modernPortsHydrated = false;
    private modernChangeMask: ModernNodeChangeMaskValue = ModernNodeChangeMask.All;

    constructor(title?: string) {
        super(title);
        this.renderRuntime = "modern";
    }

    protected abstract definePorts(): ModernNodePortSchema;

    defineWidgets(): ReadonlyArray<ModernWidgetSchema> {
        return [];
    }

    protected abstract mountView(
        context: ModernNodeLifecycleContext<this>
    ): unknown;

    protected patchView(
        _context: ModernNodeLifecycleContext<this>
    ): void {}

    getPortLayout?(
        _kind: NodeViewPortKind,
        _slotIndex: number,
        _context: ModernNodeLifecycleContext<this>
    ): ModernNodePortLayout | null;

    onNodeCreated(): void {
        this.ensureModernPorts();
    }

    buildUI(context: ModernNodeLifecycleContext<this>): unknown {
        this.ensureModernPorts();
        return this.mountView(context);
    }

    updateUI(context: ModernNodeLifecycleContext<this>): void {
        this.ensureModernPorts();
        this.patchView(context);
    }

    ensureModernPorts(force = false): void {
        if (this.modernPortsHydrated && !force) {
            return;
        }

        this.ensurePortRegistrationHost();
        const schema = this.definePorts() || {};
        this.syncPorts(schema);
        this.modernPortsHydrated = true;
        this.requestModernPatch(
            ModernNodeChangeMask.Layout |
                ModernNodeChangeMask.Ports |
                ModernNodeChangeMask.Data
        );
    }

    refreshModernPorts(): void {
        this.ensureModernPorts(true);
    }

    requestModernPatch(
        changeMask: ModernNodeChangeMaskValue = ModernNodeChangeMask.All,
        dirtyBackground = false
    ): void {
        const normalizedMask =
            toFiniteNumber(changeMask, ModernNodeChangeMask.None) |
            ModernNodeChangeMask.None;
        if (normalizedMask) {
            this.modernChangeMask |= normalizedMask;
        }
        this.setDirtyCanvas(true, dirtyBackground);
    }

    consumeModernChangeMask(): ModernNodeChangeMaskValue {
        const mask = this.modernChangeMask;
        this.modernChangeMask = ModernNodeChangeMask.None;
        return mask || ModernNodeChangeMask.Data;
    }

    override setProperty(name: string, value: unknown): void {
        super.setProperty(name, value);
        this.requestModernPatch(
            ModernNodeChangeMask.Data | ModernNodeChangeMask.Style
        );
    }

    override configure(info: SerializedLGraphNodeState): void {
        super.configure(info);
        this.requestModernPatch(ModernNodeChangeMask.All, true);
    }

    override collapse(force: boolean): void {
        super.collapse(force);
        this.requestModernPatch(
            ModernNodeChangeMask.Layout |
                ModernNodeChangeMask.Ports |
                ModernNodeChangeMask.Style,
            true
        );
    }

    private syncPorts(schema: ModernNodePortSchema): void {
        const inputs = Array.isArray(schema.inputs) ? schema.inputs : [];
        const outputs = Array.isArray(schema.outputs) ? schema.outputs : [];

        if (Array.isArray(this.inputs) && this.inputs.length) {
            for (let i = this.inputs.length - 1; i >= 0; --i) {
                this.removeInput(i);
            }
        }

        if (Array.isArray(this.outputs) && this.outputs.length) {
            for (let i = this.outputs.length - 1; i >= 0; --i) {
                this.removeOutput(i);
            }
        }

        for (let i = 0; i < inputs.length; ++i) {
            const input = this.normalizePortDefinition(inputs[i], i, "input");
            this.addInput(input.name, input.type ?? -1, input.extra || undefined);
        }

        for (let i = 0; i < outputs.length; ++i) {
            const output = this.normalizePortDefinition(outputs[i], i, "output");
            this.addOutput(output.name, output.type ?? -1, output.extra || undefined);
        }
    }

    private ensurePortRegistrationHost(): void {
        type LiteGraphHostCarrier = Function & {
            liteGraph?: {
                auto_load_slot_types?: boolean;
                registerNodeAndSlotType?: (...args: unknown[]) => void;
            };
        };
        let cursor = this.constructor as unknown as LiteGraphHostCarrier | null;

        while (cursor && cursor !== Function.prototype) {
            const liteGraphHost = cursor.liteGraph;
            if (
                liteGraphHost &&
                liteGraphHost.auto_load_slot_types &&
                typeof liteGraphHost.registerNodeAndSlotType !== "function"
            ) {
                liteGraphHost.registerNodeAndSlotType = () => {};
            }

            cursor = Object.getPrototypeOf(cursor) as LiteGraphHostCarrier | null;
        }
    }

    private normalizePortDefinition(
        port: ModernNodePortDefinition,
        index: number,
        kind: "input" | "output"
    ): ModernNodePortDefinition {
        const safePort = port && typeof port === "object" ? port : { name: "" };
        const fallbackName = `${kind}_${index}`;
        const rawName = String(safePort.name ?? "").trim();
        return {
            name: rawName || fallbackName,
            type: safePort.type,
            extra:
                safePort.extra && typeof safePort.extra === "object"
                    ? { ...safePort.extra }
                    : undefined,
        };
    }
}
