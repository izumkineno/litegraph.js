import {
    buildSlotSchemaFromNode,
    resolveCollapsedWidth,
    resolveLiteGraphAuthoringHostForNode,
    resolvePortPresentation,
    resolveShellState,
} from "./ModernNodeAuthoringUtils";
import { ModernNodeBase } from "./ModernNodeBase";
import type {
    ModernActionPartSchema,
    ModernNodeLifecycleContext,
    ModernPortPresentation,
    ModernShellState,
} from "./ModernNodeContracts";
import type { NodeViewPortKind } from "./NodeViewHost";

export class DefaultModernNodeBase extends ModernNodeBase {
    protected definePorts() {
        return buildSlotSchemaFromNode(this);
    }

    defineActionParts(
        _context: ModernNodeLifecycleContext<this>
    ): ReadonlyArray<ModernActionPartSchema<this>> {
        return [];
    }

    getShellState(
        _context: ModernNodeLifecycleContext<this>
    ): ModernShellState {
        const host = resolveLiteGraphAuthoringHostForNode(this);
        const shellState = resolveShellState(this, host);
        if (this.flags?.collapsed) {
            shellState.summaryText = "";
        }
        shellState.collapsedWidth = resolveCollapsedWidth(this, host);
        return shellState;
    }

    getPortPresentation(
        kind: NodeViewPortKind,
        slotIndex: number,
        _context: ModernNodeLifecycleContext<this>
    ): ModernPortPresentation | null {
        const host = resolveLiteGraphAuthoringHostForNode(this);
        return resolvePortPresentation(this, kind, slotIndex, host);
    }

    protected mountContent(): unknown {
        return null;
    }

    protected patchContent(): void {}

    syncModernPorts(): void {
        this.refreshModernPorts();
    }
}
