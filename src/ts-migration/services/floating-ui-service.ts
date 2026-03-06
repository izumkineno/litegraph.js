interface FloatingOutsideCloseEntry {
    element: HTMLElement;
    onClose: (event: Event) => void;
    ignore?: (event: Event) => boolean;
    openedAt: number;
    minOpenMs: number;
    active?: () => boolean;
}

interface FloatingLeaveEntry {
    element: HTMLElement;
    onClose: () => void;
    delayMs: number;
    enabled?: () => boolean;
    timer: ReturnType<typeof setTimeout> | null;
}

interface FloatingDocumentManager {
    outsideEntries: Set<FloatingOutsideCloseEntry>;
    leaveEntries: Set<FloatingLeaveEntry>;
    overflowLockCount: number;
    originalBodyOverflow: string | null;
    cleanupListeners: () => void;
}

export interface FloatingServiceContext {
    ownerDocument?: Document | null;
    ownerWindow?: Window | null;
    mount?: HTMLElement | null;
    canvas?: HTMLCanvasElement | null;
    event?: Event | null;
    preferFullscreen?: boolean;
}

export interface FloatingPlacementOptions {
    left: number;
    top: number;
    scale?: number;
    margin?: number;
    clampToBounds?: boolean;
    boundsElement?: HTMLElement | null;
}

export interface FloatingOutsideCloseOptions {
    element: HTMLElement;
    onClose: (event: Event) => void;
    ignore?: (event: Event) => boolean;
    minOpenMs?: number;
    active?: () => boolean;
}

export interface FloatingLeaveOptions {
    element: HTMLElement;
    onClose: () => void;
    delayMs: number;
    enabled?: () => boolean;
}

export interface FloatingUiHandle {
    document: Document;
    window: Window;
    mountRoot: HTMLElement;
    mount: (element: HTMLElement) => void;
    place: (element: HTMLElement, options: FloatingPlacementOptions) => void;
    watchOutsideClose: (options: FloatingOutsideCloseOptions) => () => void;
    watchCloseOnLeave: (options: FloatingLeaveOptions) => () => void;
    lockBodyOverflow: () => () => void;
    registerCleanup: (cleanup: () => void) => () => void;
    destroy: (element?: HTMLElement | null) => void;
}

const documentManagers = new WeakMap<Document, FloatingDocumentManager>();

function resolveOwnerDocument(context: FloatingServiceContext): Document {
    const eventTarget = context.event?.target as
        | (Node & { ownerDocument?: Document | null })
        | null
        | undefined;
    return (
        context.ownerDocument ||
        context.mount?.ownerDocument ||
        context.canvas?.ownerDocument ||
        eventTarget?.ownerDocument ||
        context.ownerWindow?.document ||
        document
    );
}

function resolveOwnerWindow(documentRef: Document, context: FloatingServiceContext): Window {
    return documentRef.defaultView || context.ownerWindow || window;
}

function resolveMountRoot(
    documentRef: Document,
    context: FloatingServiceContext
): HTMLElement {
    if (context.mount) {
        return context.mount;
    }
    if (
        context.preferFullscreen &&
        documentRef.fullscreenElement &&
        documentRef.fullscreenElement instanceof HTMLElement
    ) {
        return documentRef.fullscreenElement;
    }
    return documentRef.body;
}

