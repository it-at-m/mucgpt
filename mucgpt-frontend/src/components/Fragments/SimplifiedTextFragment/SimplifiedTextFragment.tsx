import { useCallback, useMemo } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowDownload24Regular } from "@fluentui/react-icons";
import ReactMarkdown from "react-markdown";
import styles from "./SimplifiedTextFragment.module.css";
import { BaseFragment } from "../BaseFragment/BaseFragment";
import { BaseFragmentProps } from "../types";

// Constants
const SIMPLE_LANGUAGE_TAG_REGEX = /<einfachesprache>([\s\S]*?)<\/einfachesprache>/i;
const SECTION_REGEX = /<(SIMPLIFY_[A-Z_]+)\s+revision=([^>]+)>([\s\S]*?)<\/\1>/g;
const DOWNLOAD_FILENAME = "Vereinfachter_Text.txt";
const MIME_TYPE_TEXT = "text/plain;charset=utf-8";

type SimplifySection = {
    name: string;
    revision: string;
    body: string;
};

export const SimplifiedTextFragment = ({ content }: BaseFragmentProps) => {
    // Extract structured sections (Generate / Critique / Refine)
    const sections = useMemo(() => {
        const parsed: SimplifySection[] = [];
        let match: RegExpExecArray | null;
        const regex = new RegExp(SECTION_REGEX);
        while ((match = regex.exec(content)) !== null) {
            parsed.push({ name: match[1], revision: match[2], body: match[3].trim() });
        }

        // Sort by revision number, then by section type order
        const order: Record<string, number> = {
            SIMPLIFY_GENERATE: 0,
            SIMPLIFY_CRITIQUE: 1,
            SIMPLIFY_REFINE: 2
        };

        return parsed.sort((a, b) => {
            const numA = Number(a.revision);
            const numB = Number(b.revision);
            const revA = Number.isNaN(numA) ? 0 : numA;
            const revB = Number.isNaN(numB) ? 0 : numB;
            if (revA !== revB) return revA - revB;
            return (order[a.name] ?? 99) - (order[b.name] ?? 99);
        });
    }, [content]);

    // Extract simplified text from sections or legacy tags
    const simplifiedText = useMemo(() => {
        // Legacy simple language tags first
        const completeMatch = content.match(SIMPLE_LANGUAGE_TAG_REGEX);
        if (completeMatch) {
            return completeMatch[1].trim();
        }

        // Prefer the latest refine section, fallback to generate content
        if (sections.length) {
            const lastRefine = [...sections].reverse().find(s => s.name === "SIMPLIFY_REFINE");
            if (lastRefine) return lastRefine.body;

            const lastGenerate = [...sections].reverse().find(s => s.name === "SIMPLIFY_GENERATE");
            if (lastGenerate) return lastGenerate.body;
        }

        // Fallback to original content
        return content;
    }, [content, sections]);

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
            {sections.length > 0 && (
                <div className={styles.processingSection}>
                    <div className={styles.processingTitle}>Verarbeitungsdetails</div>
                    <div className={styles.processingContent}>
                        <div className={styles.sectionsContainer}>
                            {sections.map(section => {
                                const titleMap: Record<string, string> = {
                                    SIMPLIFY_GENERATE: "Generierung",
                                    SIMPLIFY_CRITIQUE: "Kritik",
                                    SIMPLIFY_REFINE: "Überarbeitung"
                                };
                                const label = titleMap[section.name] || section.name.replace("SIMPLIFY_", "");
                                return (
                                    <details
                                        key={`${section.name}-${section.revision}`}
                                        className={styles.sectionCard}
                                        open={section.name === "SIMPLIFY_GENERATE"}
                                    >
                                        <summary className={styles.sectionHeader}>
                                            <span className={styles.sectionTitle}>{label}</span>
                                            <span className={styles.sectionRevision}>Revision {section.revision}</span>
                                        </summary>
                                        <div className={styles.sectionBody}>
                                            <ReactMarkdown
                                                components={{
                                                    div: props => <div className={styles.processingMarkdown} {...props} />
                                                }}
                                            >
                                                {section.body}
                                            </ReactMarkdown>
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
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
