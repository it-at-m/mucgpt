import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_PREVIEW_PERCENT = 40;
/** Minimum usable width for either pane, in pixels. Drag never pushes a pane below this. */
const MIN_PREVIEW_PX = 340;
const MIN_FORM_PX = 480;
/** Keyboard resize step in percent. */
const KEY_STEP_PERCENT = 3;
/** Absolute ceiling for the preview width, so the form pane can never collapse fully. */
const HARD_MAX_PERCENT = 80;

/**
 * Manages the width of the preview pane as a percentage of the split container,
 * plus a collapsed/expanded state. The preview pane sits on the right, so dragging
 * the divider left grows the preview. Both panes keep a pixel-based minimum width so
 * neither can be dragged into an unusable size.
 */
export const useResizablePreview = (containerRef: React.RefObject<HTMLElement | null>) => {
    const [previewPercent, setPreviewPercent] = useState<number>(DEFAULT_PREVIEW_PERCENT);
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
    const isDraggingRef = useRef(false);

    const clampPercent = useCallback(
        (percent: number) => {
            const container = containerRef.current;
            const width = container?.getBoundingClientRect().width ?? 0;
            if (width === 0) return percent;
            const minPreviewPercent = (MIN_PREVIEW_PX / width) * 100;
            const maxPreviewPercent = ((width - MIN_FORM_PX) / width) * 100;
            // On very narrow containers the pixel minimums can exceed the container,
            // which would otherwise produce a percentage > 100 (and a negative form
            // width via calc()). Cap the floor so the returned value stays sane even
            // if this hook ever runs below the stacking breakpoint.
            if (maxPreviewPercent <= minPreviewPercent) return Math.min(minPreviewPercent, HARD_MAX_PERCENT);
            return Math.min(maxPreviewPercent, Math.max(minPreviewPercent, percent));
        },
        [containerRef]
    );

    const applyClientX = useCallback(
        (clientX: number) => {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            if (rect.width === 0) return;
            const rawPercent = ((rect.right - clientX) / rect.width) * 100;
            setPreviewPercent(clampPercent(rawPercent));
        },
        [clampPercent, containerRef]
    );

    useEffect(() => {
        const onMove = (event: MouseEvent) => {
            if (!isDraggingRef.current) return;
            event.preventDefault();
            applyClientX(event.clientX);
        };
        const onUp = () => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            document.body.classList.remove("resizing-preview");
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [applyClientX]);

    const onDividerMouseDown = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        isDraggingRef.current = true;
        document.body.classList.add("resizing-preview");
    }, []);

    const onDividerKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                setPreviewPercent(prev => clampPercent(prev + KEY_STEP_PERCENT));
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setPreviewPercent(prev => clampPercent(prev - KEY_STEP_PERCENT));
            }
        },
        [clampPercent]
    );

    const collapsePreview = useCallback(() => setIsCollapsed(true), []);
    const expandPreview = useCallback(() => setIsCollapsed(false), []);

    return { previewPercent, isCollapsed, collapsePreview, expandPreview, onDividerMouseDown, onDividerKeyDown };
};
