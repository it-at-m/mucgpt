import { useRef, type ChangeEvent } from "react";

/** Drives a hidden `<input type="file">`: spread `inputProps` onto it and call `openFilePicker` from a button. */
export const useFilePicker = (onFiles: (files: File[]) => void) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const onChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        // Resetting lets the user pick the same file again, e.g. after removing it.
        event.target.value = "";
        if (files.length > 0) onFiles(files);
    };

    return {
        openFilePicker: () => inputRef.current?.click(),
        inputProps: { ref: inputRef, type: "file", multiple: true, hidden: true, onChange }
    } as const;
};
