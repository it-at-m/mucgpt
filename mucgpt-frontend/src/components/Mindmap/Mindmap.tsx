import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import styles from "./Mindmap.module.css";
import { Stack } from "@fluentui/react";
import { useTranslation } from "react-i18next";
import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowDownload24Regular, ContentView24Regular, ScaleFill24Regular } from "@fluentui/react-icons";
import { IPureNode } from "markmap-common";
import { LightContext } from "../../pages/layout/LightContext";

// Constants
const DEBOUNCE_DELAY = 300;
const MARKMAP_FIT_PADDING = 10;
const RESCALE_DELAY = 50;
const FREEPLANE_VERSION = "freeplane 1.11.1";
const DOWNLOAD_FILENAME = "Idee.mm";
const MIME_TYPE_FREEMIND = "application/x-freemind;charset=utf-8";
const NODE_ELEMENT = "node";
const MAP_ELEMENT = "map";
const TEXT_ATTRIBUTE = "TEXT";
const FOLDED_ATTRIBUTE = "FOLDED";
const VERSION_ATTRIBUTE = "version";

interface Props {
    markdown: string;
}

export const Mindmap = ({ markdown }: Props) => {
    const { t } = useTranslation();
    const transformer = useMemo(() => new Transformer(), []);
    const svgEl = useRef<SVGSVGElement>(null);
    const [isSourceView, setIsSourceView] = useState(false);
    const [freeplaneXML, setFreeplaneXML] = useState("");
    const [debouncedMarkdown, setDebouncedMarkdown] = useState(markdown);
    const isLight = useContext(LightContext);

    // Debounce markdown changes - to prevent frequent updates
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedMarkdown(markdown);
        }, DEBOUNCE_DELAY);

        return () => clearTimeout(timer);
    }, [markdown]);

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
    );

    // Transform markdown data - memoized for performance
    const transformedData = useMemo(() => {
        if (!debouncedMarkdown) return null;
        return transformer.transform(debouncedMarkdown);
    }, [transformer, debouncedMarkdown]);

    // create mindmap
    const createMM = useCallback(() => {
        if (!svgEl.current || !transformedData) return;

        // Clear the existing SVG content
        svgEl.current.innerHTML = "";

        const mm = Markmap.create(svgEl.current as SVGSVGElement, { autoFit: true });
        if (mm) {
            const { root } = transformedData;
            parseXML(root);

            mm.setData(root);
            mm.fit(MARKMAP_FIT_PADDING);
        }
        svgEl.current?.setAttribute("title", t("components.mindmap.mindmap"));
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
    }, [isSourceView]);

    // rescale mindmap
    const rescale = useCallback(() => {
        if (!isSourceView && svgEl.current && transformedData) {
            setTimeout(() => {
                // Clear and recreate the mindmap
                svgEl.current!.innerHTML = "";
                createMM();
            }, RESCALE_DELAY);
        }
    }, [isSourceView, createMM, transformedData]);

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

    return (
        <Stack verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                    <div className={styles.title}>Brainstorming</div>
                    <div>
                        <Tooltip
                            content={isSourceView ? t("components.mindmap.mindmap") : t("components.mindmap.source")}
                            relationship="description"
                            positioning="above"
                        >
                            <Button
                                appearance="subtle"
                                aria-label={isSourceView ? t("components.mindmap.source") : t("components.mindmap.mindmap")}
                                icon={<ContentView24Regular className={styles.iconRightMargin} />}
                                onClick={() => toggleSourceView()}
                                size="large"
                            ></Button>
                        </Tooltip>
                        {!isSourceView && (
                            <Tooltip content={t("components.mindmap.reset")} relationship="description" positioning="above">
                                <Button
                                    appearance="subtle"
                                    aria-label={t("components.mindmap.reset")}
                                    icon={<ScaleFill24Regular className={styles.iconRightMargin} />}
                                    onClick={() => rescale()}
                                    size="large"
                                ></Button>
                            </Tooltip>
                        )}
                        {!isSourceView && (
                            <Tooltip content={t("components.mindmap.download")} relationship="description" positioning="above">
                                <Button
                                    appearance="subtle"
                                    aria-label={t("components.mindmap.download")}
                                    icon={<ArrowDownload24Regular className={styles.iconRightMargin} />}
                                    onClick={() => download()}
                                    size="large"
                                ></Button>
                            </Tooltip>
                        )}
                    </div>
                </Stack>
            </Stack.Item>
            {!isSourceView ? (
                <Stack.Item grow>
                    <div className={styles.svgContainer}>
                        <svg
                            id="markmap"
                            className={`${styles.svgMark} ${isLight ? "" : styles.darkmindmap}`}
                            ref={svgEl}
                            role="img"
                            aria-label={t("components.mindmap.mindmap")}
                        />
                    </div>
                </Stack.Item>
            ) : (
                <Stack.Item grow>
                    <div className={styles.answerText}>{debouncedMarkdown}</div>
                </Stack.Item>
            )}
        </Stack>
    );
};
