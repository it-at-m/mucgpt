import type { Editor } from "@tiptap/core";
import { useState } from "react";
import { Button, makeStyles, mergeClasses, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, tokens, Tooltip } from "@fluentui/react-components";
import {
    ArrowDownload24Regular,
    ArrowRedo24Regular,
    ArrowUndo24Regular,
    Dismiss24Regular,
    Grid24Regular,
    History24Regular,
    Save24Regular,
    TableDeleteColumn24Regular,
    TableDeleteRow24Regular,
    TableDismiss24Regular,
    TableStackAbove24Regular,
    TableStackBelow24Regular,
    TableStackLeft24Regular,
    TableStackRight24Regular,
    TextBold24Regular,
    TextBulletListLtr24Regular,
    TextItalic24Regular,
    TextNumberListLtr24Regular
} from "@fluentui/react-icons";
import { useEditorState } from "@tiptap/react";
import { useTranslation } from "react-i18next";

import { exportCanvasApi, type ExportTarget } from "../../api/core-client";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";
import { EdelweissSpinner } from "../EdelweissSpinner";
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

// Fluent's small Button ships minWidth: 64px plus wide padding. Griffel-styled
// overrides must go through mergeClasses (user className is merged last inside
// Button, so its atomic dedup replaces those rules); a plain CSS module class
// loses the cascade against griffel's runtime-injected rules.
const useHeadingStyles = makeStyles({
    headingButton: {
        minWidth: "0px",
        paddingLeft: tokens.spacingHorizontalXS,
        paddingRight: tokens.spacingHorizontalXS
    }
});

export const CanvasToolbar = ({ editor, controller, onOpenVersions, disabled }: Props) => {
    const { t } = useTranslation();
    const { showError, showSuccess } = useGlobalToastContext();
    const headingStyles = useHeadingStyles();
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
                orderedList: ctx.editor.isActive("orderedList"),
                inTable: ctx.editor.isActive("table"),
                // heading state must ride the selector: caret moves between
                // headings and paragraphs change none of the values above and
                // useEditorState's deep-equal would skip the rerender
                heading1: ctx.editor.isActive("heading", { level: 1 }),
                heading2: ctx.editor.isActive("heading", { level: 2 }),
                heading3: ctx.editor.isActive("heading", { level: 3 })
            }
    });

    const run = (build: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => () => {
        if (editor) build(editor.chain().focus()).run();
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

    // backend conversion via /v1/export; the converters consume the HTML serialization
    const downloadExport = async (target: ExportTarget) => {
        if (!editor) return;
        setIsExporting(target);
        try {
            const blob = await exportCanvasApi(controller.getMarkdown(), editor.getHTML(), target);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `canvas.${EXPORT_FILE_EXTENSIONS[target]}`;
            anchor.click();
            URL.revokeObjectURL(url);
            showSuccess(t("canvas.toolbar.export_started"));
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

            <div className={styles.divider} />

            {(["1", "2", "3"] as const).map(level => {
                const active = level === "1" ? state?.heading1 : level === "2" ? state?.heading2 : state?.heading3;
                return (
                    <Button
                        key={level}
                        appearance="subtle"
                        size="small"
                        disabled={disabled}
                        className={mergeClasses(headingStyles.headingButton, active && styles.active)}
                        onClick={run(chain => chain.toggleHeading({ level: Number(level) as 1 | 2 | 3 }))}
                        aria-label={t(`canvas.toolbar.heading_${level}`)}
                        aria-pressed={active}
                    >
                        H{level}
                    </Button>
                );
            })}

            <div className={styles.divider} />

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

            {state?.inTable && (
                <>
                    <div className={styles.divider} />
                    <Tooltip content={t("canvas.toolbar.table_add_row_above")} relationship="label" positioning={tooltipPositioning}>
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<TableStackAbove24Regular />}
                            disabled={disabled}
                            onClick={run(chain => chain.addRowBefore())}
                            aria-label={t("canvas.toolbar.table_add_row_above")}
                        />
                    </Tooltip>
                    <Tooltip content={t("canvas.toolbar.table_add_row_below")} relationship="label" positioning={tooltipPositioning}>
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<TableStackBelow24Regular />}
                            disabled={disabled}
                            onClick={run(chain => chain.addRowAfter())}
                            aria-label={t("canvas.toolbar.table_add_row_below")}
                        />
                    </Tooltip>
                    <Tooltip content={t("canvas.toolbar.table_add_column_before")} relationship="label" positioning={tooltipPositioning}>
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<TableStackLeft24Regular />}
                            disabled={disabled}
                            onClick={run(chain => chain.addColumnBefore())}
                            aria-label={t("canvas.toolbar.table_add_column_before")}
                        />
                    </Tooltip>
                    <Tooltip content={t("canvas.toolbar.table_add_column_after")} relationship="label" positioning={tooltipPositioning}>
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<TableStackRight24Regular />}
                            disabled={disabled}
                            onClick={run(chain => chain.addColumnAfter())}
                            aria-label={t("canvas.toolbar.table_add_column_after")}
                        />
                    </Tooltip>
                    <Tooltip content={t("canvas.toolbar.table_delete_row")} relationship="label" positioning={tooltipPositioning}>
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<TableDeleteRow24Regular />}
                            disabled={disabled}
                            onClick={run(chain => chain.deleteRow())}
                            aria-label={t("canvas.toolbar.table_delete_row")}
                        />
                    </Tooltip>
                    <Tooltip content={t("canvas.toolbar.table_delete_column")} relationship="label" positioning={tooltipPositioning}>
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<TableDeleteColumn24Regular />}
                            disabled={disabled}
                            onClick={run(chain => chain.deleteColumn())}
                            aria-label={t("canvas.toolbar.table_delete_column")}
                        />
                    </Tooltip>
                    <Tooltip content={t("canvas.toolbar.table_delete_table")} relationship="label" positioning={tooltipPositioning}>
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<TableDismiss24Regular />}
                            disabled={disabled}
                            onClick={run(chain => chain.deleteTable())}
                            aria-label={t("canvas.toolbar.table_delete_table")}
                        />
                    </Tooltip>
                </>
            )}

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
                    <Button
                        appearance="subtle"
                        size="small"
                        icon={isExporting !== null ? <EdelweissSpinner size="tiny" /> : <ArrowDownload24Regular />}
                        aria-label={t("canvas.toolbar.export")}
                    >
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
