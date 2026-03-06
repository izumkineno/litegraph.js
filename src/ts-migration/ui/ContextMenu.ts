import type { ContextMenuPort } from "../contracts/ui";
import type { LiteGraphConstantsShape } from "../core/litegraph.constants";
import { createFloatingUiService } from "../services/floating-ui-service";
import type { ContextMenuItem, IContextMenuOptions } from "../types/core-types";

type MenuValueLike = any;
type ContextMenuCallback = (
    value: MenuValueLike,
    options: ContextMenuOptions,
    event: MouseEvent,
    parentMenu: ContextMenu | undefined,
    node: any
) => boolean | void;

interface ContextMenuOptions
    extends Omit<
        IContextMenuOptions,
        "callback" | "ignore_item_callbacks" | "event" | "parentMenu" | "extra"
    > {
    callback?: ContextMenuCallback;
    ignore_item_callbacks?: boolean | Boolean;
    event?: MouseEvent | CustomEvent | PointerEvent | null;
    parentMenu?: ContextMenu;
    autoopen?: boolean;
    title?: string;
    extra?: any;
    className?: string;
    scroll_speed?: number;
    close_on_leave?: boolean;
    close_on_leave_delay?: number;
    left?: number;
    top?: number;
    scale?: number;
    node?: any;
}

