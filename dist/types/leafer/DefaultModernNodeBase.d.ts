import { ModernNodeBase } from "./ModernNodeBase";
import type { ModernActionPartSchema, ModernNodeLifecycleContext, ModernPortPresentation, ModernShellState } from "./ModernNodeContracts";
import type { NodeViewPortKind } from "./NodeViewHost";
export declare class DefaultModernNodeBase extends ModernNodeBase {
    protected definePorts(): import("./ModernNodeContracts").ModernNodePortSchema;
    defineActionParts(_context: ModernNodeLifecycleContext<this>): ReadonlyArray<ModernActionPartSchema<this>>;
    getShellState(_context: ModernNodeLifecycleContext<this>): ModernShellState;
    getPortPresentation(kind: NodeViewPortKind, slotIndex: number, _context: ModernNodeLifecycleContext<this>): ModernPortPresentation | null;
    protected mountContent(): unknown;
    protected patchContent(): void;
    syncModernPorts(): void;
}
