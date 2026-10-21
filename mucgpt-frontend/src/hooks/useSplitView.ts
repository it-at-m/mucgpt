import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_CANVAS_PERCENT = 40;
/** Minimum usable width for either pane, in pixels. Resizing never pushes a pane below this. */
const MIN_CANVAS_PX = 340;
const MIN_CHAT_PX = 480;
/** Keyboard resize step in percent. */
const KEY_STEP_PERCENT = 3;
/** Absolute ceiling for the canvas width, so the chat pane can never collapse fully. */
const HARD_MAX_PERCENT = 80;

/**
 * Manages the width of the canvas pane as a percentage of the split container.
 * The canvas pane sits on the right, so dragging/arrow-left grows the canvas. Both panes
 * keep a pixel-based minimum width so neither can be resized into an unusable size.
 */
export const useSplitView = () => {
    const [canvasPercent, setCanvasPercent] = useState<number>(DEFAULT_CANVAS_PERCENT);
    const isDraggingRef = useRef(false);
    const containerRef = useRef<HTMLElement | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);

    const clampPercent = useCallback(
        (percent: number) => {
            const container = containerRef.current;
            const width = container?.getBoundingClientRect().width ?? 0;
            if (width === 0) return percent;
            const minCanvasPercent = (MIN_CANVAS_PX / width) * 100;
            const maxCanvasPercent = ((width - MIN_CHAT_PX) / width) * 100;
            // On very narrow containers the pixel minimums can exceed the container,
            // which would otherwise produce a percentage > 100 (and a negative chat
            // width via calc()). Cap the floor so the returned value stays sane even
            // if this hook ever runs below the stacking breakpoint.
            if (maxCanvasPercent <= minCanvasPercent) return Math.min(minCanvasPercent, HARD_MAX_PERCENT);
            return Math.min(maxCanvasPercent, Math.max(minCanvasPercent, percent));
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
            setCanvasPercent(clampPercent(rawPercent));
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

    // Callback ref: the split view swaps the container element when the canvas
    // opens/closes, so the observer must re-attach to whatever node is current.
    const attachContainer = useCallback(
        (node: HTMLElement | null) => {
            containerRef.current = node;
            observerRef.current?.disconnect();
            if (!node) return;
            const observer = new ResizeObserver(() => {
                setCanvasPercent(prev => {
                    const clamped = clampPercent(prev);
                    return clamped === prev ? prev : clamped;
                });
            });
            observer.observe(node);
            observerRef.current = observer;
        },
        [clampPercent]
    );

    useEffect(() => {
        return () => observerRef.current?.disconnect();
    }, []);

    const onDividerMouseDown = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        isDraggingRef.current = true;
        document.body.classList.add("resizing-preview");
    }, []);

    const onDividerKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                setCanvasPercent(prev => clampPercent(prev + KEY_STEP_PERCENT));
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setCanvasPercent(prev => clampPercent(prev - KEY_STEP_PERCENT));
            }
        },
        [clampPercent]
    );

    return { canvasPercent, attachContainer, onDividerMouseDown, onDividerKeyDown };
};
