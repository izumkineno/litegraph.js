import type { DialogLike, MenuPanelHost } from "./menu-panel-types";

export interface PromptDialogCanvasPort {
    canvas: HTMLCanvasElement | null;
    setDirty: (fgcanvas: boolean, bgcanvas: boolean) => void;
}

export interface PromptDialogContext {
    host: MenuPanelHost;
    canvas: HTMLCanvasElement | null;
    scale: number;
    graphcanvas: PromptDialogCanvasPort;
    getPromptBox: () => DialogLike | null;
    setPromptBox: (dialog: DialogLike | null) => void;
}

export function showPromptDialog(
    context: PromptDialogContext,
    title: string,
    value: any,
    callback: ((value: any) => void) | null,
    event?: MouseEvent,
    multiline?: boolean
): DialogLike {
    const host = context.host;
    const canvas = context.canvas;
    const rootDocument = canvas?.ownerDocument || document;
    const dialog = rootDocument.createElement("div") as DialogLike;
    dialog.is_modified = false;
    dialog.className = "graphdialog rounded";
    dialog.innerHTML = multiline
        ? "<span class='name'></span> <textarea autofocus class='value'></textarea><button class='rounded'>OK</button>"
        : "<span class='name'></span> <input autofocus type='text' class='value'/><button class='rounded'>OK</button>";
    dialog.modified = () => {
        dialog.is_modified = true;
    };
    dialog.close = () => {
        context.setPromptBox(null);
        dialog.parentNode?.removeChild(dialog);
    };

    canvas?.parentNode?.appendChild(dialog);
    if (context.scale > 1) {
        dialog.style.transform = "scale(" + context.scale + ")";
    }

    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    let prevent_timeout: any = false;
    host.pointerListenerAdd?.(dialog, "leave", () => {
        if (prevent_timeout) {
            return;
        }
        if (host.dialog_close_on_mouse_leave && !dialog.is_modified) {
            closeTimer = setTimeout(dialog.close, host.dialog_close_on_mouse_leave_delay);
        }
    });
    host.pointerListenerAdd?.(dialog, "enter", () => {
        if (closeTimer) {
            clearTimeout(closeTimer);
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

    const currentPrompt = context.getPromptBox();
    if (currentPrompt) {
        currentPrompt.close();
    }
    context.setPromptBox(dialog);

    const nameElement = dialog.querySelector(".name") as HTMLElement | null;
    const inputElement = dialog.querySelector(".value") as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
    if (nameElement) {
        nameElement.innerText = title || "";
    }
    if (inputElement) {
        inputElement.value = value;
        inputElement.addEventListener("keydown", (e: Event) => {
            const keyEvent = e as KeyboardEvent;
            dialog.is_modified = true;
            if (keyEvent.key === "Escape") {
                dialog.close();
            } else if (
                keyEvent.key === "Enter" &&
                (keyEvent.target as HTMLElement).localName != "textarea"
            ) {
                callback?.(inputElement.value);
                dialog.close();
            } else {
                return;
            }
            keyEvent.preventDefault();
            keyEvent.stopPropagation();
        });
    }
    dialog.querySelector("button")?.addEventListener("click", () => {
        callback?.(inputElement?.value);
        context.graphcanvas.setDirty(true, false);
        dialog.close();
    });

    if (canvas) {
        const rect = canvas.getBoundingClientRect();
        let x = -20;
        let y = -20;
        if (rect) {
            x -= rect.left;
            y -= rect.top;
        }
        if (event) {
            x += event.clientX;
            y += event.clientY;
        } else {
            x += canvas.width * 0.5;
            y += canvas.height * 0.5;
        }
        dialog.style.left = x + "px";
        dialog.style.top = y + "px";
    }
    setTimeout(() => inputElement?.focus(), 10);
    return dialog;
}
