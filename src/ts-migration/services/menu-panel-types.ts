import type { LGraphGroup } from "../models/LGraphGroup";
import type { LGraphNodeCanvasCollab as LGraphNode } from "../models/LGraphNode.canvas-collab";
import type { INodeInputSlot, INodeOutputSlot } from "../types/core-types";

export type MenuPanelValue = string | number | boolean | object | null | undefined;
export interface MenuPanelOptions {
    key?: string;
    label?: string;
    type?: string;
    values?: string[] | Record<string, MenuPanelValue>;
    callback?: MenuPanelCallback;
    on?: string;
    off?: string;
    className?: string;
    event?: MouseEvent;
    title?: string | null;
    closable?: boolean;
    window?: Window;
    mount?: HTMLElement | null;
    width?: number | string;
    height?: number | string;
    onOpen?: () => void;
    onClose?: () => void;
    [key: string]: MenuPanelValue | MenuPanelCallback | MouseEvent | Window | HTMLElement | null;
}
export type MenuPanelCallback = (
    name: string,
    value: MenuPanelValue,
    options?: MenuPanelOptions
) => void;
export type MenuPanelActionArg = MenuPanelEntry | ContextMenuOptionsLike | MouseEvent | object | string | number | boolean | null | undefined;
export type MenuPanelAction = (...args: MenuPanelActionArg[]) => void | boolean | object | null;
export type MenuPanelCallbackLike = (...args: MenuPanelActionArg[]) => void | boolean | object | null;

export interface MenuPanelObjectEntry {
    content: string;
    callback?: MenuPanelCallbackLike;
    title?: string;
    disabled?: boolean;
    has_submenu?: boolean;
    submenu?: { options: MenuPanelEntryList } & ContextMenuOptionsLike;
    className?: string;
    property?: string;
    type?: string;
    slot?: SlotMenuInfo;
}

export type MenuPanelEntry = MenuPanelObjectEntry | DefaultNodeDescriptor | string;
export type MenuPanelEntryList = Array<MenuPanelEntry | null>;

export interface RegisteredNodeType {
    type?: string;
    title?: string;
    desc?: string;
    filter?: string | number | boolean | null;
    [key: string]: unknown;
}

export interface SlotTypeRegistryEntry {
    nodes?: string[];
    [key: string]: unknown;
}

export interface SearchBoxExtraData {
    properties?: Record<string, MenuPanelValue>;
    inputs?: Array<[string, string]>;
    outputs?: Array<[string, string]>;
    title?: string;
    json?: Record<string, unknown>;
}

export interface SearchBoxExtraEntry {
    type: string;
    desc: string;
    data?: SearchBoxExtraData;
}

export type SlotDefinition = (INodeInputSlot | INodeOutputSlot) & {
    removable?: boolean;
    locked?: boolean;
    nameLocked?: boolean;
};

export interface SlotMenuInfo {
    input?: SlotDefinition;
    output?: SlotDefinition;
    slot?: number;
}

export type SlotSelector = string | number | SlotDefinition;

export interface DefaultNodeDescriptor {
    node: string;
    properties?: Record<string, MenuPanelValue>;
    inputs?: Array<[string, string]>;
    outputs?: Array<[string, string]>;
    title?: string;
    json?: Parameters<LGraphNode["configure"]>[0];
}

export type DefaultNodeType = string | DefaultNodeDescriptor;
export type SlotTypeDefault = DefaultNodeType | Record<string, DefaultNodeType>;

export interface ConnectionNodeLike {
    inputs?: SlotDefinition[];
    outputs?: SlotDefinition[];
    findInputSlot: (name: string, returnObj?: boolean) => number | SlotDefinition;
    findOutputSlot: (name: string, returnObj?: boolean) => number | SlotDefinition;
    connectByType: (slot: number | string, target: LGraphNode, slotType: string | number ) => object;
    connectByTypeOutput: (slot: number | string, source: LGraphNode, slotType: string | number ) => object;
}

export interface NodeMenuLike {
    inputs?: SlotDefinition[];
    outputs?: SlotDefinition[];
    type?: string;
    graph?: {
        onGetNodeMenuOptions?: (options: MenuPanelEntryList, node: NodeMenuLike) => void;
        beforeChange?: () => void;
        afterChange?: () => void;
    };
    resizable?: boolean;
    clonable?: boolean;
    removable?: boolean;
    block_delete?: boolean;
    getMenuOptions?: (canvas: MenuActionBuilderCanvasPort) => MenuPanelEntryList;
    getExtraMenuOptions?: (
        canvas: MenuActionBuilderCanvasPort,
        options: MenuPanelEntryList
    ) => MenuPanelEntryList | null | undefined;
    getSlotMenuOptions?: (slot: SlotMenuInfo) => MenuPanelEntryList;
    onGetInputs?: () => unknown[] | null | undefined;
    onGetOutputs?: () => unknown[] | null | undefined;
}


export interface CanvasPointerEventLike extends MouseEvent {
    canvasX: number;
    canvasY: number;
}

