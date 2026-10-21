import type { Editor } from "@tiptap/core";
import { useState } from "react";
import { Button, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, Tooltip } from "@fluentui/react-components";
import {
    ArrowDownload24Regular,
    ArrowRedo24Regular,
    ArrowUndo24Regular,
    Dismiss24Regular,
    Grid24Regular,
    History24Regular,
    Save24Regular,
    TextBold24Regular,
    TextBulletListLtr24Regular,
    TextItalic24Regular,
    TextNumberListLtr24Regular
} from "@fluentui/react-icons";
import { useEditorState } from "@tiptap/react";
import { useTranslation } from "react-i18next";

import { exportCanvasApi, type ExportTarget } from "../../api/core-client";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";
import type { CanvasController } from "../../hooks/useCanvasController";
import styles from "./CanvasToolbar.module.css";

interface Props {
    editor: Editor | null;
    controller: CanvasController;
    onOpenVersions: () => void;
    disabled: boolean;
}

const tooltipPositioning = "above";

const EXPORT_FILE_EXTENSIONS: Record<ExportTarget, string> = {
    pdf: "pdf",
    docx: "docx",
    xlsx: "xlsx"
};

export const CanvasToolbar = ({ editor, controller, onOpenVersions, disabled }: Props) => {
    const { t } = useTranslation();
    const { showError } = useGlobalToastContext();
    const [isExporting, setIsExporting] = useState<ExportTarget | null>(null);

    const state = useEditorState({
        editor,
        selector: ctx =>
            ctx.editor && {
                canUndo: ctx.editor.can().undo(),
                canRedo: ctx.editor.can().redo(),
                bold: ctx.editor.isActive("bold"),
                italic: ctx.editor.isActive("italic"),
                bulletList: ctx.editor.isActive("bulletList"),
                orderedList: ctx.editor.isActive("orderedList")
            }
    });

    const run = (command: (chain: ReturnType<Editor["chain"]>) => void) => () => {
        if (editor) command(editor.chain().focus());
    };

    const downloadMarkdown = () => {
        const blob = new Blob([controller.getMarkdown()], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "canvas.md";
        anchor.click();
        URL.revokeObjectURL(url);
    };

    // backend conversion via /v1/export; all three serializations are sent so
    // each converter picks the lowest-loss input (pdf←html, docx←markdown, xlsx←html).
    const downloadExport = async (target: ExportTarget) => {
        if (!editor) return;
        setIsExporting(target);
        try {
            const blob = await exportCanvasApi(controller.getMarkdown(), editor.getHTML(), JSON.stringify(editor.getJSON()), target);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `canvas.${EXPORT_FILE_EXTENSIONS[target]}`;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error(`Canvas export to ${target} failed:`, error);
            showError(t("canvas.toolbar.export_failed"), t("canvas.toolbar.export_failed_message", { target: target.toUpperCase() }));
        } finally {
            setIsExporting(null);
        }
    };

    const canUndo = !disabled && (state?.canUndo ?? false);
    const canRedo = !disabled && (state?.canRedo ?? false);

    return (
        <div className={styles.toolbar} role="toolbar" aria-label={t("canvas.toolbar.label")}>
            <Tooltip content={t("canvas.toolbar.undo")} relationship="label" positioning={tooltipPositioning}>
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowUndo24Regular />}
                    disabled={!canUndo}
                    onClick={run(chain => chain.undo())}
                    aria-label={t("canvas.toolbar.undo")}
                />
            </Tooltip>
            <Tooltip content={t("canvas.toolbar.redo")} relationship="label" positioning={tooltipPositioning}>
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowRedo24Regular />}
                    disabled={!canRedo}
                    onClick={run(chain => chain.redo())}
                    aria-label={t("canvas.toolbar.redo")}
                />
            </Tooltip>

            <div className={styles.divider} />

            <Tooltip content={t("canvas.toolbar.bold")} relationship="label" positioning={tooltipPositioning}>
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<TextBold24Regular />}
                    disabled={disabled}
                    className={state?.bold ? styles.active : undefined}
                    onClick={run(chain => chain.toggleBold())}
                    aria-label={t("canvas.toolbar.bold")}
                    aria-pressed={state?.bold}
                />
            </Tooltip>
            <Tooltip content={t("canvas.toolbar.italic")} relationship="label" positioning={tooltipPositioning}>
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<TextItalic24Regular />}
                    disabled={disabled}
                    className={state?.italic ? styles.active : undefined}
                    onClick={run(chain => chain.toggleItalic())}
                    aria-label={t("canvas.toolbar.italic")}
                    aria-pressed={state?.italic}
                />
            </Tooltip>

            {(["1", "2", "3"] as const).map(level => (
                <Button
                    key={level}
                    appearance="subtle"
                    size="small"
                    disabled={disabled}
                    className={editor?.isActive("heading", { level: Number(level) }) ? styles.active : undefined}
                    onClick={run(chain => chain.toggleHeading({ level: Number(level) as 1 | 2 | 3 }))}
                    aria-label={t(`canvas.toolbar.heading_${level}`)}
                    aria-pressed={editor?.isActive("heading", { level: Number(level) })}
                >
                    H{level}
                </Button>
            ))}

            <Tooltip content={t("canvas.toolbar.bullet_list")} relationship="label" positioning={tooltipPositioning}>
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<TextBulletListLtr24Regular />}
                    disabled={disabled}
                    className={state?.bulletList ? styles.active : undefined}
                    onClick={run(chain => chain.toggleBulletList())}
                    aria-label={t("canvas.toolbar.bullet_list")}
                    aria-pressed={state?.bulletList}
                />
            </Tooltip>
            <Tooltip content={t("canvas.toolbar.ordered_list")} relationship="label" positioning={tooltipPositioning}>
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<TextNumberListLtr24Regular />}
                    disabled={disabled}
                    className={state?.orderedList ? styles.active : undefined}
                    onClick={run(chain => chain.toggleOrderedList())}
                    aria-label={t("canvas.toolbar.ordered_list")}
                    aria-pressed={state?.orderedList}
                />
            </Tooltip>
            <Tooltip content={t("canvas.toolbar.insert_table")} relationship="label" positioning={tooltipPositioning}>
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<Grid24Regular />}
                    disabled={disabled}
                    onClick={run(chain => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
                    aria-label={t("canvas.toolbar.insert_table")}
                />
            </Tooltip>

            <div className={styles.divider} />

            <Tooltip content={t("canvas.toolbar.save_version")} relationship="label" positioning={tooltipPositioning}>
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<Save24Regular />}
                    disabled={disabled}
                    onClick={() => controller.snapshot("manual")}
                    aria-label={t("canvas.toolbar.save_version")}
                />
            </Tooltip>
            <Button appearance="subtle" size="small" icon={<History24Regular />} onClick={onOpenVersions} aria-label={t("canvas.versions.title")}>
                {t("canvas.versions.title")}
            </Button>

            <Menu>
                <MenuTrigger disableButtonEnhancement>
                    <Button appearance="subtle" size="small" icon={<ArrowDownload24Regular />} aria-label={t("canvas.toolbar.export")}>
                        {t("canvas.toolbar.export")}
                    </Button>
                </MenuTrigger>
                <MenuPopover>
                    <MenuList>
                        <MenuItem icon={<ArrowDownload24Regular />} onClick={downloadMarkdown}>
                            {t("canvas.toolbar.export_md")}
                        </MenuItem>
                        <MenuItem icon={<ArrowDownload24Regular />} disabled={isExporting !== null} onClick={() => void downloadExport("pdf")}>
                            {t("canvas.toolbar.export_pdf")}
                        </MenuItem>
                        <MenuItem icon={<ArrowDownload24Regular />} disabled={isExporting !== null} onClick={() => void downloadExport("docx")}>
                            {t("canvas.toolbar.export_word")}
                        </MenuItem>
                        <MenuItem icon={<ArrowDownload24Regular />} disabled={isExporting !== null} onClick={() => void downloadExport("xlsx")}>
                            {t("canvas.toolbar.export_excel")}
                        </MenuItem>
                    </MenuList>
                </MenuPopover>
            </Menu>

            <div className={styles.spacer} />

            <Tooltip content={t("canvas.toolbar.close")} relationship="label" positioning={tooltipPositioning}>
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<Dismiss24Regular />}
                    onClick={() => controller.setIsOpen(false)}
                    aria-label={t("canvas.toolbar.close")}
                />
            </Tooltip>
        </div>
    );
};
