import { useEffect, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import { Button, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger } from "@fluentui/react-components";
import { ChevronDown20Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./CanvasContextMenu.module.css";

interface Props {
    editor: Editor | null;
    containerRef: RefObject<HTMLElement | null>;
    /** Serializes the current selection to markdown (controller.getSelectionMarkdown). */
    getSelectionMarkdown: () => string | null;
    /** Inserts the raw selection markdown into the chat input. */
    onInsertIntoChat?: (markdown: string) => void;
    /** Inserts a revision instruction plus the selection markdown into the chat input. */
    onAgentRevise?: (markdown: string) => void;
}

interface MenuPosition {
    top: number;
    left: number;
}

export const CanvasContextMenu = ({ editor, containerRef, getSelectionMarkdown, onInsertIntoChat, onAgentRevise }: Props) => {
    const { t } = useTranslation();
    const [position, setPosition] = useState<MenuPosition | null>(null);

    useEffect(() => {
        if (!editor) return;

        const update = () => {
            const containerRect = containerRef.current?.getBoundingClientRect();
            const { empty, from } = editor.state.selection;
            if (empty || !editor.isFocused || !containerRect) {
                setPosition(null);
                return;
            }
            const coords = editor.view.coordsAtPos(from);
            setPosition({
                top: Math.max(coords.top - containerRect.top - 44, 0),
                left: Math.max(Math.min(coords.left - containerRect.left, containerRect.width - 48), 0)
            });
        };

        editor.on("transaction", update);
        editor.on("focus", update);
        const onBlur = () => setPosition(null);
        editor.on("blur", onBlur);
        return () => {
            editor.off("transaction", update);
            editor.off("focus", update);
            editor.off("blur", onBlur);
        };
    }, [editor, containerRef]);

    useEffect(() => {
        if (!position) return;
        const onResize = () => setPosition(null);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [position]);

    if (!editor || !position) return null;

    return (
        // mousedown stays inside the editor so the selection (and this menu) survives the click.
        <div className={styles.wrapper} style={{ top: position.top, left: position.left }} onMouseDown={event => event.preventDefault()}>
            <Menu>
                <MenuTrigger disableButtonEnhancement>
                    <Button appearance="subtle" size="small" icon={<ChevronDown20Regular />} aria-label={t("canvas.context_menu.open")} />
                </MenuTrigger>
                <MenuPopover>
                    <MenuList>
                        <MenuItem onClick={() => onInsertIntoChat?.(getSelectionMarkdown() ?? "")} disabled={!onInsertIntoChat}>
                            {t("canvas.context_menu.insert_into_chat")}
                        </MenuItem>
                        <MenuItem onClick={() => onAgentRevise?.(getSelectionMarkdown() ?? "")} disabled={!onAgentRevise}>
                            {t("canvas.context_menu.agent_revise")}
                        </MenuItem>
                    </MenuList>
                </MenuPopover>
            </Menu>
        </div>
    );
};
