import type {
    MenuPanelCanvasClassPort,
    MenuPanelHost,
    PanelLike,
} from "./menu-panel-types";

export interface PanelFactoryContext {
    host: MenuPanelHost;
    menuClass: MenuPanelCanvasClassPort;
    window: Window;
}

export function createPanel(
    context: PanelFactoryContext,
    title: string,
    options?: any
): PanelLike {
    const root = document.createElement("div") as PanelLike;
    const host = context.host;
    const menuClass = context.menuClass;
    const panelOptions = options || {};
    const ref_window = panelOptions.window || context.window;

    root.className = "litegraph dialog";
    root.innerHTML =
        "<div class='dialog-header'><span class='dialog-title'></span></div><div class='dialog-content'></div><div style='display:none;' class='dialog-alt-content'></div><div class='dialog-footer'></div>";
    root.header = root.querySelector(".dialog-header") as HTMLElement;
    if (panelOptions.width) {
        root.style.width =
            panelOptions.width +
            (panelOptions.width.constructor === Number ? "px" : "");
    }
    if (panelOptions.height) {
        root.style.height =
            panelOptions.height +
            (panelOptions.height.constructor === Number ? "px" : "");
    }
    if (panelOptions.closable) {
        const close = document.createElement("span");
        close.innerHTML = "&#10005;";
        close.classList.add("close");
        close.addEventListener("click", () => root.close());
        root.header.appendChild(close);
    }
    root.title_element = root.querySelector(".dialog-title") as HTMLElement;
    root.title_element.innerText = title;
    root.content = root.querySelector(".dialog-content") as HTMLElement;
    root.alt_content = root.querySelector(".dialog-alt-content") as HTMLElement;
    root.footer = root.querySelector(".dialog-footer") as HTMLElement;
    (root as any).onOpen = panelOptions.onOpen;
    (root as any).onClose = panelOptions.onClose;

    root.close = () => {
        (root as any).onClose?.();
        root.parentNode?.removeChild(root);
    };
    root.toggleAltContent = (force?: boolean) => {
        const showAlt =
            typeof force !== "undefined"
                ? !!force
                : root.alt_content.style.display !== "block";
        root.alt_content.style.display = showAlt ? "block" : "none";
        root.content.style.display = showAlt ? "none" : "block";
    };
    root.toggleFooterVisibility = (force?: boolean) => {
        const show =
            typeof force !== "undefined"
                ? !!force
                : root.footer.style.display !== "block";
        root.footer.style.display = show ? "block" : "none";
    };
    root.clear = () => {
        root.content.innerHTML = "";
    };
    root.addHTML = (code: string, className?: string, on_footer?: boolean) => {
        const elem = document.createElement("div");
        if (className) {
            elem.className = className;
        }
        elem.innerHTML = code;
        if (on_footer) {
            root.footer.appendChild(elem);
        } else {
            root.content.appendChild(elem);
        }
        return elem;
    };
    root.addButton = (
        name: string,
        callback: (e: MouseEvent) => void,
        buttonOptions?: any
    ) => {
        const elem = document.createElement("button");
        elem.innerText = name;
        (elem as any).options = buttonOptions;
        elem.classList.add("btn");
        elem.addEventListener("click", callback);
        root.footer.appendChild(elem);
        return elem;
    };
    root.addSeparator = () => {
        const elem = document.createElement("div");
        elem.className = "separator";
        root.content.appendChild(elem);
    };
    root.addWidget = (
        type: string,
        name: string,
        value: any,
        widgetOptions?: any,
        callback?: (name: string, value: any, options?: any) => void
    ) => {
        const localOpts = widgetOptions || {};
        type = String(type || "string").toLowerCase();
        let strValue = String(value);
        if (type === "number" && typeof value === "number") {
            strValue = value.toFixed(3);
        }

        const elem = document.createElement("div") as any;
        elem.className = "property";
        elem.innerHTML =
            "<span class='property_name'></span><span class='property_value'></span>";
        (elem.querySelector(".property_name") as HTMLElement).innerText =
            localOpts.label || name;
        const valueElement = elem.querySelector(".property_value") as HTMLElement;
        valueElement.innerText = strValue;
        elem.dataset.property = name;
        elem.dataset.type = localOpts.type || type;
        elem.options = localOpts;
        elem.value = value;

        const change = (key: string, nextValue: any): void => {
            localOpts.callback?.(key, nextValue, localOpts);
            callback?.(key, nextValue, localOpts);
        };

        if (type === "code") {
            elem.addEventListener("click", function(this: any) {
                root.inner_showCodePad?.(this.dataset.property);
            });
        } else if (type === "boolean") {
            elem.classList.add("boolean");
            if (value) {
                elem.classList.add("bool-on");
            }
            elem.addEventListener("click", function(this: any) {
                const propname = this.dataset.property;
                this.value = !this.value;
                this.classList.toggle("bool-on");
                (this.querySelector(".property_value") as HTMLElement).innerText =
                    this.value ? "true" : "false";
                change(propname, this.value);
            });
        } else if (type === "string" || type === "number") {
            valueElement.setAttribute("contenteditable", "true");
            valueElement.addEventListener("keydown", (e: KeyboardEvent) => {
                if (e.code === "Enter" && (type !== "string" || !e.shiftKey)) {
                    e.preventDefault();
                    valueElement.blur();
                }
            });
            valueElement.addEventListener("blur", function(this: HTMLElement) {
                let nextValue: any = this.innerText;
                const prop = (this.parentNode as HTMLElement).dataset.property as string;
                if ((this.parentNode as HTMLElement).dataset.type === "number") {
                    nextValue = Number(nextValue);
                }
                change(prop, nextValue);
            });
        } else if (type === "enum" || type === "combo") {
            valueElement.innerText =
                menuClass.getPropertyPrintableValue?.(value, localOpts.values) ||
                String(value);
            valueElement.addEventListener("click", (event: MouseEvent) => {
                const values = localOpts.values || [];
                const propname = (valueElement.parentNode as HTMLElement).dataset
                    .property as string;
                new (host.ContextMenu as NonNullable<MenuPanelHost["ContextMenu"]>)(
                    values,
                    {
                        event,
                        className: "dark",
                        callback: (selectedValue: any) => {
                            valueElement.innerText = String(selectedValue);
                            change(propname, selectedValue);
                            return false;
                        },
                    },
                    ref_window
                );
            });
        }

        root.content.appendChild(elem);
        return elem;
    };

    (root as any).onOpen?.();
    return root;
}
