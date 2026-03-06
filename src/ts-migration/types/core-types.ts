import type { LGraphCanvasMenuPanel as LGraphCanvasLike } from "../canvas/LGraphCanvas.menu-panel";
import type { LGraphNodeCanvasCollab as LGraphNodeLike } from "../models/LGraphNode.canvas-collab";
import type { ContextMenu as ContextMenuLike } from "../ui/ContextMenu";

export type Vector2 = [number, number];
export type Vector4 = [number, number, number, number];

export type widgetTypes =
    | "number"
    | "slider"
    | "combo"
    | "text"
    | "toggle"
    | "button";

/**
 * Slot shape ids used by litegraph:
 * BOX=1, CIRCLE=3, ARROW=5, SQUARE=6
 * The source runtime also allows custom numeric values.
 */
export type SlotShape = 1 | 3 | 5 | 6 | number;

export type NodeLinkId = number;

/** https://github.com/jagenjo/litegraph.js/tree/master/guides#node-slots */
export interface INodeSlot {
    name: string;
    type: string | -1;
    label?: string;
    dir?: 1 | 2 | 3 | 4;
    color_on?: string;
    color_off?: string;
    shape?: SlotShape;
    locked?: boolean;
    nameLocked?: boolean;
}

export interface INodeInputSlot extends INodeSlot {
    link: NodeLinkId | null;
}

export interface INodeOutputSlot extends INodeSlot {
    links: NodeLinkId[] | null;
}

export type WidgetCallback<T extends IWidget = IWidget> = (
    this: T,
    value: T["value"],
    graphCanvas: LGraphCanvasLike,
    node: LGraphNodeLike,
    pos: Vector2,
    event?: MouseEvent
) => void;

export interface IWidget<TValue = any, TOptions = any> {
    name: string | null;
    value: TValue;
    options?: TOptions;
    type?: widgetTypes;
    y?: number;
    property?: string;
    last_y?: number;
    clicked?: boolean;
    marker?: boolean;
    callback?: WidgetCallback<this>;
    /** Called by `LGraphCanvas.drawNodeWidgets` */
    draw?(
        ctx: CanvasRenderingContext2D,
        node: LGraphNodeLike,
        width: number,
        posY: number,
        height: number
    ): void;
    /**
     * Called by `LGraphCanvas.processNodeWidgets`
     * https://github.com/jagenjo/litegraph.js/issues/76
     */
    mouse?(event: MouseEvent, pos: Vector2, node: LGraphNodeLike): boolean;
    /** Called by `LGraphNode.computeSize` */
    computeSize?(width: number): [number, number];
}

export interface IButtonWidget extends IWidget<null, {}> {
    type: "button";
}

export interface IToggleWidget
    extends IWidget<boolean, { on?: string; off?: string }> {
    type: "toggle";
}

export interface ISliderWidget
    extends IWidget<number, { max: number; min: number }> {
    type: "slider";
}

export interface INumberWidget
    extends IWidget<number, { precision: number }> {
    type: "number";
}

export interface IComboWidget
    extends IWidget<
        string[],
        {
            values:
                | string[]
                | ((widget: IComboWidget, node: LGraphNodeLike) => string[]);
        }
    > {
    type: "combo";
}

export interface ITextWidget extends IWidget<string, {}> {
    type: "text";
}

export interface IContextMenuItem {
    content: string;
    callback?: ContextMenuEventListener;
    /** Used as innerHTML for extra child element */
    title?: string;
    disabled?: boolean;
    has_submenu?: boolean;
    submenu?: {
        options: ContextMenuItem[];
    } & IContextMenuOptions;
    className?: string;
}

export interface IContextMenuOptions {
    callback?: ContextMenuEventListener;
    ignore_item_callbacks?: Boolean;
    event?: MouseEvent | CustomEvent;
    parentMenu?: ContextMenuLike;
    autoopen?: boolean;
    title?: string;
    extra?: any;
}

export type ContextMenuItem = IContextMenuItem | null;

export type ContextMenuEventListener = (
    value: ContextMenuItem,
    options: IContextMenuOptions,
    event: MouseEvent,
    parentMenu: ContextMenuLike | undefined,
    node: LGraphNodeLike
) => boolean | void;
