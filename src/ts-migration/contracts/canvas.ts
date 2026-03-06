export type CanvasPointPort = [number, number];

export interface CanvasTransformPort {
    scale: number;
    offset: CanvasPointPort;
}

export interface GraphCanvasLifecyclePort<TGraph = unknown> {
    graph: TGraph | null;
}

export interface GraphCanvasConstructorPort<
    TCanvas extends GraphCanvasLifecyclePort = GraphCanvasLifecyclePort,
> {
    new (...args: any[]): TCanvas;
}

export interface GraphCanvasCapturePort<TNode = unknown> {
    node_capturing_input: TNode | null;
}

export interface GraphCanvasViewportPort<TNode = unknown>
    extends GraphCanvasCapturePort<TNode> {
    ds: CanvasTransformPort;
}

export interface GraphCanvasWidgetPort<TGraph = unknown, TNode = unknown>
    extends GraphCanvasLifecyclePort<TGraph>,
        GraphCanvasViewportPort<TNode> {
    setDirty(fgcanvas: boolean, bgcanvas: boolean): void;
}

export interface GraphCanvasColorPort {
    color?: string;
    bgcolor?: string;
    groupcolor?: string;
}

export interface GraphCanvasPalettePort {
    node_colors?: Record<string, GraphCanvasColorPort | undefined> & {
        pale_blue?: GraphCanvasColorPort;
    };
}
