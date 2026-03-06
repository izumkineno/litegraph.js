import type { LGraphGroup } from "../models/LGraphGroup";
import type { LGraphNodeCanvasCollab as LGraphNode } from "../models/LGraphNode.canvas-collab";

export interface DialogLike extends HTMLDivElement {
    is_modified: boolean;
    close: () => void;
    modified: () => void;
    _floating_cleanup?: (() => void) | null;
}

export interface PanelLike extends HTMLDivElement {
    header: HTMLElement;
    title_element: HTMLElement;
    content: HTMLElement;
    alt_content: HTMLElement;
    footer: HTMLElement;
    close: () => void;
    clear: () => void;
    addHTML: (code: string, className?: string, on_footer?: boolean) => HTMLElement;
    addButton: (
        name: string,
        callback: (e: MouseEvent) => void,
        options?: any
    ) => HTMLButtonElement;
    addSeparator: () => void;
    addWidget: (
        type: string,
        name: string,
        value: any,
        options?: any,
        callback?: (name: string, value: any, options?: any) => void
    ) => HTMLElement;
    toggleAltContent: (force?: boolean) => void;
    toggleFooterVisibility: (force?: boolean) => void;
    inner_showCodePad?: (propname: string) => void;
    node?: any;
    graph?: any;
    _floating_cleanup?: (() => void) | null;
}

export type ContextMenuCtor = new (...args: any[]) => unknown;

export interface MenuPanelHost {
    ContextMenu?: ContextMenuCtor;
    ACTION?: number | string;
    EVENT?: number | string;
    NODE_MODES?: string[] | Record<string, string>;
    LINK_RENDER_MODES?: string[];
    availableCanvasOptions?: unknown[];
    slot_types_default_in?: Record<string, unknown>;
    slot_types_default_out?: Record<string, unknown>;
    slot_types_in?: string[];
    slot_types_out?: string[];
    registered_node_types?: Record<string, any>;
    registered_slot_in_types?: Record<string, any>;
    registered_slot_out_types?: Record<string, any>;
    searchbox_extras?: Record<string, any>;
    search_filter_enabled?: boolean;
    search_hide_on_mouse_leave?: boolean;
    search_show_all_on_open?: boolean;
    dialog_close_on_mouse_leave?: boolean;
    dialog_close_on_mouse_leave_delay?: number;
    getTime?: () => number;
    createNode?: (type: string) => LGraphNode | null;
    LGraphGroup?: new (...args: any[]) => LGraphGroup;
    pointerListenerAdd?: (
        dom: EventTarget,
        ev: string,
        cb: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => void;
    pointerListenerRemove?: (
        dom: EventTarget,
        ev: string,
        cb: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => void;
}

export interface ResolvedMenuPanelHost extends MenuPanelHost {
    ContextMenu: ContextMenuCtor;
    ACTION: number | string;
    EVENT: number | string;
    NODE_MODES: string[] | Record<string, string>;
    LINK_RENDER_MODES: string[];
    availableCanvasOptions: unknown[];
    slot_types_default_in: Record<string, unknown>;
    slot_types_default_out: Record<string, unknown>;
    slot_types_in: string[];
    slot_types_out: string[];
    registered_node_types: Record<string, any>;
    registered_slot_in_types: Record<string, any>;
    registered_slot_out_types: Record<string, any>;
    searchbox_extras: Record<string, any>;
    search_filter_enabled: boolean;
    search_hide_on_mouse_leave: boolean;
    search_show_all_on_open: boolean;
    dialog_close_on_mouse_leave: boolean;
    dialog_close_on_mouse_leave_delay: number;
    getTime: () => number;
    createNode: (type: string) => LGraphNode | null;
    pointerListenerAdd: (
        dom: EventTarget,
        ev: string,
        cb: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => void;
    pointerListenerRemove: (
        dom: EventTarget,
        ev: string,
        cb: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => void;
}

export interface MenuPanelCanvasClassPort extends Record<string, unknown> {
    active_canvas?: unknown;
    active_node?: unknown;
    search_limit?: number;
    ContextMenu?: ContextMenuCtor;
    node_colors?: Record<
        string,
        { color?: string; bgcolor?: string; groupcolor?: string }
    >;
    getPropertyPrintableValue?: (value: unknown, values?: unknown) => string;
}

export interface ResolvedMenuPanelCanvasClassPort
    extends MenuPanelCanvasClassPort {
    active_canvas: unknown;
    active_node: unknown;
    search_limit: number;
    ContextMenu: ContextMenuCtor;
    node_colors: Record<
        string,
        { color?: string; bgcolor?: string; groupcolor?: string }
    >;
    getPropertyPrintableValue: (value: unknown, values?: unknown) => string;
    onGroupAdd: (...args: any[]) => unknown;
    onGroupAlign: (...args: any[]) => unknown;
    onMenuAdd: (...args: any[]) => unknown;
    showMenuNodeOptionalInputs: (...args: any[]) => unknown;
    showMenuNodeOptionalOutputs: (...args: any[]) => unknown;
    onShowMenuNodeProperties: (...args: any[]) => unknown;
    onShowPropertyEditor: (...args: any[]) => unknown;
    onMenuNodeMode: (...args: any[]) => unknown;
    onMenuResizeNode: (...args: any[]) => unknown;
    onMenuNodeCollapse: (...args: any[]) => unknown;
    onMenuNodePin: (...args: any[]) => unknown;
    onMenuNodeColors: (...args: any[]) => unknown;
    onMenuNodeShapes: (...args: any[]) => unknown;
    onMenuNodeClone: (...args: any[]) => unknown;
    onMenuNodeToSubgraph: (...args: any[]) => unknown;
    onNodeAlign: (...args: any[]) => unknown;
    onMenuNodeRemove: (...args: any[]) => unknown;
}

export interface SearchBoxGraphPort {
    filter?: unknown;
    beforeChange?: () => void;
    add: (node: any, skipComputeOrder?: boolean) => void;
    afterChange?: () => void;
}

export interface SearchBoxControllerPort {
    canvas: HTMLCanvasElement | null;
    ds: { scale: number };
    graph: SearchBoxGraphPort;
    filter?: unknown;
    getSearchBox: () => DialogLike | null;
    setSearchBox: (dialog: DialogLike | null) => void;
    onSearchBoxSelection?: (
        name: string,
        event: MouseEvent | undefined,
        graphcanvas: SearchBoxControllerPort
    ) => void;
    onSearchBox?: (
        helper: HTMLDivElement,
        query: string,
        graphcanvas: SearchBoxControllerPort
    ) => any[] | null;
    convertEventToCanvasOffset: (event?: MouseEvent) => [number, number];
    focusCanvas: () => void;
}

export interface MenuActionBuilderCanvasPort extends Record<string, unknown> {
    selected_nodes?: Record<string, unknown>;
    _graph_stack?: unknown[];
    closeSubgraph: () => void;
    getMenuOptions?: () => any[];
    getExtraMenuOptions?: (canvas: unknown, options: any[]) => any[] | null | undefined;
}
