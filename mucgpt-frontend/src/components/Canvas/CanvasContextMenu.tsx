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

        // The menu follows the selection and deliberately ignores focus: it stays
        // anchored while the user types in the chat input, and only a collapsed
        // selection (or a document replace, which resets the selection) hides it.
        const update = () => {
            const containerRect = containerRef.current?.getBoundingClientRect();
            const { empty, from } = editor.state.selection;
            if (empty || !containerRect) {
                setPosition(null);
                return;
            }
            const coords = editor.view.coordsAtPos(from);
            setPosition({
                top: Math.max(coords.top - containerRect.top - 30, 0),
                left: Math.max(Math.min(coords.left - containerRect.left, containerRect.width - 48), 0)
            });
        };

        editor.on("transaction", update);
        return () => {
            editor.off("transaction", update);
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
                    <Button appearance="secondary" size="small" icon={<ChevronDown20Regular />} aria-label={t("canvas.context_menu.open")} />
                </MenuTrigger>
                <MenuPopover>
                    <MenuList>
                        <MenuItem
                            onClick={() => {
                                const markdown = getSelectionMarkdown() ?? "";
                                // The passage was taken into the chat: drop the highlight so the
                                // agent is no longer anchored to it (and the menu follows suit).
                                editor.chain().setTextSelection(editor.state.selection.to).run();
                                onInsertIntoChat?.(markdown);
                            }}
                            disabled={!onInsertIntoChat}
                        >
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
