import type { DialogLike } from "./menu-panel-types";

export interface PropertyValueDialogContext {
    createDialog: (html: string, options?: any) => DialogLike;
}

export function showEditPropertyValueDialog(
    context: PropertyValueDialogContext,
    node: any,
    property: any,
    options: any
): DialogLike | void {
    if (!node || node.properties[property] === undefined) {
        return;
    }

    options = options || {};

    const info = node.getPropertyInfo(property);
    const type = info.type;

    let inputHtml = "";

    if (type == "string" || type == "number" || type == "array" || type == "object") {
        inputHtml = "<input autofocus type='text' class='value'/>";
    } else if ((type == "enum" || type == "combo") && info.values) {
        inputHtml = "<select autofocus type='text' class='value'>";
        for (const key in info.values) {
            let value: any = key;
            if (info.values.constructor === Array) {
                value = info.values[key];
            }

            inputHtml +=
                "<option value='" +
                value +
                "' " +
                (value == node.properties[property] ? "selected" : "") +
                ">" +
                info.values[key] +
                "</option>";
        }
        inputHtml += "</select>";
    } else if (type == "boolean" || type == "toggle") {
        inputHtml =
            "<input autofocus type='checkbox' class='value' " +
            (node.properties[property] ? "checked" : "") +
            "/>";
    } else {
        console.warn("unknown type: " + type);
        return;
    }

    const dialog = context.createDialog(
        "<span class='name'>" +
            (info.label ? info.label : property) +
            "</span>" +
            inputHtml +
            "<button>OK</button>",
        options
    );

    let input: any = false;
    if ((type == "enum" || type == "combo") && info.values) {
        input = dialog.querySelector("select");
        input.addEventListener("change", function(e: Event) {
            dialog.modified();
            setValue((e.target as HTMLSelectElement).value);
        });
    } else if (type == "boolean" || type == "toggle") {
        input = dialog.querySelector("input");
        if (input) {
            input.addEventListener("click", function() {
                dialog.modified();
                setValue(!!input.checked);
            });
        }
    } else {
        input = dialog.querySelector("input");
        if (input) {
            input.addEventListener("blur", function(this: HTMLInputElement) {
                this.focus();
            });

            let currentValue =
                node.properties[property] !== undefined ? node.properties[property] : "";
            if (type !== "string") {
                currentValue = JSON.stringify(currentValue);
            }

            input.value = currentValue;
            input.addEventListener("keydown", function(e: KeyboardEvent) {
                if (e.keyCode == 27) {
                    dialog.close();
                } else if (e.keyCode == 13) {
                    commit();
                } else if (e.keyCode != 13) {
                    dialog.modified();
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
            });
        }
    }
    if (input) input.focus();

    const button = dialog.querySelector("button");
    button?.addEventListener("click", commit);

    function commit() {
        setValue(input.value);
    }

    function setValue(value: any) {
        if (
            info &&
            info.values &&
            info.values.constructor === Object &&
            info.values[value] != undefined
        ) {
            value = info.values[value];
        }

        if (typeof node.properties[property] == "number") {
            value = Number(value);
        }
        if (type == "array" || type == "object") {
            value = JSON.parse(value);
        }
        node.properties[property] = value;
        if (node.graph) {
            node.graph._version++;
        }
        if (node.onPropertyChanged) {
            node.onPropertyChanged(property, value);
        }
        if (options.onclose) {
            options.onclose();
        }
        dialog.close();
        node.setDirtyCanvas(true, true);
    }

    return dialog;
}