function createDocumentManager(documentRef: Document): FloatingDocumentManager {
    const outsideEntries = new Set<FloatingOutsideCloseEntry>();
    const leaveEntries = new Set<FloatingLeaveEntry>();

    const clearDisconnectedEntries = (): void => {
        for (const entry of [...outsideEntries]) {
            if (!entry.element.isConnected) {
                outsideEntries.delete(entry);
            }
        }
        for (const entry of [...leaveEntries]) {
            if (!entry.element.isConnected) {
                if (entry.timer) {
                    clearTimeout(entry.timer);
                }
                leaveEntries.delete(entry);
            }
        }
    };

    const handleOutsidePointer = (event: Event): void => {
        clearDisconnectedEntries();
        const target = event.target as Node | null;
        for (const entry of [...outsideEntries]) {
            if (entry.active && !entry.active()) {
                continue;
            }
            if (entry.minOpenMs > 0 && Date.now() - entry.openedAt < entry.minOpenMs) {
                continue;
            }
            if (entry.ignore?.(event)) {
                continue;
            }
            if (target && entry.element.contains(target)) {
                continue;
            }
            entry.onClose(event);
        }
    };

    const handlePointerOver = (event: Event): void => {
        clearDisconnectedEntries();
        const target = event.target as Node | null;
        if (!target) {
            return;
        }
        for (const entry of [...leaveEntries]) {
            if (entry.element.contains(target) && entry.timer) {
                clearTimeout(entry.timer);
                entry.timer = null;
            }
        }
    };

    const handlePointerOut = (event: Event): void => {
        clearDisconnectedEntries();
        const target = event.target as Node | null;
        const relatedTarget = (event as MouseEvent).relatedTarget as Node | null;
        if (!target) {
            return;
        }
        for (const entry of [...leaveEntries]) {
            if (!entry.element.contains(target)) {
                continue;
            }
            if (relatedTarget && entry.element.contains(relatedTarget)) {
                continue;
            }
            if (entry.enabled && !entry.enabled()) {
                continue;
            }
            if (entry.timer) {
                clearTimeout(entry.timer);
            }
            entry.timer = setTimeout(() => {
                entry.timer = null;
                if (!entry.enabled || entry.enabled()) {
                    entry.onClose();
                }
            }, entry.delayMs);
        }
    };

    documentRef.addEventListener("mousedown", handleOutsidePointer, true);
    documentRef.addEventListener("touchstart", handleOutsidePointer, {
        capture: true,
        passive: true,
    });
    documentRef.addEventListener("mouseover", handlePointerOver, true);
    documentRef.addEventListener("mouseout", handlePointerOut, true);

    return {
        outsideEntries,
        leaveEntries,
        overflowLockCount: 0,
        originalBodyOverflow: null,
        cleanupListeners: () => {
            documentRef.removeEventListener("mousedown", handleOutsidePointer, true);
            documentRef.removeEventListener("touchstart", handleOutsidePointer, true);
            documentRef.removeEventListener("mouseover", handlePointerOver, true);
            documentRef.removeEventListener("mouseout", handlePointerOut, true);
        },
    };
}

function getDocumentManager(documentRef: Document): FloatingDocumentManager {
    let manager = documentManagers.get(documentRef);
    if (!manager) {
        manager = createDocumentManager(documentRef);
        documentManagers.set(documentRef, manager);
    }
    return manager;
}

function maybeDisposeDocumentManager(documentRef: Document): void {
    const manager = documentManagers.get(documentRef);
    if (!manager) {
        return;
    }
    if (
        manager.outsideEntries.size === 0 &&
        manager.leaveEntries.size === 0 &&
        manager.overflowLockCount === 0
    ) {
        manager.cleanupListeners();
        documentManagers.delete(documentRef);
    }
}

