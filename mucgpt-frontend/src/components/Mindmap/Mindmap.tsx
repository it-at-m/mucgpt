import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./Mindmap.module.css";
import { Stack } from "@fluentui/react";
import { useTranslation } from "react-i18next";
import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowDownload24Regular, ContentView24Regular, ScaleFill24Regular } from "@fluentui/react-icons";
import { AnswerIcon } from "../Answer/AnswerIcon";
import { IPureNode } from "markmap-common";
import { LightContext } from "../../pages/layout/LightContext";
interface Props {
    markdown: string;
}

export const Mindmap = ({ markdown }: Props) => {
    const { t } = useTranslation();
    const transformer = useMemo(() => new Transformer(), []);
    const svgEl = useRef<SVGSVGElement>(null);
    const [isSourceView, setIsSourceView] = useState(false);
    const [freeplaneXML, setFreeplaneXML] = useState("");
    const isLight = useContext(LightContext);

    useLayoutEffect(() => {
        createMM();
    }, []);

    // toggle source view
    const toggleSourceView = useCallback(() => {
        setIsSourceView(!isSourceView);
        setTimeout(() => {
            if (isSourceView) {
                createMM();
            }
        }, 50);
    }, [isSourceView]);

    // rescale midmap
    const rescale = useCallback(() => {
        setTimeout(() => {
            if (!isSourceView) {
                const mm = Markmap.create(svgEl.current as SVGSVGElement);
                mm.destroy();
                createMM();
            }
        }, 50);
    }, [isSourceView]);

    // download mindmap
    const download = useCallback(() => {
        if (svgEl && svgEl.current) {
            // fetch SVG-rendered image as a blob object
            const svgBlob = new Blob([freeplaneXML], {
                type: "text-plain/mm;charset=utf-8"
            });

            // convert the blob object to a dedicated URL
            const url = URL.createObjectURL(svgBlob);

            // load the SVG blob to a flesh image object
            const img = new Image();
            const link = document.createElement("a");
            link.href = url;
            link.download = "Idee.mm";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            img.src = url;
        }
    }, [freeplaneXML]);

    // parse XML
    const parseXML = useCallback((parsed: IPureNode) => {
        const doc = document.implementation.createDocument(null, null, null);
        const mapElem = doc.createElement("map");
        mapElem.setAttribute("version", "freeplane 1.11.1");

        const question = doc.createElement("node");
        question.setAttribute("TEXT", parsed.content);
        question.setAttribute("FOLDED", "false");

        for (const child of parsed.children) {
            parseNodes(child, question, doc);
        }
        mapElem.appendChild(question);
        doc.appendChild(mapElem);
        setFreeplaneXML(new XMLSerializer().serializeToString(mapElem));
    }, []);

    // parse Nodes
    const parseNodes = useCallback((to_be_parsed: IPureNode, parent: HTMLElement, doc: XMLDocument) => {
        const result = doc.createElement("node");
        result.setAttribute("TEXT", to_be_parsed.content);

        //const edge = doc.createElement("edge");
        //edge.setAttribute("COLOR", "")

        for (const child of to_be_parsed.children) {
            parseNodes(child, result, doc);
        }
        parent.appendChild(result);
    }, []);

    // create mindmap
    const createMM = useCallback(() => {
        const mm = Markmap.create(svgEl.current as SVGSVGElement, { autoFit: true });
        if (mm) {
            const { root } = transformer.transform(markdown || "");
            parseXML(root);

            mm.setData(root);
            mm.fit(10);
        }
        svgEl.current?.setAttribute("title", "Generierte Mindmap");
    }, [transformer, markdown]);

    return (
        <Stack verticalAlign="space-between" className={`${styles.mindmapContainer}`}>
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon aria-hidden />
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
                    <div className={styles.mindmapContainer}>
                        <svg id="markmap" className={`${styles.svgMark} ${isLight ? "" : styles.darkmindmap}`} ref={svgEl} aria-hidden="true" role="img"></svg>
                    </div>
                </Stack.Item>
            ) : (
                <Stack.Item grow>
                    <div className={styles.answerText}>{markdown}</div>
                </Stack.Item>
            )}
        </Stack>
    );
};
