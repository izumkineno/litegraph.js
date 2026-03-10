type SlotLike = {
    name?: unknown;
    type?: unknown;
    not_subgraph_input?: boolean;
    not_subgraph_output?: boolean;
};

type SubgraphNodeLike = {
    inputs?: SlotLike[];
    outputs?: SlotLike[];
    constructor?: {
        input_node_type?: string;
        output_node_type?: string;
    };
};

type GraphLike = {
    _subgraph_node?: SubgraphNodeLike | null;
    beforeChange?: () => void;
    afterChange?: () => void;
    add?: (node: any, skipComputeOrder?: boolean) => void;
};

interface SidebarDom {
    readonly root: HTMLDivElement;
    readonly title: HTMLSpanElement;
    readonly closeButton: HTMLButtonElement;
    readonly body: HTMLDivElement;
    readonly footer: HTMLDivElement;
    readonly addButton: HTMLButtonElement;
}

export interface SubgraphSidebarsPresenterContext {
    mount: HTMLElement | null;
    canvas: HTMLCanvasElement | null;
    getCurrentGraph: () => GraphLike | null | undefined;
    createNode: (type: string) => any;
    selectNodes: (nodes?: any[], addToCurrentSelection?: boolean) => void;
    convertEventToCanvasOffset: (event: MouseEvent) => [number, number];
    clampNodePosition?: (
        node: { pos: [number, number]; size: [number, number] },
        x?: number,
        y?: number
    ) => [number, number];
    closeSubgraph: () => void;
    showSubgraphPropertiesDialog: (node: any) => unknown;
    showSubgraphPropertiesDialogRight: (node: any) => unknown;
    sceneSyncController?: {
        repaintAllNodeHosts?: () => void;
    } | null;
}

export interface SubgraphSidebarsPresenterState {
    readonly root: HTMLDivElement;
    readonly left: SidebarDom;
    readonly right: SidebarDom;
    signature: string;
    graphRef: GraphLike | null;
    nodeRef: SubgraphNodeLike | null;
    refresh: () => void;
    destroy: () => void;
}

function toText(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value);
}

function getVisibleSlots(
    node: SubgraphNodeLike | null | undefined,
    side: "inputs" | "outputs"
): SlotLike[] {
    const source = side === "inputs" ? node?.inputs || [] : node?.outputs || [];
    const filtered: SlotLike[] = [];

    for (let i = 0; i < source.length; ++i) {
        const slot = source[i];
        if (!slot) {
            continue;
        }
        if (side === "inputs" && slot.not_subgraph_input) {
            continue;
        }
        if (side === "outputs" && slot.not_subgraph_output) {
            continue;
        }
        filtered.push(slot);
    }

    return filtered;
}

function createSignature(node: SubgraphNodeLike | null | undefined): string {
    const inputs = getVisibleSlots(node, "inputs")
        .map((slot) => `${toText(slot.name)}:${toText(slot.type)}`)
        .join("|");
    const outputs = getVisibleSlots(node, "outputs")
        .map((slot) => `${toText(slot.name)}:${toText(slot.type)}`)
        .join("|");
    return `${inputs}__${outputs}`;
}

function styleSidebarRoot(root: HTMLDivElement): void {
    root.style.position = "absolute";
    root.style.inset = "0";
    root.style.pointerEvents = "none";
    root.style.zIndex = "30";
}

function styleSidebarPanel(
    root: HTMLDivElement,
    side: "left" | "right"
): void {
    root.style.position = "absolute";
    root.style.top = "10px";
    root.style.bottom = "10px";
    root.style.width = "200px";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.pointerEvents = "auto";
    root.style.borderRadius = "8px";
    root.style.background = "rgba(17,17,17,0.88)";
    root.style.border = "1px solid rgba(255,255,255,0.06)";
    root.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
    root.style.backdropFilter = "blur(4px)";
    root.style.overflow = "hidden";
    if (side === "left") {
        root.style.left = "10px";
    } else {
        root.style.right = "10px";
    }
}

