import type { DialogLike, MenuPanelHost } from "./menu-panel-types";

export interface DialogFactoryContext {
    canvas: HTMLCanvasElement | null;
    host: MenuPanelHost;
}

export function createDialog(
    context: DialogFactoryContext,
    html: string,
    options?: any
): DialogLike {
    const host = context.host;
    const opts = Object.assign(
        {
            checkForInput: false,
            closeOnLeave: true,
            closeOnLeave_checkModified: true,
            closeOnClickOutside: true,
        },
        options || {}
    );
    const close_on_leave = !!(opts.closeOnLeave && host.dialog_close_on_mouse_leave);
    const dialog = document.createElement("div") as DialogLike;
    dialog.className = "graphdialog";
    dialog.innerHTML = html;
    dialog.is_modified = false;
    dialog.modified = () => {
        dialog.is_modified = true;
    };
    dialog.close = () => {
        if (dialog._remove_outside_close) {
            dialog._remove_outside_close();
            dialog._remove_outside_close = null;
        }
        dialog.parentNode?.removeChild(dialog);
    };

    const canvas = context.canvas;
    if (!canvas) {
        return dialog;
    }
    const rect = canvas.getBoundingClientRect();
    let x = -20;
    let y = -20;
    if (rect) {
        x -= rect.left;
        y -= rect.top;
    }
    if (opts.position) {
        x += opts.position[0];
        y += opts.position[1];
    } else if (opts.event) {
        x += opts.event.clientX;
        y += opts.event.clientY;
    } else {
        x += canvas.width * 0.5;
        y += canvas.height * 0.5;
    }
    dialog.style.left = x + "px";
    dialog.style.top = y + "px";
    canvas.parentNode?.appendChild(dialog);

    if (opts.checkForInput) {
        const inputs = dialog.querySelectorAll("input");
        let focused = false;
        if (inputs) {
            inputs.forEach((input) => {
                input.addEventListener("keydown", function(e: KeyboardEvent) {
                    dialog.modified();
                    if (e.keyCode == 27) {
                        dialog.close();
                    } else if (e.keyCode != 13) {
                        return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                });
                if (!focused) {
                    input.focus();
                    focused = true;
                }
            });
        }
    }

    let dialogCloseTimer: ReturnType<typeof setTimeout> | null = null;
    let prevent_timeout: any = false;
    host.pointerListenerAdd?.(dialog, "leave", () => {
        if (prevent_timeout) {
            return;
        }
        if (!close_on_leave) {
            return;
        }
        if (opts.closeOnLeave_checkModified && dialog.is_modified) {
            return;
        }
        dialogCloseTimer = setTimeout(dialog.close, host.dialog_close_on_mouse_leave_delay);
    });
    host.pointerListenerAdd?.(dialog, "enter", () => {
        if (dialogCloseTimer) {
            clearTimeout(dialogCloseTimer);
        }
    });
    const selects = dialog.querySelectorAll("select");
    if (selects) {
        selects.forEach((select) => {
            select.addEventListener("click", () => {
                prevent_timeout++;
            });
            select.addEventListener("blur", () => {
                prevent_timeout = 0;
            });
            select.addEventListener("change", () => {
                prevent_timeout = -1;
            });
        });
    }

    if (opts.closeOnClickOutside) {
        const root = canvas.ownerDocument || document;
        const onOutsideDown = (e: Event): void => {
            if (!dialog.parentNode) {
                return;
            }
            if (dialog.contains(e.target as Node)) {
                return;
            }
            dialog.close();
        };
        root.addEventListener("mousedown", onOutsideDown, true);
        root.addEventListener("touchstart", onOutsideDown, {
            capture: true,
            passive: true,
        });
        dialog._remove_outside_close = () => {
            root.removeEventListener("mousedown", onOutsideDown, true);
            root.removeEventListener("touchstart", onOutsideDown, true);
        };
    }
    dialog.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            dialog.close();
            e.preventDefault();
            e.stopPropagation();
        }
    });
    return dialog;
}
