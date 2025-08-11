import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import styles from "./BrainstormFragment.module.css";
import { useTranslation } from "react-i18next";
import { Button, Tooltip, Spinner, MessageBar } from "@fluentui/react-components";
import { ArrowDownload24Regular, ContentView24Regular, ScaleFill24Regular, ArrowExpand24Regular } from "@fluentui/react-icons";
import { IPureNode } from "markmap-common";
import { LightContext } from "../../../pages/layout/LightContext";
import { BaseFragment } from "../BaseFragment/BaseFragment";
import { BaseFragmentProps } from "../types";

// Constants
const DEBOUNCE_DELAY = 500; // Increased for better performance
const MARKMAP_FIT_PADDING = 20; // Increased for better spacing
const RESCALE_DELAY = 100; // Slightly increased for smoother transitions
const FREEPLANE_VERSION = "freeplane 1.11.1";
const DOWNLOAD_FILENAME = "Idee.mm";
const MIME_TYPE_FREEMIND = "application/x-freemind;charset=utf-8";
const NODE_ELEMENT = "node";
const MAP_ELEMENT = "map";
const TEXT_ATTRIBUTE = "TEXT";
const FOLDED_ATTRIBUTE = "FOLDED";
const VERSION_ATTRIBUTE = "version";
const MIN_CONTENT_LENGTH = 10;

interface Props extends BaseFragmentProps {
    markdown?: string;
    showLineNumbers?: boolean;
}

