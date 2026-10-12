import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/** Grows the textarea with its content. The maximum height is set via CSS, beyond that it scrolls. */
export const useAutoGrowTextarea = (value: string) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const fitToContent = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }

        // Collapsing to "auto" resets the scroll position of a textarea that exceeds its max height.
        const { scrollTop } = textarea;
        textarea.style.overflowY = "hidden";
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
        textarea.style.overflowY = "";
        textarea.scrollTop = scrollTop;
    }, []);

    useLayoutEffect(fitToContent, [value, fitToContent]);

    // Width changes (window resize, sidebar toggle) rewrap the text.
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }

        const observer = new ResizeObserver(fitToContent);
        observer.observe(textarea);
        return () => observer.disconnect();
    }, [fitToContent]);

    return textareaRef;
};