export function createFloatingUiService(
    context: FloatingServiceContext = {}
): FloatingUiHandle {
    const documentRef = resolveOwnerDocument(context);
    const windowRef = resolveOwnerWindow(documentRef, context);
    const mountRoot = resolveMountRoot(documentRef, context);
    const manager = getDocumentManager(documentRef);
    const cleanups = new Set<() => void>();
    let destroyed = false;

    const registerCleanup = (cleanup: () => void): (() => void) => {
        cleanups.add(cleanup);
        return () => {
            cleanups.delete(cleanup);
        };
    };

    const mount = (element: HTMLElement): void => {
        if (element.parentNode !== mountRoot) {
            mountRoot.appendChild(element);
        }
    };

    const place = (element: HTMLElement, options: FloatingPlacementOptions): void => {
        const margin = options.margin ?? 10;
        if (typeof options.scale === "number" && options.scale > 0 && options.scale !== 1) {
            element.style.transform = "scale(" + options.scale + ")";
        }

        let left = options.left;
        let top = options.top;
        element.style.left = left + "px";
        element.style.top = top + "px";

        if (!options.clampToBounds) {
            return;
        }

        const boundsElement = options.boundsElement || mountRoot;
        const elementRect = element.getBoundingClientRect();
        const isDocumentRoot =
            boundsElement === documentRef.body ||
            boundsElement === documentRef.documentElement ||
            boundsElement === documentRef.fullscreenElement;
        const boundsWidth = isDocumentRoot
            ? Math.max(
                  documentRef.documentElement.clientWidth,
                  windowRef.innerWidth || 0
              )
            : boundsElement.clientWidth || boundsElement.getBoundingClientRect().width;
        const boundsHeight = isDocumentRoot
            ? Math.max(
                  documentRef.documentElement.clientHeight,
                  windowRef.innerHeight || 0
              )
            : boundsElement.clientHeight || boundsElement.getBoundingClientRect().height;

        if (boundsWidth) {
            left = Math.min(left, boundsWidth - elementRect.width - margin);
            left = Math.max(left, margin);
        }
        if (boundsHeight) {
            top = Math.min(top, boundsHeight - elementRect.height - margin);
            top = Math.max(top, margin);
        }

        element.style.left = left + "px";
        element.style.top = top + "px";
    };

    const watchOutsideClose = (options: FloatingOutsideCloseOptions): (() => void) => {
        const entry: FloatingOutsideCloseEntry = {
            element: options.element,
            onClose: options.onClose,
            ignore: options.ignore,
            openedAt: Date.now(),
            minOpenMs: options.minOpenMs ?? 0,
            active: options.active,
        };
        manager.outsideEntries.add(entry);
        const unregister = (): void => {
            manager.outsideEntries.delete(entry);
            maybeDisposeDocumentManager(documentRef);
        };
        registerCleanup(unregister);
        return unregister;
    };

    const watchCloseOnLeave = (options: FloatingLeaveOptions): (() => void) => {
        const entry: FloatingLeaveEntry = {
            element: options.element,
            onClose: options.onClose,
            delayMs: options.delayMs,
            enabled: options.enabled,
            timer: null,
        };
        manager.leaveEntries.add(entry);
        const unregister = (): void => {
            if (entry.timer) {
                clearTimeout(entry.timer);
                entry.timer = null;
            }
            manager.leaveEntries.delete(entry);
            maybeDisposeDocumentManager(documentRef);
        };
        registerCleanup(unregister);
        return unregister;
    };

    const lockBodyOverflow = (): (() => void) => {
        const body = documentRef.body;
        if (manager.overflowLockCount === 0) {
            manager.originalBodyOverflow = body.style.overflow;
            body.style.overflow = "hidden";
        }
        manager.overflowLockCount += 1;
        const unlock = (): void => {
            if (manager.overflowLockCount > 0) {
                manager.overflowLockCount -= 1;
            }
            if (manager.overflowLockCount === 0) {
                body.style.overflow = manager.originalBodyOverflow || "";
                manager.originalBodyOverflow = null;
                maybeDisposeDocumentManager(documentRef);
            }
        };
        registerCleanup(unlock);
        return unlock;
    };

    const destroy = (element?: HTMLElement | null): void => {
        if (destroyed) {
            return;
        }
        destroyed = true;
        const cleanupList = [...cleanups];
        cleanups.clear();
        for (const cleanup of cleanupList.reverse()) {
            cleanup();
        }
        if (element?.parentNode) {
            element.parentNode.removeChild(element);
        }
        maybeDisposeDocumentManager(documentRef);
    };

    return {
        document: documentRef,
        window: windowRef,
        mountRoot,
        mount,
        place,
        watchOutsideClose,
        watchCloseOnLeave,
        lockBodyOverflow,
        registerCleanup,
        destroy,
    };
}
