import type { DialogLike, MenuPanelHost } from "./menu-panel-types";
import { createFloatingUiService } from "./floating-ui-service";

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
    const canvas = context.canvas;
    const floating = createFloatingUiService({
        ownerDocument: canvas?.ownerDocument || null,
        mount: (canvas?.parentNode as HTMLElement | null) || null,
        canvas,
    });
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
        if (dialog._floating_cleanup) {
            const cleanup = dialog._floating_cleanup;
            dialog._floating_cleanup = null;
            cleanup();
        }
    };

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
    floating.mount(dialog);
    floating.place(dialog, { left: x, top: y });
    dialog._floating_cleanup = () => {
        floating.destroy(dialog);
    };

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

    let prevent_timeout: any = false;
    floating.watchCloseOnLeave({
        element: dialog,
        onClose: dialog.close,
        delayMs: host.dialog_close_on_mouse_leave_delay || 500,
        enabled: () => {
            if (prevent_timeout) {
                return false;
            }
            if (!close_on_leave) {
                return false;
            }
            if (opts.closeOnLeave_checkModified && dialog.is_modified) {
                return false;
            }
            return true;
        },
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
        floating.watchOutsideClose({
            element: dialog,
            onClose: dialog.close,
        });
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
