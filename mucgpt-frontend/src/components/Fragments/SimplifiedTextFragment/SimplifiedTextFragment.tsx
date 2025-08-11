import { useCallback, useMemo } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowDownload24Regular } from "@fluentui/react-icons";
import ReactMarkdown from "react-markdown";
import styles from "./SimplifiedTextFragment.module.css";
import { BaseFragment } from "../BaseFragment/BaseFragment";
import { BaseFragmentProps } from "../types";

// Constants
const SIMPLE_LANGUAGE_TAG_REGEX = /<einfachesprache>([\s\S]*?)<\/einfachesprache>/i;
const REVISION_REGEX = /\*\*Überarbeitung #\d+:.*?\*\*/g;
const STATUS_REGEX = /(✓|⚠️|ℹ️|✅|❌).*$/gm;
const DOWNLOAD_FILENAME = "Vereinfachter_Text.txt";
const MIME_TYPE_TEXT = "text/plain;charset=utf-8";

export const SimplifiedTextFragment = ({ content }: BaseFragmentProps) => {
    // Extract simplified text from the content - memoized for performance
    const simplifiedText = useMemo(() => {
        // First try to match complete tags (opening + closing)
        const completeMatch = content.match(SIMPLE_LANGUAGE_TAG_REGEX);
        if (completeMatch) {
            return completeMatch[1].trim();
        }

        // If no complete match, check for opening tag and extract content until end or closing tag
        const openingTagIndex = content.indexOf("<einfachesprache>");
        if (openingTagIndex !== -1) {
            const contentStart = openingTagIndex + "<einfachesprache>".length;
            const closingTagIndex = content.indexOf("</einfachesprache>", contentStart);

            if (closingTagIndex !== -1) {
                // Closing tag found, extract content between tags
                return content.substring(contentStart, closingTagIndex).trim();
            } else {
                // No closing tag yet, extract all content after opening tag
                return content.substring(contentStart).trim();
            }
        }

        // No tags found, return original content
        return content;
    }, [content]);

    // Extract processing info (revisions, status messages) - memoized for performance
    const processingInfo = useMemo(() => {
        const revisions = content.match(REVISION_REGEX) || [];
        const statusMessages = content.match(STATUS_REGEX) || [];
        const combined = [...revisions, ...statusMessages].join("\n");
        return combined || null;
    }, [content]);

    // Download simplified text as file
    const downloadText = useCallback(() => {
        const blob = new Blob([simplifiedText], { type: MIME_TYPE_TEXT });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = DOWNLOAD_FILENAME;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [simplifiedText]);

    // Create download button
    const downloadAction = (
        <Tooltip content="Text herunterladen" relationship="description" positioning="above">
            <Button appearance="subtle" aria-label="Text herunterladen" icon={<ArrowDownload24Regular />} onClick={downloadText} size="large" />
        </Tooltip>
    );

    // Fragment content
    const fragmentContent = (
        <div className={styles.simplifiedTextContent}>
            <ReactMarkdown className={styles.markdownContent}>{simplifiedText}</ReactMarkdown>

            {processingInfo && (
                <div className={styles.processingSection}>
                    <div className={styles.processingTitle}>Verarbeitungsdetails</div>
                    <div className={styles.processingContent}>
                        <ReactMarkdown className={styles.processingMarkdown}>{processingInfo}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <BaseFragment title="Leichte Sprache" content={simplifiedText} actions={downloadAction}>
            {fragmentContent}
        </BaseFragment>
    );
};
