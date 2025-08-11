import { useCallback } from "react";
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
    // Extract simplified text from the content
    const extractSimplifiedText = useCallback((rawContent: string): string => {
        // First try to match complete tags (opening + closing)
        const completeMatch = rawContent.match(SIMPLE_LANGUAGE_TAG_REGEX);
        if (completeMatch) {
            return completeMatch[1].trim();
        }

        // If no complete match, check for opening tag and extract content until end or closing tag
        const openingTagIndex = rawContent.indexOf("<einfachesprache>");
        if (openingTagIndex !== -1) {
            const contentStart = openingTagIndex + "<einfachesprache>".length;
            const closingTagIndex = rawContent.indexOf("</einfachesprache>", contentStart);

            if (closingTagIndex !== -1) {
                // Closing tag found, extract content between tags
                return rawContent.substring(contentStart, closingTagIndex).trim();
            } else {
                // No closing tag yet, extract all content after opening tag
                return rawContent.substring(contentStart).trim();
            }
        }

        // No tags found, return original content
        return rawContent;
    }, []);

    // Extract processing info (revisions, status messages)
    const extractProcessingInfo = useCallback((rawContent: string): string => {
        const revisions = rawContent.match(REVISION_REGEX) || [];
        const statusMessages = rawContent.match(STATUS_REGEX) || [];
        return [...revisions, ...statusMessages].join("\n");
    }, []);

    const simplifiedText = extractSimplifiedText(content);
    const processingInfo = extractProcessingInfo(content);

    // Download simplified text as file
    const downloadText = useCallback(() => {
        const blob = new Blob([simplifiedText], {
            type: MIME_TYPE_TEXT
        });

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
            <Button
                appearance="subtle"
                aria-label="Text herunterladen"
                icon={<ArrowDownload24Regular className={styles.iconRightMargin} />}
                onClick={downloadText}
                size="large"
            />
        </Tooltip>
    );

    // Fragment content
    const fragmentContent = (
        <div className={styles.simplifiedTextContent}>
            <ReactMarkdown className={styles.markdownContent}>{simplifiedText}</ReactMarkdown>

            {processingInfo && (
                <div className={styles.processingInfo}>
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
