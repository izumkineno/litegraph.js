export type ContextMenuFirstEventPort =
    | MouseEvent
    | CustomEvent
    | PointerEvent
    | null
    | undefined;

export interface ContextMenuPort {
    getFirstEvent(): ContextMenuFirstEventPort;
}