export const BrainstormFragment = ({ content, markdown, showLineNumbers = true }: Props) => {
    // Use markdown prop if provided, otherwise use content
    const markdownContent = markdown || content;
    const { t } = useTranslation();
    const transformer = useMemo(() => new Transformer(), []);
    const svgEl = useRef<SVGSVGElement>(null);
    const markmapInstance = useRef<Markmap | null>(null);
    const [isSourceView, setIsSourceView] = useState(false);
    const [freeplaneXML, setFreeplaneXML] = useState("");
    const [debouncedMarkdown, setDebouncedMarkdown] = useState(markdownContent);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const isLight = useContext(LightContext);

    // Debounce markdown changes - to prevent frequent updates
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedMarkdown(markdownContent);
        }, DEBOUNCE_DELAY);

        return () => clearTimeout(timer);
    }, [markdownContent]);

    // parse Nodes
    const parseNodes = useCallback((to_be_parsed: IPureNode, parent: Element, doc: Document): void => {
        const result = doc.createElement(NODE_ELEMENT);
        result.setAttribute(TEXT_ATTRIBUTE, to_be_parsed.content);

        for (const child of to_be_parsed.children || []) {
            parseNodes(child, result, doc);
        }
        parent.appendChild(result);
    }, []);

    // parse XML
    const parseXML = useCallback(
        (parsed: IPureNode) => {
            const doc = document.implementation.createDocument(null, null, null);
            const mapElem = doc.createElement(MAP_ELEMENT);
            mapElem.setAttribute(VERSION_ATTRIBUTE, FREEPLANE_VERSION);

            const question = doc.createElement(NODE_ELEMENT);
            question.setAttribute(TEXT_ATTRIBUTE, parsed.content);
            question.setAttribute(FOLDED_ATTRIBUTE, "false");

            for (const child of parsed.children || []) {
                parseNodes(child, question, doc);
            }
            mapElem.appendChild(question);
            doc.appendChild(mapElem);
            setFreeplaneXML(new XMLSerializer().serializeToString(mapElem));
        },
        [parseNodes]
    ); // Transform markdown data - memoized for performance
    const transformedData = useMemo(() => {
        if (!debouncedMarkdown || debouncedMarkdown.length < MIN_CONTENT_LENGTH) {
            setError(t("components.mindmap.errors.insufficientContent"));
            return null;
        }

        try {
            setError(null);
            return transformer.transform(debouncedMarkdown);
        } catch (err) {
            setError(t("components.mindmap.errors.transformationError"));
            console.error("Mindmap transformation error:", err);
            return null;
        }
    }, [transformer, debouncedMarkdown, t]);

    // create mindmap with improved error handling
    const createMM = useCallback(async () => {
        if (!svgEl.current || !transformedData) return;

        try {
            setIsLoading(true);
            setError(null);

            // Clear the existing SVG content
            svgEl.current.innerHTML = "";

            const mm = Markmap.create(svgEl.current as SVGSVGElement, {
                autoFit: true,
                pan: true,
                zoom: true,
                maxWidth: 300,
                initialExpandLevel: 4,
                spacingVertical: 10,
                spacingHorizontal: 80
            });

            if (mm) {
                markmapInstance.current = mm;
                const { root } = transformedData;
                parseXML(root);

                mm.setData(root);

                // Use requestAnimationFrame for smoother rendering
                requestAnimationFrame(() => {
                    mm.fit(MARKMAP_FIT_PADDING);
                });
            }
            svgEl.current?.setAttribute("title", t("components.mindmap.mindmap"));
        } catch (err) {
            setError(t("components.mindmap.errors.transformationError"));
            console.error("Mindmap creation error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [transformedData, parseXML, t]);

    useLayoutEffect(() => {
        createMM();
    }, [createMM]);

    // toggle source view
    const toggleSourceView = useCallback(() => {
        setIsSourceView(!isSourceView);
        setTimeout(() => {
            if (isSourceView) {
                createMM();
            }
        }, RESCALE_DELAY);
    }, [isSourceView, createMM]);

    // rescale mindmap with improved performance
    const rescale = useCallback(() => {
        if (!isSourceView && svgEl.current && transformedData && markmapInstance.current) {
            try {
                markmapInstance.current.fit(MARKMAP_FIT_PADDING);
            } catch (err) {
                console.error("Mindmap rescale error:", err);
                // Fallback to recreation if fit fails
                setTimeout(() => {
                    svgEl.current!.innerHTML = "";
                    createMM();
                }, RESCALE_DELAY);
            }
        }
    }, [isSourceView, createMM, transformedData]);

    // Toggle fullscreen mode
    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(!isFullscreen);
        // Rescale after fullscreen change
        setTimeout(() => {
            rescale();
        }, RESCALE_DELAY);
    }, [isFullscreen, rescale]);

    // download mindmap
    const download = useCallback(() => {
        if (svgEl && svgEl.current) {
            // Create Freeplane XML blob
            const svgBlob = new Blob([freeplaneXML], {
                type: MIME_TYPE_FREEMIND
            });

            // Create download link
            const url = URL.createObjectURL(svgBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = DOWNLOAD_FILENAME;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up URL
            URL.revokeObjectURL(url);
        }
    }, [freeplaneXML]);

    // Create fragment action buttons with enhanced functionality
    const fragmentActions = (
        <>
            <Tooltip content={isSourceView ? t("components.mindmap.mindmap") : t("components.mindmap.source")} relationship="description" positioning="above">
                <Button
                    appearance="subtle"
                    aria-label={isSourceView ? t("components.mindmap.source") : t("components.mindmap.mindmap")}
                    icon={<ContentView24Regular />}
                    onClick={() => toggleSourceView()}
                    size="large"
                    disabled={isLoading}
                />
            </Tooltip>

            {!isSourceView && (
                <Tooltip content={t("components.mindmap.reset")} relationship="description" positioning="above">
                    <Button
                        appearance="subtle"
                        aria-label={t("components.mindmap.reset")}
                        icon={<ScaleFill24Regular />}
                        onClick={() => rescale()}
                        size="large"
                        disabled={isLoading}
                    />
                </Tooltip>
            )}

            {!isSourceView && (
                <Tooltip
                    content={isFullscreen ? t("components.mindmap.exitFullscreen") : t("components.mindmap.fullscreen")}
                    relationship="description"
                    positioning="above"
                >
                    <Button
                        appearance="subtle"
                        aria-label={isFullscreen ? t("components.mindmap.exitFullscreen") : t("components.mindmap.fullscreen")}
                        icon={<ArrowExpand24Regular />}
                        onClick={() => toggleFullscreen()}
                        size="large"
                        disabled={isLoading}
                    />
                </Tooltip>
            )}

            {!isSourceView && (
                <Tooltip content={t("components.mindmap.download")} relationship="description" positioning="above">
                    <Button
                        appearance="subtle"
                        aria-label={t("components.mindmap.download")}
                        icon={<ArrowDownload24Regular />}
                        onClick={() => download()}
                        size="large"
                        disabled={isLoading || !freeplaneXML}
                    />
                </Tooltip>
            )}
        </>
    );

    // Fragment content based on view mode with loading and error states
    const fragmentContent = (
        <>
            {error && (
                <MessageBar intent="error" className={styles.errorMessage}>
                    {error}
                </MessageBar>
            )}

            {isLoading && (
                <div className={styles.loadingContainer}>
                    <Spinner label={t("components.mindmap.loading")} />
                </div>
            )}

            {!isSourceView ? (
                <div className={`${styles.svgContainer} ${isFullscreen ? styles.fullscreen : ""}`}>
                    <svg
                        id="markmap"
                        className={`${styles.svgMark} ${isLight ? "" : styles.darkmindmap}`}
                        ref={svgEl}
                        role="img"
                        aria-label={t("components.mindmap.mindmap")}
                        style={{ opacity: isLoading ? 0.5 : 1 }}
                    />
                    {isFullscreen && (
                        <Button
                            appearance="subtle"
                            className={styles.fullscreenExit}
                            onClick={toggleFullscreen}
                            aria-label={t("components.mindmap.exitFullscreen")}
                        >
                            ×
                        </Button>
                    )}
                </div>
            ) : (
                <div className={`${styles.answerText} ${showLineNumbers ? styles.withLineNumbers : ""}`}>
                    {showLineNumbers ? (
                        <pre>
                            {debouncedMarkdown.split("\n").map((line, index) => (
                                <div key={index} className={styles.sourceLine}>
                                    <span className={styles.lineNumber}>{index + 1}</span>
                                    <span className={styles.lineContent}>{line}</span>
                                </div>
                            ))}
                        </pre>
                    ) : (
                        debouncedMarkdown
                    )}
                </div>
            )}
        </>
    );

    return (
        <BaseFragment
            title="Brainstorming"
            content={debouncedMarkdown}
            actions={fragmentActions}
            className={isFullscreen ? styles.fullscreenFragment : undefined}
        >
            {fragmentContent}
        </BaseFragment>
    );
};
