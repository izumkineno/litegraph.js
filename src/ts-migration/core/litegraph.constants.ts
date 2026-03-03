// TODO: Import LGraphNodeConstructor from its future module

import type { Vector2 } from "../types/core-types";

export type BreakLinkModifier = "shift" | "alt" | "ctrl" | "meta";
export type BreakLinkModifierConfig =
    | BreakLinkModifier
    | BreakLinkModifier[];

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

export type LGraphNodeConstructorLike = new (...args: unknown[]) => unknown;

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

    // shapes are used for nodes but also for slots
    BOX_SHAPE: 1;
    ROUND_SHAPE: 2;
    CIRCLE_SHAPE: 3;
    CARD_SHAPE: 4;
    ARROW_SHAPE: 5;
    GRID_SHAPE: 6;

    // enums
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

    // set these values if not using auto_load_slot_types
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

    // if true, all newly created nodes/links will use string UUIDs for their id fields instead of integers.
    // use this if you must have node IDs that are unique across all graphs and subgraphs.
    use_uuids: boolean;
}

export const LiteGraphConstants: LiteGraphConstantsShape = {
    VERSION: 0.4,

    CANVAS_GRID_SIZE: 10,

    NODE_TITLE_HEIGHT: 30,
    NODE_TITLE_TEXT_Y: 20,
    NODE_SLOT_HEIGHT: 20,
    NODE_WIDGET_HEIGHT: 20,
    NODE_WIDTH: 140,
    NODE_MIN_WIDTH: 50,
    NODE_COLLAPSED_RADIUS: 10,
    NODE_COLLAPSED_WIDTH: 80,
    NODE_TITLE_COLOR: "#999",
    NODE_SELECTED_TITLE_COLOR: "#FFF",
    NODE_TEXT_SIZE: 14,
    NODE_TEXT_COLOR: "#AAA",
    NODE_SUBTEXT_SIZE: 12,
    NODE_DEFAULT_COLOR: "#333",
    NODE_DEFAULT_BGCOLOR: "#353535",
    NODE_DEFAULT_BOXCOLOR: "#666",
    NODE_DEFAULT_SHAPE: "box",
    NODE_BOX_OUTLINE_COLOR: "#FFF",
    DEFAULT_SHADOW_COLOR: "rgba(0,0,0,0.5)",
    DEFAULT_GROUP_FONT: 24,

    WIDGET_BGCOLOR: "#222",
    WIDGET_OUTLINE_COLOR: "#666",
    WIDGET_TEXT_COLOR: "#DDD",
    WIDGET_SECONDARY_TEXT_COLOR: "#999",

    LINK_COLOR: "#9A9",
    EVENT_LINK_COLOR: "#A86",
    CONNECTING_LINK_COLOR: "#AFA",

    MAX_NUMBER_OF_NODES: 1000, // avoid infinite loops
    DEFAULT_POSITION: [100, 100], // default node position
    VALID_SHAPES: ["default", "box", "round", "card"], // , "circle"

    // shapes are used for nodes but also for slots
    BOX_SHAPE: 1,
    ROUND_SHAPE: 2,
    CIRCLE_SHAPE: 3,
    CARD_SHAPE: 4,
    ARROW_SHAPE: 5,
    GRID_SHAPE: 6, // intended for slot arrays

    // enums
    INPUT: 1,
    OUTPUT: 2,

    EVENT: -1, // for outputs
    ACTION: -1, // for inputs

    NODE_MODES: ["Always", "On Event", "Never", "On Trigger"], // helper, will add "On Request" and more in the future
    NODE_MODES_COLORS: ["#666", "#422", "#333", "#224", "#626"], // use with node_box_coloured_by_mode
    ALWAYS: 0,
    ON_EVENT: 1,
    NEVER: 2,
    ON_TRIGGER: 3,

    UP: 1,
    DOWN: 2,
    LEFT: 3,
    RIGHT: 4,
    CENTER: 5,

    LINK_RENDER_MODES: ["Straight", "Linear", "Spline"], // helper
    STRAIGHT_LINK: 0,
    LINEAR_LINK: 1,
    SPLINE_LINK: 2,

    NORMAL_TITLE: 0,
    NO_TITLE: 1,
    TRANSPARENT_TITLE: 2,
    AUTOHIDE_TITLE: 3,
    VERTICAL_LAYOUT: "vertical", // arrange nodes vertically

    proxy: null, // used to redirect calls
    node_images_path: "",

    debug: false,
    catch_exceptions: true,
    throw_errors: true,
    allow_scripts: false, // if set to true some nodes like Formula would be allowed to evaluate code that comes from unsafe sources (like node configuration), which could lead to exploits
    use_deferred_actions: true, // executes actions during the graph execution flow
    registered_node_types: {}, // nodetypes by string
    node_types_by_file_extension: {}, // used for dropping files in the canvas
    Nodes: {}, // node types by classname
    Globals: {}, // used to store vars between graphs

    searchbox_extras: {}, // used to add extra features to the search box
    auto_sort_node_types: false, // [true!] If set to true, will automatically sort node types / categories in the context menus

    node_box_coloured_when_on: false, // [true!] this make the nodes box (top left circle) coloured when triggered (execute/action), visual feedback
    node_box_coloured_by_mode: false, // [true!] nodebox based on node mode, visual feedback

    dialog_close_on_mouse_leave: true, // [false on mobile] better true if not touch device
    dialog_close_on_mouse_leave_delay: 500,

    shift_click_do_break_link_from: true, // [false!] set true to enable disconnect shortcut from output slots
    click_do_break_link_from_key: "shift", // "shift"|"alt"|"ctrl"|"meta"|Array<string>
    isBreakLinkModifierPressed: function(e?: ModifierEventLike | null): boolean {
        if (!e || !LiteGraphConstants.shift_click_do_break_link_from) {
            return false;
        }

        let breakMod: BreakLinkModifierConfig =
            LiteGraphConstants.click_do_break_link_from_key;
        if (
            LiteGraphConstants.shift_click_do_break_link_from !== true &&
            LiteGraphConstants.shift_click_do_break_link_from !== false
        ) {
            breakMod = LiteGraphConstants.shift_click_do_break_link_from;
        }

        const hasModifier = (modifier?: string): boolean => {
            const mod = String(modifier || "").toLowerCase();
            return (
                (mod === "shift" && !!e.shiftKey) ||
                (mod === "alt" && !!e.altKey) ||
                (mod === "ctrl" && !!e.ctrlKey) ||
                (mod === "meta" && !!e.metaKey)
            );
        };

        if (Array.isArray(breakMod)) {
            return breakMod.some(hasModifier);
        }
        return hasModifier(breakMod || "shift");
    },
    click_do_break_link_to: false, // [false!] prefer false, way too easy to break links

    search_hide_on_mouse_leave: true, // [false on mobile] better true if not touch device
    search_filter_enabled: false, // [true!] enable filtering slots type in the search widget, !requires auto_load_slot_types or manual set registered_slot_[in/out]_types and slot_types_[in/out]
    search_show_all_on_open: true, // [true!] opens the results list when opening the search widget

    auto_load_slot_types: false, // [if want false, use true, run, get vars values to be statically set, than disable] nodes types and nodeclass association with node types need to be calculated, if dont want this, calculate once and set registered_slot_[in/out]_types and slot_types_[in/out]

    // set these values if not using auto_load_slot_types
    registered_slot_in_types: {}, // slot types for nodeclass
    registered_slot_out_types: {}, // slot types for nodeclass
    slot_types_in: [], // slot types IN
    slot_types_out: [], // slot types OUT
    slot_types_default_in: [], // specify for each IN slot type a(/many) default node(s), use single string, array, or object (with node, title, parameters, ..) like for search
    slot_types_default_out: [], // specify for each OUT slot type a(/many) default node(s), use single string, array, or object (with node, title, parameters, ..) like for search

    alt_drag_do_clone_nodes: false, // [true!] very handy, ALT click to clone and drag the new node

    do_add_triggers_slots: false, // [true!] will create and connect event slots when using action/events connections, !WILL CHANGE node mode when using onTrigger (enable mode colors), onExecuted does not need this

    allow_multi_output_for_events: true, // [false!] being events, it is strongly reccomended to use them sequentially, one by one

    middle_click_slot_add_default_node: false, // [true!] allows to create and connect a ndoe clicking with the third button (wheel)

    release_link_on_empty_shows_menu: false, // [true!] dragging a link to empty space will open a menu, add from list, search or defaults

    pointerevents_method: "mouse", // "mouse"|"pointer"|"touch"

    isTouchDevice: function(): boolean {
        if (typeof navigator === "undefined" || typeof window === "undefined") {
            return false;
        }
        if (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) {
            return true;
        }
        if (
            window.matchMedia &&
            window.matchMedia("(pointer: coarse)").matches
        ) {
            return true;
        }
        return "ontouchstart" in window;
    },

    ctrl_shift_v_paste_connect_unselected_outputs: false, // [true!] allows ctrl + shift + v to paste nodes with the outputs of the unselected nodes connected with the inputs of the newly pasted nodes

    // if true, all newly created nodes/links will use string UUIDs for their id fields instead of integers.
    // use this if you must have node IDs that are unique across all graphs and subgraphs.
    use_uuids: false,
};