interface ContextMenuHost
    extends Pick<LiteGraphConstantsShape, "pointerevents_method" | "isTouchDevice"> {
    pointerListenerAdd: (
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => void;
    pointerListenerRemove: (
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => void;
}

interface MenuElement extends HTMLDivElement {
    value?: MenuValueLike;
    onclick_callback?: (...args: any[]) => unknown;
}

interface MenuRootElement extends HTMLDivElement {
    closing_timer?: ReturnType<typeof setTimeout> | null;
    close?: () => void;
    _floating_cleanup?: (() => void) | null;
}

const defaultHost: ContextMenuHost = {
    pointerevents_method: "mouse",
    isTouchDevice: () =>
        typeof window !== "undefined" &&
        (("ontouchstart" in window) ||
            (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)),
    pointerListenerAdd: (
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => {
        if ("addEventListener" in dom) {
            (dom as any).addEventListener(eventName, callback, !!capture);
        }
    },
    pointerListenerRemove: (
        dom: EventTarget,
        eventName: string,
        callback: EventListenerOrEventListenerObject,
        capture?: boolean
    ) => {
        if ("removeEventListener" in dom) {
            (dom as any).removeEventListener(eventName, callback, !!capture);
        }
    },
};

/**
 * ContextMenu from LiteGUI.
 *
 * Source: `function ContextMenu` + `ContextMenu.prototype.*` + static methods.
 */
export class ContextMenu implements ContextMenuPort {
    static liteGraph?: Partial<ContextMenuHost>;

    options: ContextMenuOptions;
    parentMenu?: ContextMenu;
    lock = false;
    current_submenu?: ContextMenu;
    root: MenuRootElement;

    private static host(): ContextMenuHost {
        return { ...defaultHost, ...(this.liteGraph || {}) };
    }

    /**
     * @constructor
     * @param values allows object `{ title: "Nice text", callback: function ... }`
     * @param options some options: `title/callback/ignore_item_callbacks/event`
     */
    constructor(
        values: ContextMenuItem[],
        options?: ContextMenuOptions,
        ref_window?: Window
    ) {
        this.options = options || {};
        const host = ContextMenu.host();
        const floating = createFloatingUiService({
            ownerDocument:
                (this.options.event as any)?.target?.ownerDocument ||
                ref_window?.document ||
                null,
            ownerWindow: ref_window || null,
            event: this.options.event || null,
            preferFullscreen: true,
        });

        if (this.options.parentMenu) {
            if (this.options.parentMenu.constructor !== this.constructor) {
                console.error("parentMenu must be of class ContextMenu, ignoring it");
                (this.options as any).parentMenu = null;
            } else {
                this.parentMenu = this.options.parentMenu;
                this.parentMenu.lock = true;
                this.parentMenu.current_submenu = this;
            }
        }

        let eventClass: string | null = null;
        if (this.options.event) {
            eventClass = (this.options.event as any).constructor?.name || null;
        }
        if (
            eventClass !== "MouseEvent" &&
            eventClass !== "CustomEvent" &&
            eventClass !== "PointerEvent"
        ) {
            console.error(
                "Event passed to ContextMenu is not of type MouseEvent or CustomEvent. Ignoring it. (" +
                    eventClass +
                    ")"
            );
            this.options.event = null;
        }

        const root = floating.document.createElement("div") as MenuRootElement;
        root.className = "litegraph litecontextmenu litemenubar-panel";
        if (this.options.className) {
            root.className += " " + this.options.className;
        }
        (root.style as any).minWidth = 100;
        (root.style as any).minHeight = 100;
        root.style.pointerEvents = "none";
        setTimeout(() => {
            root.style.pointerEvents = "auto";
        }, 100);

        ContextMenu.host().pointerListenerAdd(
            root,
            "up",
            (e: Event) => {
                e.preventDefault();
                return true;
            },
            true
        );
        root.addEventListener(
            "contextmenu",
            (e: MouseEvent) => {
                if (e.button != 2) {
                    return false;
                }
                e.preventDefault();
                return false;
            },
            true
        );
        ContextMenu.host().pointerListenerAdd(
            root,
            "down",
            (e: Event) => {
                const mouseEvent = e as MouseEvent;
                if (mouseEvent.button == 2) {
                    this.close();
                    mouseEvent.preventDefault();
                    return true;
                }
            },
            true
        );

        const wheelHandler = (e: Event): boolean => {
            const wheelEvent = e as WheelEvent;
            const currentTop = parseInt(root.style.top, 10);
            const speed = this.options.scroll_speed || 0.1;
            root.style.top = (currentTop + wheelEvent.deltaY * speed).toFixed() + "px";
            wheelEvent.preventDefault();
            return true;
        };
        if (!this.options.scroll_speed) {
            this.options.scroll_speed = 0.1;
        }
        const wheelEventOptions: AddEventListenerOptions = {
            capture: true,
            passive: false,
        };
        root.addEventListener("wheel", wheelHandler, wheelEventOptions);
        // `mousewheel` is deprecated; keep it only as a legacy fallback.
        const supportsWheel = "onwheel" in document.createElement("div");
        if (!supportsWheel) {
            root.addEventListener(
                "mousewheel",
                wheelHandler,
                wheelEventOptions
            );
        }

        this.root = root;
        root.close = () => {
            this.close();
        };
        root._floating_cleanup = () => {
            floating.destroy(root);
        };

        if (this.options.title) {
            const title = floating.document.createElement("div");
            title.className = "litemenu-title";
            title.innerHTML = this.options.title;
            root.appendChild(title);
        }

        for (let i = 0; i < values.length; i++) {
            let name = (values as any).constructor == Array ? (values as any)[i] : (i as any);
            if (name != null && name.constructor !== String) {
                name = name.content === undefined ? String(name) : name.content;
            }
            const value = values[i];
            this.addItem(name, value, this.options);
        }

        let close_on_leave = this.options.close_on_leave;
        if (close_on_leave === undefined) {
            close_on_leave = !host.isTouchDevice();
        }
        if (close_on_leave) {
            floating.watchCloseOnLeave({
                element: root,
                onClose: () => {
                    this.close();
                },
                delayMs: this.options.close_on_leave_delay || 500,
                enabled: () => !this.lock,
            });
        }
        floating.watchOutsideClose({
            element: root,
            onClose: () => {
                this.getTopMenu().close();
            },
            ignore: (event: Event) => this.getTopMenu().containsTarget(event.target as Node | null),
        });

        floating.mount(root);

        let left = this.options.left || 0;
        let top = this.options.top || 0;
        if (this.options.event) {
            const event = this.options.event as any;
            left = event.clientX - 10;
            top = event.clientY - 10;
            if (this.options.title) {
                top -= 20;
            }
            if (this.options.parentMenu) {
                const rect = this.options.parentMenu.root.getBoundingClientRect();
                left = rect.left + rect.width;
            }
        }
        floating.place(root, {
            left,
            top,
            scale: this.options.scale,
            clampToBounds: true,
        });
    }

    addItem(name: string, value: MenuValueLike, options?: ContextMenuOptions): MenuElement {
        const resolvedOptions: ContextMenuOptions = options || {};
        const element = document.createElement("div") as MenuElement;
        element.className = "litemenu-entry submenu";
        let disabled = false;

        if (value === null) {
            element.classList.add("separator");
        } else {
            element.innerHTML = value && value.title ? value.title : name;
            element.value = value;
            if (value) {
                if (value.disabled) {
                    disabled = true;
                    element.classList.add("disabled");
                }
                if (value.submenu || value.has_submenu) {
                    element.classList.add("has_submenu");
                }
            }
            if (typeof value == "function") {
                element.dataset.value = name;
                element.onclick_callback = value;
            } else {
                element.dataset.value = value as any;
            }
            if (value && value.className) {
                element.className += " " + value.className;
            }
        }

        this.root.appendChild(element);
        if (!disabled) {
            element.addEventListener("click", inner_onclick);
        }
        if (!disabled && resolvedOptions.autoopen) {
            ContextMenu.host().pointerListenerAdd(element, "enter", inner_over);
        }

        const that = this;
        function inner_over(this: MenuElement, e: Event): void {
            const entryValue = this.value;
            if (!entryValue || !entryValue.has_submenu) {
                return;
            }
            inner_onclick.call(this, e as unknown as MouseEvent);
        }

        function inner_onclick(this: MenuElement, e: MouseEvent): void {
            const entryValue = this.value;
            let close_parent = true;

            if (that.current_submenu) {
                that.current_submenu.close(e);
            }

            if (resolvedOptions.callback) {
                const result = resolvedOptions.callback.call(
                    this,
                    entryValue,
                    resolvedOptions,
                    e,
                    that,
                    resolvedOptions.node
                );
                if (result === true) {
                    close_parent = false;
                }
            }

            if (entryValue) {
                if (
                    entryValue.callback &&
                    !resolvedOptions.ignore_item_callbacks &&
                    entryValue.disabled !== true
                ) {
                    const result = entryValue.callback.call(
                        this,
                        entryValue,
                        resolvedOptions,
                        e,
                        that,
                        resolvedOptions.extra
                    );
                    if (result === true) {
                        close_parent = false;
                    }
                }
                if (entryValue.submenu) {
                    if (!entryValue.submenu.options) {
                        throw "ContextMenu submenu needs options";
                    }
                    new (that.constructor as typeof ContextMenu)(
                        entryValue.submenu.options,
                        {
                            callback: entryValue.submenu.callback,
                            event: e,
                            parentMenu: that,
                            ignore_item_callbacks:
                                entryValue.submenu.ignore_item_callbacks,
                            title: entryValue.submenu.title,
                            extra: entryValue.submenu.extra,
                            autoopen: resolvedOptions.autoopen,
                        }
                    );
                    close_parent = false;
                }
            }

            if (close_parent && !that.lock) {
                that.close();
            }
        }

        return element;
    }

    close(e?: MouseEvent, ignore_parent_menu?: boolean): void {
        if (this.root._floating_cleanup) {
            const cleanup = this.root._floating_cleanup;
            this.root._floating_cleanup = null;
            cleanup();
        }
        if (this.parentMenu && !ignore_parent_menu) {
            this.parentMenu.lock = false;
            (this.parentMenu as any).current_submenu = null;
            if (e === undefined) {
                this.parentMenu.close();
            } else if (e && !ContextMenu.isCursorOverElement(e, this.parentMenu.root)) {
                ContextMenu.trigger(
                    this.parentMenu.root,
                    ContextMenu.host().pointerevents_method + "leave",
                    e
                );
            }
        }
        if (this.current_submenu) {
            this.current_submenu.close(e, true);
        }
        if (this.root.closing_timer) {
            clearTimeout(this.root.closing_timer);
        }

        // TODO implement : LiteGraph.contextMenuClosed(); :: keep track of opened / closed / current ContextMenu
        // on key press, allow filtering/selecting the context menu elements
    }

    private containsTarget(target: Node | null): boolean {
        if (!target) {
            return false;
        }
        if (this.root.contains(target)) {
            return true;
        }
        if (this.current_submenu?.containsTarget(target)) {
            return true;
        }
        return false;
    }

    static trigger(
        element: HTMLElement,
        event_name: string,
        params: any,
        origin?: HTMLElement
    ): CustomEvent {
        const detail =
            origin === undefined
                ? params
                : {
                      params,
                      origin,
                  };
        const evt = new CustomEvent(event_name, {
            bubbles: true,
            cancelable: true,
            detail,
        });
        if (element.dispatchEvent) {
            element.dispatchEvent(evt);
        } else if ((element as any).__events) {
            (element as any).__events.dispatchEvent(evt);
        }
        return evt;
    }

    getTopMenu(): ContextMenu {
        if (this.options.parentMenu) {
            return this.options.parentMenu.getTopMenu();
        }
        return this;
    }

    getFirstEvent(): MouseEvent | CustomEvent | PointerEvent | null | undefined {
        if (this.options.parentMenu) {
            return this.options.parentMenu.getFirstEvent();
        }
        return this.options.event;
    }

    static isCursorOverElement(event: MouseEvent, element: HTMLElement): boolean {
        const left = event.clientX;
        const top = event.clientY;
        const rect = element.getBoundingClientRect();
        if (!rect) {
            return false;
        }
        return (
            top > rect.top &&
            top < rect.top + rect.height &&
            left > rect.left &&
            left < rect.left + rect.width
        );
    }

    static closeAllContextMenus(ref_window?: Window): void {
        const targetWindow = ref_window || window;
        const elements = targetWindow.document.querySelectorAll(".litecontextmenu");
        if (!elements.length) {
            return;
        }

        const list: HTMLElement[] = [];
        for (let i = 0; i < elements.length; i++) {
            list.push(elements[i] as HTMLElement);
        }
        for (let i = 0; i < list.length; i++) {
            const element = list[i] as any;
            if (element.close) {
                element.close();
            } else if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
    }
}
