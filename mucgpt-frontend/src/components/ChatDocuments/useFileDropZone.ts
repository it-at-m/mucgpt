import { useCallback, useRef, useState, type DragEvent } from "react";

const hasFiles = (event: DragEvent<HTMLElement>) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

/**
 * Drop-zone handlers that accept dragged files; text and element drags pass through untouched.
 * File drags are always intercepted, even while disabled: otherwise the browser opens the dropped file and leaves the app.
 */
export const useFileDropZone = (onFiles: (files: File[]) => void, enabled: boolean) => {
    const [isDraggingFiles, setIsDraggingFiles] = useState(false);
    // dragenter/dragleave also fire for every child element, so the zone is left only once the count returns to zero.
    const dragDepthRef = useRef(0);

    const onDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDraggingFiles(true);
    }, []);

    const onDragOver = useCallback(
        (event: DragEvent<HTMLElement>) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = enabled ? "copy" : "none";
        },
        [enabled]
    );

    const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepthRef.current = Math.max(dragDepthRef.current - 1, 0);
        if (dragDepthRef.current === 0) setIsDraggingFiles(false);
    }, []);

    const onDrop = useCallback(
        (event: DragEvent<HTMLElement>) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            dragDepthRef.current = 0;
            setIsDraggingFiles(false);
            if (enabled) onFiles(Array.from(event.dataTransfer.files));
        },
        [enabled, onFiles]
    );

    return { isDragActive: enabled && isDraggingFiles, dropZoneProps: { onDragEnter, onDragOver, onDragLeave, onDrop } };
};