function createSidebarDom(
    documentRef: Document,
    side: "left" | "right"
): SidebarDom {
    const root = documentRef.createElement("div");
    root.className = `litegraph subgraph-sidebar subgraph-sidebar-${side}`;
    styleSidebarPanel(root, side);

    const header = documentRef.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.padding = "12px 10px 8px";
    header.style.gap = "8px";

    const title = documentRef.createElement("span");
    title.style.fontSize = "14px";
    title.style.color = "#888";
    title.style.fontFamily = "Arial, sans-serif";

    const closeButton = documentRef.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "X";
    closeButton.style.width = "20px";
    closeButton.style.height = "20px";
    closeButton.style.border = "0";
    closeButton.style.borderRadius = "4px";
    closeButton.style.background = "#151515";
    closeButton.style.color = "#AAA";
    closeButton.style.cursor = "pointer";
    closeButton.style.padding = "0";
    closeButton.style.lineHeight = "20px";
    closeButton.style.fontSize = "12px";

    header.append(title, closeButton);

    const body = documentRef.createElement("div");
    body.style.flex = "1";
    body.style.overflow = "auto";
    body.style.padding = "0 10px";

    const footer = documentRef.createElement("div");
    footer.style.padding = "8px 10px 10px";

    const addButton = documentRef.createElement("button");
    addButton.type = "button";
    addButton.textContent = "+";
    addButton.style.width = "100%";
    addButton.style.height = "28px";
    addButton.style.border = "0";
    addButton.style.borderRadius = "6px";
    addButton.style.background = "#151515";
    addButton.style.color = "#AAA";
    addButton.style.cursor = "pointer";
    addButton.style.fontSize = "18px";
    addButton.style.lineHeight = "28px";
    addButton.style.padding = "0";

    footer.appendChild(addButton);
    root.append(header, body, footer);

    return {
        root,
        title,
        closeButton,
        body,
        footer,
        addButton,
    };
}

function createSlotRow(
    documentRef: Document,
    slot: SlotLike,
    side: "inputs" | "outputs",
    onClick: (event: MouseEvent) => void
): HTMLButtonElement {
    const row = documentRef.createElement("button");
    row.type = "button";
    row.className = "subgraph_property";
    row.style.width = "100%";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "4px";
    row.style.padding = "6px 8px";
    row.style.margin = "0 0 6px";
    row.style.border = "0";
    row.style.borderRadius = "6px";
    row.style.background = "rgba(255,255,255,0.02)";
    row.style.color = "#AAA";
    row.style.cursor = "pointer";
    row.style.textAlign = "left";

    const bullet = documentRef.createElement("span");
    bullet.className = "bullet_icon";
    bullet.style.marginLeft = "0";
    bullet.style.backgroundColor = "#9C9";
    if (side === "outputs") {
        bullet.style.order = "3";
        bullet.style.marginLeft = "8px";
        bullet.style.marginRight = "0";
    }

    const name = documentRef.createElement("span");
    name.className = "name";
    name.textContent = toText(slot.name);
    name.style.flex = "1";
    name.style.minWidth = "0";
    name.style.overflow = "hidden";
    name.style.textOverflow = "ellipsis";
    name.style.whiteSpace = "nowrap";
    name.style.color = "#AAA";

    const type = documentRef.createElement("span");
    type.className = "type";
    type.textContent = toText(slot.type);
    type.style.color = "#777";
    type.style.marginLeft = side === "inputs" ? "8px" : "0";
    type.style.whiteSpace = "nowrap";

    if (side === "inputs") {
        row.append(bullet, name, type);
    } else {
        row.append(type, name, bullet);
    }

    row.addEventListener("click", onClick);
    return row;
}

function spawnSubgraphProxyNode(
    context: SubgraphSidebarsPresenterContext,
    subnode: SubgraphNodeLike,
    slot: SlotLike,
    side: "inputs" | "outputs",
    event: MouseEvent
): void {
    const graph = context.getCurrentGraph();
    if (!graph?.add) {
        return;
    }

    const type =
        side === "inputs"
            ? subnode.constructor?.input_node_type || "graph/input"
            : subnode.constructor?.output_node_type || "graph/output";
    const newNode = context.createNode(type);
    if (!newNode) {
        console.error(
            side === "inputs"
                ? "graph input node not found:"
                : "graph output node not found:",
            type
        );
        return;
    }

    graph.beforeChange?.();
    graph.add(newNode);

    if (typeof newNode.setProperty === "function") {
        newNode.setProperty("name", slot.name);
        newNode.setProperty("type", slot.type);
    } else {
        newNode.properties = newNode.properties || {};
        newNode.properties.name = slot.name;
        newNode.properties.type = slot.type;
    }

    const offset = context.convertEventToCanvasOffset(event);
    const nextPos = context.clampNodePosition
        ? context.clampNodePosition(newNode, offset[0] - 5, offset[1] - 5)
        : ([offset[0] - 5, offset[1] - 5] as [number, number]);
    newNode.pos[0] = nextPos[0];
    newNode.pos[1] = nextPos[1];
    graph.afterChange?.();
    context.selectNodes([newNode]);
    context.sceneSyncController?.repaintAllNodeHosts?.();
    context.canvas?.focus?.();
}

