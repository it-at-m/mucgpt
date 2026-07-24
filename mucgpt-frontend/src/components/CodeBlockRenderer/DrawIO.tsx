import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowDownload24Regular } from "@fluentui/react-icons";
import styles from "./DrawIO.module.css";
import { loadDrawioViewer } from "./loadDrawioViewer";
import { isSafeDiagramInput, sanitizeDrawioViewerHost } from "./diagramSecurity";
import { HighlightedCodeBlock } from "./HighlightedCodeBlock";

export interface DrawIOProps {
    text: string;
    darkTheme: boolean;
}

/**
 * Turns model output into XML the viewer accepts in data-mxgraph's "xml" field.
 * Accepts raw <mxGraphModel>, <mxfile>, or a tiny JSON wrapper with an "xml" key.
 */
export function normalizeDrawioXml(raw: string): string | null {
    // Only strip stray markdown fences at the edges — keep backticks inside labels.
    let xml = raw
        .trim()
        .replace(/^`+/, "")
        .replace(/`+$/, "")
        .trim();
    if (!xml) return null;

    if (xml.startsWith("{")) {
        try {
            const parsed = JSON.parse(xml) as { xml?: unknown };
            if (typeof parsed.xml === "string" && parsed.xml.trim()) {
                xml = parsed.xml.trim();
            }
        } catch {
            // not JSON — keep treating it as XML
        }
    }

    const lower = xml.toLowerCase();
    if (!(lower.includes("<mxfile") || lower.includes("<mxgraphmodel") || lower.includes("<diagram"))) {
        return null;
    }

    return xml;
}

/** Checks the completeness of the figure via checking for <mxgraphmodel> tag closing */
export function isLikelyIncompleteDrawioXml(raw: string): boolean {
    const xml = raw.trim().toLowerCase();
    if (!xml) return true;

    const openedModel = xml.includes("<mxgraphmodel");
    const closedModel = xml.includes("</mxgraphmodel>");
    if (openedModel && !closedModel) return true;

    const openedFile = xml.includes("<mxfile");
    const closedFile = xml.includes("</mxfile>");
    if (openedFile && !closedFile) return true;

    return false;
}

/** Did the Viewer actually draw something */
function hostHasDiagram(host: HTMLElement, mxgraph: HTMLElement): boolean {
    return Boolean(host.querySelector("svg") || mxgraph.querySelector("svg"));
}

/** Strip dangerous tags/attrs from viewer output; keep foreignObject label text. Basically a thin wrapper
 *  around digramXecurity.ts
 */
function sanitizeViewerOutput(host: HTMLElement): boolean {
    return sanitizeDrawioViewerHost(host);
}

/** Wrap raw mxGraphModel so desktop/web draw.io can open the downloaded file. */
function toDownloadableDrawioFile(xml: string): string {
    if (xml.toLowerCase().includes("<mxfile")) {
        return xml;
    }
    return `<mxfile host="MUCGPT" modified="${new Date().toISOString()}" agent="MUCGPT" version="1.0"><diagram id="mucgpt" name="Page-1">${xml}</diagram></mxfile>`;
}

function downloadDrawioXml(xml: string): void {
    const blob = new Blob([toDownloadableDrawioFile(xml)], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "diagram.drawio";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

export const DrawIO: React.FC<DrawIOProps> = ({ text, darkTheme }) => {
    // true = rendering…, false = error, "ready" = container mounted for the viewer
    const [diagram, setDiagram] = useState<string | boolean>(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    const onDownloadXml = useCallback(() => {
        const xml = normalizeDrawioXml(text);
        if (xml) {
            downloadDrawioXml(xml);
        }
    }, [text]);

    // Phase 1: guards + load local viewer + validate XML shape.
    useEffect(() => {
        let cancelled = false;
        setDiagram(true);

        (async () => {
            try {
                if (isLikelyIncompleteDrawioXml(text)) {
                    return;
                }

                if (!isSafeDiagramInput(text, "Draw.io")) {
                    if (!cancelled) setDiagram(false);
                    return;
                }

                const xml = normalizeDrawioXml(text);
                if (!xml) {
                    if (!cancelled) setDiagram(false);
                    return;
                }

                await loadDrawioViewer();
                if (!cancelled) setDiagram("ready");
            } catch (error) {
                console.error("Draw.io viewer failed to load:", error);
                if (!cancelled) setDiagram(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [text]);

    // Phase 2: viewer writes into the ref; we sanitize SVG before leaving it on screen.
    useEffect(() => {
        if (diagram !== "ready") return;

        const host = containerRef.current;
        if (!host || !window.GraphViewer) {
            setDiagram(false);
            return;
        }

        if (!isSafeDiagramInput(text, "Draw.io")) {
            setDiagram(false);
            return;
        }

        const xml = normalizeDrawioXml(text);
        if (!xml) {
            setDiagram(false);
            return;
        }

        host.replaceChildren();

        const mxgraph = document.createElement("div");
        mxgraph.className = "mxgraph";
        mxgraph.style.maxWidth = "100%";
        mxgraph.style.minWidth = "200px";
        mxgraph.setAttribute(
            "data-mxgraph",
            JSON.stringify({
                highlight: "#0000ff",
                nav: true,
                resize: true,
                // v1 trial: use draw.io's built-in zoom toolbar (simpler than Mermaid-style controls)
                toolbar: "zoom",
                "dark-mode": darkTheme ? "dark" : "0",
                xml
            })
        );
        host.appendChild(mxgraph);

        let cancelled = false;
        let attempts = 0;
        let retryTimer = 0;
        let started = false;

        const tryRender = () => {
            if (cancelled) return;
            try {
                if (!started) {
                    window.GraphViewer?.createViewerForElement(mxgraph);
                    started = true;
                }

                if (!hostHasDiagram(host, mxgraph)) {
                    attempts += 1;
                    if (attempts < 5) {
                        retryTimer = window.setTimeout(tryRender, 50);
                    } else {
                        setDiagram(false);
                    }
                    return;
                }

                if (!sanitizeViewerOutput(host)) {
                    setDiagram(false);
                }
            } catch (error) {
                console.error("Draw.io rendering failed:", error);
                setDiagram(false);
            }
        };

        const frame = window.requestAnimationFrame(tryRender);

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(frame);
            window.clearTimeout(retryTimer);
            host.replaceChildren();
        };
    }, [diagram, text, darkTheme]);

    if (diagram === true) {
        return <p className={styles.status}>{t("components.drawio.render")}</p>;
    }

    if (diagram === false) {
        return (
            <div className={styles.errorFallback}>
                <p className={styles.status}>{t("components.drawio.error")}</p>
                <HighlightedCodeBlock text={text} language="drawio" lightTheme={!darkTheme} />
            </div>
        );
    }

    return (
        <div className={`${styles.diagramContainer} ${darkTheme ? styles.dark : ""}`}>
            {/* Empty on purpose: GraphViewer mutates this node; output is sanitized afterward. */}
            <div className={styles.diagramWrapper} ref={containerRef} />
            <div className={styles.footer}>
                <div className={styles.downloadContainer}>
                    <span className={styles.drawioLabel}>drawio</span>
                    <Tooltip content={t("components.drawio.download")} relationship="description" positioning="above">
                        <Button
                            appearance="subtle"
                            aria-label={t("components.drawio.download")}
                            icon={<ArrowDownload24Regular />}
                            onClick={onDownloadXml}
                            size="small"
                        />
                    </Tooltip>
                </div>
            </div>
        </div>
    );
};