export interface ContextMenuNodeLike extends NodeMenuLike {
    graph: {
        beforeChange: () => void;
        afterChange: () => void;
        onGetNodeMenuOptions?: (options: MenuPanelEntryList, node: NodeMenuLike) => void;
    };
    getSlotInPosition?: (x: number, y: number) => SlotMenuInfo | null;
    getInputInfo?: (slot?: number) => SlotDefinition | null;
    getOutputInfo?: (slot?: number) => SlotDefinition | null;
    removeInput: (slot?: number) => void;
    removeOutput: (slot?: number) => void;
    disconnectInput: (slot?: number) => void;
    disconnectOutput: (slot?: number) => void;
}

export interface ContextMenuOptionsLike {
    event?: MouseEvent | CustomEvent | PointerEvent | null;
    title?: string | null;
    className?: string;
    callback?: MenuPanelCallbackLike;
    parentMenu?: object;
    extra?: MenuPanelEntry | object | null;
    [key: string]: unknown;
}

export type NodeTypeRegistry = Record<string, RegisteredNodeType>;
export type SlotTypeRegistry = Record<string, SlotTypeRegistryEntry>;
export type SearchBoxExtraRegistry = Record<string, SearchBoxExtraEntry>;

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
        options?: MenuPanelOptions
    ) => HTMLButtonElement;
    addSeparator: () => void;
    addWidget: (
        type: string,
        name: string,
        value: MenuPanelValue,
        options?: MenuPanelOptions,
        callback?: MenuPanelCallback
    ) => HTMLElement;
    toggleAltContent: (force?: boolean) => void;
    toggleFooterVisibility: (force?: boolean) => void;
    inner_showCodePad?: (propname: string) => void;
    node?: LGraphNode;
    graph?: unknown;
    _floating_cleanup?: (() => void) | null;
}

export type ContextMenuCtor = new (
    values: MenuPanelEntryList,
    options?: ContextMenuOptionsLike,
    refWindow?: Window
) => object;

export interface MenuPanelHost {
    ContextMenu?: ContextMenuCtor;
    ACTION?: number | string;
    EVENT?: number | string;
    NODE_MODES?: string[] | Record<string, string>;
    LINK_RENDER_MODES?: string[];
    availableCanvasOptions?: unknown[];
    slot_types_default_in?: Record<string, SlotTypeDefault>;
    slot_types_default_out?: Record<string, SlotTypeDefault>;
    slot_types_in?: string[];
    slot_types_out?: string[];
    registered_node_types?: NodeTypeRegistry;
    registered_slot_in_types?: SlotTypeRegistry;
    registered_slot_out_types?: SlotTypeRegistry;
    searchbox_extras?: SearchBoxExtraRegistry;
    search_filter_enabled?: boolean;
    search_hide_on_mouse_leave?: boolean;
    search_show_all_on_open?: boolean;
    dialog_close_on_mouse_leave?: boolean;
    dialog_close_on_mouse_leave_delay?: number;
    getTime?: () => number;
    createNode?: (type: string) => LGraphNode | null;
    LGraphGroup?: new (title?: string) => LGraphGroup;
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
    slot_types_default_in: Record<string, SlotTypeDefault>;
    slot_types_default_out: Record<string, SlotTypeDefault>;
    slot_types_in: string[];
    slot_types_out: string[];
    registered_node_types: NodeTypeRegistry;
    registered_slot_in_types: SlotTypeRegistry;
    registered_slot_out_types: SlotTypeRegistry;
    searchbox_extras: SearchBoxExtraRegistry;
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
    onGroupAdd: MenuPanelAction;
    onGroupAlign: MenuPanelAction;
    onMenuAdd: MenuPanelAction;
    showMenuNodeOptionalInputs: MenuPanelAction;
    showMenuNodeOptionalOutputs: MenuPanelAction;
    onShowMenuNodeProperties: MenuPanelAction;
    onShowPropertyEditor: MenuPanelAction;
    onMenuNodeMode: MenuPanelAction;
    onMenuResizeNode: MenuPanelAction;
    onMenuNodeCollapse: MenuPanelAction;
    onMenuNodePin: MenuPanelAction;
    onMenuNodeColors: MenuPanelAction;
    onMenuNodeShapes: MenuPanelAction;
    onMenuNodeClone: MenuPanelAction;
    onMenuNodeToSubgraph: MenuPanelAction;
    onNodeAlign: MenuPanelAction;
    onMenuNodeRemove: MenuPanelAction;
}

export interface SearchBoxGraphPort {
    filter?: unknown;
    beforeChange?: () => void;
    add: (node: LGraphNode, skipComputeOrder?: boolean) => void;
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
    ) => MenuPanelEntryList | null;
    convertEventToCanvasOffset: (event?: MouseEvent) => [number, number];
    focusCanvas: () => void;
}

export interface MenuActionBuilderCanvasPort extends Record<string, unknown> {
    selected_nodes?: Record<string, unknown>;
    _graph_stack?: unknown[];
    closeSubgraph: () => void;
    getMenuOptions?: () => MenuPanelEntryList;
    getExtraMenuOptions?: (
        canvas: unknown,
        options: MenuPanelEntryList
    ) => MenuPanelEntryList | null | undefined;
}
