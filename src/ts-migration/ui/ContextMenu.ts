// TODO: Import full LiteGraph runtime host from its future module

import type { ContextMenuItem, IContextMenuOptions } from "../types/core-types";

type MenuValueLike = any;
type ContextMenuCallback = (
    value: MenuValueLike,
    options: ContextMenuOptions,
    event: MouseEvent,
    parentMenu: ContextMenu | undefined,
    node: any
) => boolean | void;

interface ContextMenuOptions extends IContextMenuOptions {
    callback?: ContextMenuCallback;
    ignore_item_callbacks?: boolean;
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

interface ContextMenuHost {
    pointerevents_method: "mouse" | "pointer" | "touch" | string;
    isTouchDevice: () => boolean;
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
export class ContextMenu {
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

        const root = document.createElement("div") as MenuRootElement;
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
            (e: MouseEvent) => {
                if (e.button == 2) {
                    this.close();
                    e.preventDefault();
                    return true;
                }
            },
            true
        );

        const wheelHandler = (e: WheelEvent): boolean => {
            const currentTop = parseInt(root.style.top, 10);
            const speed = this.options.scroll_speed || 0.1;
            root.style.top = (currentTop + e.deltaY * speed).toFixed() + "px";
            e.preventDefault();
            return true;
        };
        if (!this.options.scroll_speed) {
            this.options.scroll_speed = 0.1;
        }
        const wheelEventOptions: AddEventListenerOptions = {
            capture: true,
            passive: false,
        };
        root.addEventListener(
            "wheel",
            wheelHandler as EventListener,
            wheelEventOptions
        );
        // `mousewheel` is deprecated; keep it only as a legacy fallback.
        if (!("onwheel" in root)) {
            root.addEventListener(
                "mousewheel",
                wheelHandler as EventListener,
                wheelEventOptions
            );
        }

        this.root = root;

        if (this.options.title) {
            const title = document.createElement("div");
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
            host.pointerListenerAdd(root, "leave", (e: Event) => {
                if (this.lock) {
                    return;
                }
                if (root.closing_timer) {
                    clearTimeout(root.closing_timer);
                }
                root.closing_timer = setTimeout(
                    this.close.bind(this, e as unknown as MouseEvent),
                    this.options.close_on_leave_delay || 500
                );
            });
        }
        host.pointerListenerAdd(root, "enter", () => {
            if (root.closing_timer) {
                clearTimeout(root.closing_timer);
            }
        });

        let root_document = document;
        if (this.options.event) {
            root_document = (this.options.event as any).target.ownerDocument;
        }
        if (!root_document) {
            root_document = (ref_window && ref_window.document) || document;
        }
        if (root_document.fullscreenElement) {
            root_document.fullscreenElement.appendChild(root);
        } else {
            root_document.body.appendChild(root);
        }

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
            const body_rect = document.body.getBoundingClientRect();
            const root_rect = root.getBoundingClientRect();
            if (body_rect.height == 0) {
                console.error(
                    "document.body height is 0. That is dangerous, set html,body { height: 100%; }"
                );
            }
            if (body_rect.width && left > body_rect.width - root_rect.width - 10) {
                left = body_rect.width - root_rect.width - 10;
            }
            if (body_rect.height && top > body_rect.height - root_rect.height - 10) {
                top = body_rect.height - root_rect.height - 10;
            }
        }
        root.style.left = left + "px";
        root.style.top = top + "px";
        if (this.options.scale) {
            root.style.transform = "scale(" + this.options.scale + ")";
        }
    }

    addItem(name: string, value: MenuValueLike, options?: ContextMenuOptions): MenuElement {
        options = options || {};
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
        if (!disabled && options.autoopen) {
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

            if (options.callback) {
                const result = options.callback.call(
                    this,
                    entryValue,
                    options,
                    e,
                    that,
                    options.node
                );
                if (result === true) {
                    close_parent = false;
                }
            }

            if (entryValue) {
                if (
                    entryValue.callback &&
                    !options.ignore_item_callbacks &&
                    entryValue.disabled !== true
                ) {
                    const result = entryValue.callback.call(
                        this,
                        entryValue,
                        options,
                        e,
                        that,
                        options.extra
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
                            autoopen: options.autoopen,
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
        if (this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
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
