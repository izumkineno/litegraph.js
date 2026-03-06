import type { PanelLike } from "./menu-panel-types";

export type SubgraphIoPanelSide = "inputs" | "outputs";

export interface SubgraphIoPanelContext {
    createPanel: (title: string, options?: any) => PanelLike;
    canvas: HTMLCanvasElement | null;
}

export function showSubgraphIoPanel(
    context: SubgraphIoPanelContext,
    node: any,
    side: SubgraphIoPanelSide
): PanelLike {
    const oldPanel = context.canvas?.parentNode?.querySelector(".subgraph_dialog") as any;
    oldPanel?.close?.();

    const isInputs = side === "inputs";
    const panel = context.createPanel(
        isInputs ? "Subgraph Inputs" : "Subgraph Outputs",
        { closable: true, width: 500 }
    );
    panel.node = node;
    panel.classList.add("subgraph_dialog");

    const refresh = (): void => {
        panel.clear();
        const slots = isInputs ? node.inputs : node.outputs;
        if (!slots) {
            return;
        }
        for (let i = 0; i < slots.length; ++i) {
            const slot = slots[i];
            if (
                (isInputs && slot.not_subgraph_input) ||
                (!isInputs && slot.not_subgraph_output)
            ) {
                continue;
            }
            const html =
                "<button>&#10005;</button> <span class='bullet_icon'></span><span class='name'></span><span class='type'></span>";
            const elem = panel.addHTML(html, "subgraph_property");
            (elem.dataset as any).name = slot.name;
            (elem.dataset as any).slot = String(i);
            (elem.querySelector(".name") as HTMLElement).innerText = slot.name;
            (elem.querySelector(".type") as HTMLElement).innerText = slot.type;
            elem.querySelector("button")?.addEventListener("click", function(this: HTMLButtonElement) {
                const index = Number((this.parentNode as any).dataset.slot);
                if (isInputs) {
                    node.removeInput?.(index);
                } else {
                    node.removeOutput?.(index);
                }
                refresh();
            });
        }
    };

    const html =
        " + <span class='label'>Name</span><input class='name'/><span class='label'>Type</span><input class='type'></input><button>+</button>";
    const addRow = panel.addHTML(html, "subgraph_property extra", true);
    const addSlot = function(this: HTMLElement): void {
        const parent = this.parentNode as HTMLElement;
        const name = (parent.querySelector(".name") as HTMLInputElement).value;
        const type = (parent.querySelector(".type") as HTMLInputElement).value;
        const findIndex = isInputs
            ? node.findInputSlot?.(name)
            : node.findOutputSlot?.(name);
        if (!name || findIndex != -1) {
            return;
        }
        if (isInputs) {
            node.addInput?.(name, type);
        } else {
            node.addOutput?.(name, type);
        }
        (parent.querySelector(".name") as HTMLInputElement).value = "";
        (parent.querySelector(".type") as HTMLInputElement).value = "";
        refresh();
    };

    if (!isInputs) {
        addRow
            .querySelector(".name")
            ?.addEventListener("keydown", function(this: HTMLElement, e: Event) {
                const keyEvent = e as KeyboardEvent;
                if (keyEvent.key === "Enter") {
                    addSlot.apply(this as unknown as HTMLElement);
                }
            });
    }
    addRow
        .querySelector("button")
        ?.addEventListener("click", function(this: HTMLElement) {
            addSlot.apply(this as unknown as HTMLElement);
        });

    refresh();
    return panel;
}
