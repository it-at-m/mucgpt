const SCROLLABLE_OVERFLOW = new Set(["auto", "scroll", "overlay"]);

/** Returns the nearest ancestor the user can scroll vertically. */
export const findScrollContainer = (element: HTMLElement): HTMLElement | null => {
    let parent = element.parentElement;
    while (parent) {
        if (SCROLLABLE_OVERFLOW.has(getComputedStyle(parent).overflowY)) {
            return parent;
        }
        parent = parent.parentElement;
    }
    return null;
};

/**
 * Scrolls `element` into view inside its nearest user-scrollable ancestor only.
 *
 * Element.scrollIntoView also scrolls every outer scroll container (including
 * `overflow: hidden` wrappers and the document) whenever the inner one cannot
 * reach the requested position, which lifts the whole app layout.
 * Like the native API, the element's scroll-margin is respected.
 */
export const scrollIntoNearestContainer = (
    element: HTMLElement | null | undefined,
    { block = "end", behavior = "smooth" }: { block?: "start" | "end"; behavior?: ScrollBehavior } = {}
) => {
    if (!element) return;
    const container = findScrollContainer(element);
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const { scrollMarginTop, scrollMarginBottom } = getComputedStyle(element);
    const offset =
        block === "start"
            ? elementRect.top - containerRect.top - (parseFloat(scrollMarginTop) || 0)
            : elementRect.bottom - containerRect.bottom + (parseFloat(scrollMarginBottom) || 0);

    container.scrollTo({ top: container.scrollTop + offset, behavior });
};
