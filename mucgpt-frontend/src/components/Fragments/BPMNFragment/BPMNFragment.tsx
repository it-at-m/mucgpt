import { useCallback, useMemo } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowDownload24Regular } from "@fluentui/react-icons";
import ReactMarkdown from "react-markdown";
import styles from "./BPMNFragment.module.css";
import { BaseFragment } from "../BaseFragment/BaseFragment";
import { BaseFragmentProps } from "../types";

// Constants
const BPMN_BLOCK_REGEX = /<bpmn>([\s\S]*?)<\/bpmn>/i;
const DOWNLOAD_FILENAME = "BPMN_Diagramm.bpmn";
const MIME_TYPE_BPMN = "application/xml;charset=utf-8";

export const BPMNFragment = ({ content }: BaseFragmentProps) => {
    const { logContent, xmlContent } = useMemo(() => {
        const safeContent = content ?? "";
        const match = safeContent.match(BPMN_BLOCK_REGEX);

        if (!match) {
            return {
                logContent: safeContent.trim(),
                xmlContent: ""
            };
        }

        const xml = match[1].trim();
        const beforeXml = safeContent.slice(0, match.index ?? 0);
        const afterXml = safeContent.slice((match.index ?? 0) + match[0].length);
        const mergedLog = `${beforeXml}${afterXml}`.trim();

        return {
            logContent: mergedLog,
            xmlContent: xml
        };
    }, [content]);

    const hasXml = xmlContent.length > 0;

    const downloadBpmn = useCallback(() => {
        if (!hasXml) {
            return;
        }

        const blob = new Blob([xmlContent], { type: MIME_TYPE_BPMN });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = DOWNLOAD_FILENAME;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [hasXml, xmlContent]);

    const fragmentActions = (
        <Tooltip content={hasXml ? "BPMN-XML herunterladen" : "BPMN-XML noch nicht verfügbar"} relationship="description" positioning="above">
            <Button
                appearance="subtle"
                aria-label="BPMN-XML herunterladen"
                icon={<ArrowDownload24Regular />}
                onClick={downloadBpmn}
                size="large"
                disabled={!hasXml}
            />
        </Tooltip>
    );

    return (
        <BaseFragment title="BPMN Creator" content={content} actions={fragmentActions}>
            <div className={styles.bpmnContent}>
                <section className={styles.streamSection}>
                    <div className={styles.streamTitle}>Verarbeitungsprotokoll</div>
                    {logContent ? (
                        <div className={styles.streamMarkdown}>
                            <ReactMarkdown>{logContent}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className={styles.placeholder}>Noch keine Statusmeldungen vorhanden.</div>
                    )}
                </section>

                <section className={styles.xmlSection}>
                    <div className={styles.xmlTitle}>Generiertes BPMN</div>
                    {hasXml ? <pre className={styles.xmlCode}>{xmlContent}</pre> : <div className={styles.placeholder}>BPMN-XML wird noch erstellt...</div>}
                </section>
            </div>
        </BaseFragment>
    );
};
