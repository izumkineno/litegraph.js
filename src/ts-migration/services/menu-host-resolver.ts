import type {
    MenuPanelHost,
    ResolvedMenuPanelCanvasClassPort,
    ResolvedMenuPanelHost,
} from "./menu-panel-types";

const emptyMenuHost: MenuPanelHost = {};
const menuHostCache = new WeakMap<
    object,
    WeakMap<object, ResolvedMenuPanelHost>
>();

class DefaultContextMenu {
    constructor(_values: unknown, _options?: unknown, _window?: Window) {}
}

function defaultPointerListenerAdd(
    dom: EventTarget,
    ev: string,
    cb: EventListenerOrEventListenerObject,
    capture?: boolean
): void {
    if ("addEventListener" in dom) {
        (dom as EventTarget & {
            addEventListener: EventTarget["addEventListener"];
        }).addEventListener(ev, cb as EventListener, !!capture);
    }
}

function defaultPointerListenerRemove(
    dom: EventTarget,
    ev: string,
    cb: EventListenerOrEventListenerObject,
    capture?: boolean
): void {
    if ("removeEventListener" in dom) {
        (dom as EventTarget & {
            removeEventListener: EventTarget["removeEventListener"];
        }).removeEventListener(ev, cb as EventListener, !!capture);
    }
}

export function resolveMenuPanelHost(
    litegraph: Partial<MenuPanelHost> | null | undefined,
    menuClass: ResolvedMenuPanelCanvasClassPort
): ResolvedMenuPanelHost {
    const sourceHost =
        litegraph && typeof litegraph === "object" ? litegraph : emptyMenuHost;
    const classKey = menuClass as unknown as object;

    let classCache = menuHostCache.get(sourceHost);
    if (!classCache) {
        classCache = new WeakMap<object, ResolvedMenuPanelHost>();
        menuHostCache.set(sourceHost, classCache);
    }

    const cached = classCache.get(classKey);
    if (cached) {
        return cached;
    }

    const resolved: ResolvedMenuPanelHost = {
        ...sourceHost,
        ContextMenu:
            sourceHost.ContextMenu ||
            (menuClass.ContextMenu as ResolvedMenuPanelHost["ContextMenu"]) ||
            DefaultContextMenu,
        ACTION: sourceHost.ACTION ?? -1,
        EVENT: sourceHost.EVENT ?? -1,
        NODE_MODES:
            sourceHost.NODE_MODES || ["Always", "On Event", "Never", "On Trigger"],
        LINK_RENDER_MODES: sourceHost.LINK_RENDER_MODES || [
            "Straight",
            "Linear",
            "Spline",
        ],
        availableCanvasOptions: sourceHost.availableCanvasOptions || [],
        slot_types_default_in: sourceHost.slot_types_default_in || {},
        slot_types_default_out: sourceHost.slot_types_default_out || {},
        slot_types_in: sourceHost.slot_types_in || [],
        slot_types_out: sourceHost.slot_types_out || [],
        registered_node_types: sourceHost.registered_node_types || {},
        registered_slot_in_types: sourceHost.registered_slot_in_types || {},
        registered_slot_out_types: sourceHost.registered_slot_out_types || {},
        searchbox_extras: sourceHost.searchbox_extras || {},
        search_filter_enabled: !!sourceHost.search_filter_enabled,
        search_hide_on_mouse_leave: !!sourceHost.search_hide_on_mouse_leave,
        search_show_all_on_open: !!sourceHost.search_show_all_on_open,
        dialog_close_on_mouse_leave: sourceHost.dialog_close_on_mouse_leave ?? true,
        dialog_close_on_mouse_leave_delay:
            sourceHost.dialog_close_on_mouse_leave_delay ?? 500,
        getTime: sourceHost.getTime || (() => Date.now()),
        createNode: sourceHost.createNode || ((_type: string) => null),
        pointerListenerAdd:
            sourceHost.pointerListenerAdd || defaultPointerListenerAdd,
        pointerListenerRemove:
            sourceHost.pointerListenerRemove || defaultPointerListenerRemove,
    };

    classCache.set(classKey, resolved);
    return resolved;
}
