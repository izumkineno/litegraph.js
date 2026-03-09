import type { Vector2 } from "../types/core-types";
import type { LGraphNodeConstructorLike as RegistryLGraphNodeConstructorLike } from "./litegraph.registry";
export type LGraphNodeConstructorLike = RegistryLGraphNodeConstructorLike;
export type BreakLinkModifier = "shift" | "alt" | "ctrl" | "meta";
export type BreakLinkModifierConfig = BreakLinkModifier | BreakLinkModifier[];
export interface ModifierEventLike {
    shiftKey?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
}
export interface SearchboxExtraItem {
    data: {
        outputs: string[][];
        title: string;
    };
    desc: string;
    type: string;
}
/**
 * The Global Scope constants/config subset.
 * Source: `src/litegraph.js` LiteGraph object constant block.
 */
export interface LiteGraphConstantsShape {
    VERSION: number;
    CANVAS_GRID_SIZE: number;
    NODE_TITLE_HEIGHT: number;
    NODE_TITLE_TEXT_Y: number;
    NODE_SLOT_HEIGHT: number;
    NODE_WIDGET_HEIGHT: number;
    NODE_WIDTH: number;
    NODE_MIN_WIDTH: number;
    NODE_COLLAPSED_RADIUS: number;
    NODE_COLLAPSED_WIDTH: number;
    NODE_TITLE_COLOR: string;
    NODE_SELECTED_TITLE_COLOR: string;
    NODE_TEXT_SIZE: number;
    NODE_TEXT_COLOR: string;
    NODE_SUBTEXT_SIZE: number;
    NODE_DEFAULT_COLOR: string;
    NODE_DEFAULT_BGCOLOR: string;
    NODE_DEFAULT_BOXCOLOR: string;
    NODE_DEFAULT_SHAPE: string;
    NODE_BOX_OUTLINE_COLOR: string;
    DEFAULT_SHADOW_COLOR: string;
    DEFAULT_GROUP_FONT: number;
    WIDGET_BGCOLOR: string;
    WIDGET_OUTLINE_COLOR: string;
    WIDGET_TEXT_COLOR: string;
    WIDGET_SECONDARY_TEXT_COLOR: string;
    LINK_COLOR: string;
    EVENT_LINK_COLOR: string;
    CONNECTING_LINK_COLOR: string;
    MAX_NUMBER_OF_NODES: number;
    DEFAULT_POSITION: Vector2;
    VALID_SHAPES: ["default", "box", "round", "card"];
    BOX_SHAPE: 1;
    ROUND_SHAPE: 2;
    CIRCLE_SHAPE: 3;
    CARD_SHAPE: 4;
    ARROW_SHAPE: 5;
    GRID_SHAPE: 6;
    INPUT: 1;
    OUTPUT: 2;
    EVENT: -1;
    ACTION: -1;
    NODE_MODES: [string, string, string, string];
    NODE_MODES_COLORS: [string, string, string, string, string];
    ALWAYS: 0;
    ON_EVENT: 1;
    NEVER: 2;
    ON_TRIGGER: 3;
    UP: 1;
    DOWN: 2;
    LEFT: 3;
    RIGHT: 4;
    CENTER: 5;
    LINK_RENDER_MODES: [string, string, string];
    STRAIGHT_LINK: 0;
    LINEAR_LINK: 1;
    SPLINE_LINK: 2;
    NORMAL_TITLE: 0;
    NO_TITLE: 1;
    TRANSPARENT_TITLE: 2;
    AUTOHIDE_TITLE: 3;
    VERTICAL_LAYOUT: "vertical";
    proxy: unknown;
    node_images_path: string;
    debug: boolean;
    catch_exceptions: boolean;
    throw_errors: boolean;
    /** if set to true some nodes like Formula would be allowed to evaluate code that comes from unsafe sources (like node configuration), which could lead to exploits */
    allow_scripts: boolean;
    use_deferred_actions: boolean;
    registered_node_types: Record<string, LGraphNodeConstructorLike>;
    node_types_by_file_extension: Record<string, LGraphNodeConstructorLike>;
    Nodes: Record<string, LGraphNodeConstructorLike>;
    Globals: Record<string, unknown>;
    searchbox_extras: Record<string, SearchboxExtraItem>;
    auto_sort_node_types: boolean;
    node_box_coloured_when_on: boolean;
    node_box_coloured_by_mode: boolean;
    dialog_close_on_mouse_leave: boolean;
    dialog_close_on_mouse_leave_delay: number;
    shift_click_do_break_link_from: boolean | BreakLinkModifierConfig;
    click_do_break_link_from_key: BreakLinkModifierConfig;
    isBreakLinkModifierPressed: (e?: ModifierEventLike | null) => boolean;
    click_do_break_link_to: boolean;
    search_hide_on_mouse_leave: boolean;
    search_filter_enabled: boolean;
    search_show_all_on_open: boolean;
    auto_load_slot_types: boolean;
    registered_slot_in_types: Record<string, unknown>;
    registered_slot_out_types: Record<string, unknown>;
    slot_types_in: string[];
    slot_types_out: string[];
    slot_types_default_in: unknown[];
    slot_types_default_out: unknown[];
    alt_drag_do_clone_nodes: boolean;
    do_add_triggers_slots: boolean;
    allow_multi_output_for_events: boolean;
    middle_click_slot_add_default_node: boolean;
    release_link_on_empty_shows_menu: boolean;
    pointerevents_method: "mouse" | "pointer" | "touch";
    isTouchDevice: () => boolean;
    ctrl_shift_v_paste_connect_unselected_outputs: boolean;
    use_uuids: boolean;
}
export declare const LiteGraphConstants: LiteGraphConstantsShape;