function renderSidebar(
    context: SubgraphSidebarsPresenterContext,
    dom: SidebarDom,
    subnode: SubgraphNodeLike,
    side: "inputs" | "outputs"
): void {
    dom.title.textContent = side === "inputs" ? "Graph Inputs" : "Graph Outputs";
    dom.body.innerHTML = "";

    const slots = getVisibleSlots(subnode, side);
    for (let i = 0; i < slots.length; ++i) {
        const slot = slots[i];
        const row = createSlotRow(
            dom.body.ownerDocument,
            slot,
            side,
            (event) => {
                spawnSubgraphProxyNode(context, subnode, slot, side, event);
            }
        );
        dom.body.appendChild(row);
    }
}

export function destroySubgraphSidebars(
    state: SubgraphSidebarsPresenterState | null | undefined
): null {
    state?.destroy();
    return null;
}

export function syncSubgraphSidebars(
    context: SubgraphSidebarsPresenterContext,
    currentState: SubgraphSidebarsPresenterState | null | undefined
): SubgraphSidebarsPresenterState | null {
    const mount = context.mount;
    const graph = context.getCurrentGraph() || null;
    const subnode = graph?._subgraph_node || null;

    if (!mount || !graph || !subnode) {
        return destroySubgraphSidebars(currentState);
    }

    if (!mount.style.position) {
        mount.style.position = "relative";
    }

    if (currentState) {
        if (!currentState.root.isConnected) {
            currentState = destroySubgraphSidebars(currentState);
        } else {
            currentState.refresh();
            if (currentState.root.isConnected) {
                return currentState;
            }
            currentState = null;
        }
    }

    const documentRef = mount.ownerDocument;
    const root = documentRef.createElement("div");
    root.className = "litegraph litegraph-subgraph-sidebars";
    styleSidebarRoot(root);

    const left = createSidebarDom(documentRef, "left");
    const right = createSidebarDom(documentRef, "right");
    root.append(left.root, right.root);
    mount.appendChild(root);

    let signature = "";
    let graphRef: GraphLike | null = null;
    let nodeRef: SubgraphNodeLike | null = null;
    const ownerWindow = documentRef.defaultView || window;

    const refresh = (): void => {
        const liveGraph = context.getCurrentGraph() || null;
        const liveNode = liveGraph?._subgraph_node || null;
        if (!liveGraph || !liveNode || !root.isConnected) {
            state.destroy();
            return;
        }

        if (root.parentElement !== context.mount && context.mount) {
            context.mount.appendChild(root);
        }

        const nextSignature = createSignature(liveNode);
        if (
            nextSignature === signature &&
            graphRef === liveGraph &&
            nodeRef === liveNode
        ) {
            return;
        }

        signature = nextSignature;
        graphRef = liveGraph;
        nodeRef = liveNode;
        renderSidebar(context, left, liveNode, "inputs");
        renderSidebar(context, right, liveNode, "outputs");
    };

    const state: SubgraphSidebarsPresenterState = {
        root,
        left,
        right,
        signature,
        graphRef,
        nodeRef,
        refresh,
        destroy: () => {
            if (pollHandle !== null) {
                ownerWindow.clearInterval(pollHandle);
            }
            root.remove();
        },
    };

    left.closeButton.addEventListener("click", () => {
        context.closeSubgraph();
    });
    right.closeButton.addEventListener("click", () => {
        context.closeSubgraph();
    });
    left.addButton.addEventListener("click", () => {
        context.showSubgraphPropertiesDialog(subnode);
    });
    right.addButton.addEventListener("click", () => {
        context.showSubgraphPropertiesDialogRight(subnode);
    });

    const pollHandle = ownerWindow.setInterval(refresh, 180);
    refresh();
    state.signature = signature;
    state.graphRef = graphRef;
    state.nodeRef = nodeRef;
    return state;
}
