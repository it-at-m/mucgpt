import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";

import { CanvasContextMenu } from "./CanvasContextMenu";
import styles from "./CanvasEditor.module.css";

interface Props {
    editor: Editor | null;
    isLocked: boolean;
    getSelectionMarkdown: () => string | null;
    onInsertIntoChat?: (markdown: string) => void;
    onAgentRevise?: (markdown: string) => void;
}

export const CanvasEditor = ({ editor, isLocked, getSelectionMarkdown, onInsertIntoChat, onAgentRevise }: Props) => {
    const editorContainerRef = useRef<HTMLDivElement>(null);

    // Hard lock: while the agent writes, the editor is read-only.
    useEffect(() => {
        editor?.setEditable(!isLocked);
    }, [editor, isLocked]);

    return (
        <div className={styles.editorScroll} data-locked={isLocked}>
            <div className={styles.editorContainer} ref={editorContainerRef}>
                {editor && <EditorContent editor={editor} className={styles.editor} />}
                <CanvasContextMenu
                    editor={editor}
                    containerRef={editorContainerRef}
                    getSelectionMarkdown={getSelectionMarkdown}
                    onInsertIntoChat={onInsertIntoChat}
                    onAgentRevise={onAgentRevise}
                />
            </div>
        </div>
    );
};
