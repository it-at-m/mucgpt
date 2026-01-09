import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowDownload24Regular, Checkmark24Regular } from "@fluentui/react-icons";
import { ClassAttributes, HTMLAttributes, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExtraProps } from "react-markdown";
import styles from "./TableRenderer.module.css";

type TableRendererProps = ClassAttributes<HTMLTableElement> & HTMLAttributes<HTMLTableElement> & ExtraProps;

const FEEDBACK_TIMEOUT = 1000;

export default function TableRenderer(props: TableRendererProps) {
    const { t } = useTranslation();
    const { children, className, ...rest } = props;
    const tableRef = useRef<HTMLTableElement>(null);
    const downloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [downloadSuccess, setDownloadSuccess] = useState(false);

    const downloadAsCsv = useCallback(() => {
        if (!tableRef.current) return;

        const rows = tableRef.current.querySelectorAll<HTMLTableRowElement>("tr");
        const csvData: string[] = [];

        rows.forEach(row => {
            const cols = row.querySelectorAll<HTMLTableCellElement>("td, th");
            const rowData: string[] = [];

            cols.forEach(col => {
                // Get text content and escape quotes
                let data = col.innerText || col.textContent || "";
                data = data.trim(); // Clean up whitespace
                data = data.replace(/"/g, '""');

                // Wrap in quotes if it contains comma, quote or newline
                if (data.search(/("|,|\n)/g) >= 0) {
                    data = `"${data}"`;
                }
                rowData.push(data);
            });

            csvData.push(rowData.join(","));
        });

        const blob = new Blob([csvData.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "table_data.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Show success feedback
        setDownloadSuccess(true);
        if (downloadTimeoutRef.current) {
            clearTimeout(downloadTimeoutRef.current);
        }
        downloadTimeoutRef.current = setTimeout(() => {
            setDownloadSuccess(false);
            downloadTimeoutRef.current = null;
        }, FEEDBACK_TIMEOUT);
    }, []);

    useEffect(() => {
        return () => {
            if (downloadTimeoutRef.current) {
                clearTimeout(downloadTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.tableWrapper} tabIndex={0} role="region" aria-label={t("components.table_renderer.table_aria_label")}>
                <table {...rest} ref={tableRef} className={className}>
                    {children}
                </table>
            </div>
            <div className={styles.actions}>
                <Tooltip content={t("components.table_renderer.download_csv")} relationship="description">
                    <Button
                        appearance="subtle"
                        icon={downloadSuccess ? <Checkmark24Regular /> : <ArrowDownload24Regular />}
                        aria-label={t("components.table_renderer.download_csv")}
                        onClick={downloadAsCsv}
                    />
                </Tooltip>
            </div>
        </div>
    );
}
