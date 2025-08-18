import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BaseFragment } from "../BaseFragment/BaseFragment";
import { BaseFragmentProps } from "../types";
import styles from "./DiagramFragment.module.css";
import { Button, Tooltip, Spinner } from "@fluentui/react-components";
import { ArrowDownload24Regular, Code24Regular, ArrowExpand24Regular } from "@fluentui/react-icons";
import mermaid from "mermaid";
import { graphviz } from "d3-graphviz";

const MERMAID_BLOCK_REGEX = /```MUCGPTDiagram\s+mermaid\n([\s\S]*?)```/i;
const GRAPHVIZ_BLOCK_REGEX = /```MUCGPTDiagram\s+graphviz\n([\s\S]*?)```/i;

interface ParsedDiagram {
    type: "mermaid" | "graphviz" | null;
    code: string | null;
}

function heuristicDetect(raw: string): ParsedDiagram {
    const firstLine = raw.split(/\n/, 1)[0].trim().toLowerCase();
    // Mermaid indicators
    const mermaidStarts = [
        "graph ",
        "flowchart ",
        "sequenceDiagram".toLowerCase(),
        "classDiagram".toLowerCase(),
        "stateDiagram".toLowerCase(),
        "erDiagram".toLowerCase(),
        "journey".toLowerCase(),
        "gantt".toLowerCase(),
        "pie".toLowerCase()
    ];
    if (mermaidStarts.some(p => firstLine.startsWith(p))) {
        return { type: "mermaid", code: raw.trim() };
    }
    // Graphviz indicators
    if (/^(strict\s+)?(di)?graph\b/.test(firstLine)) {
        return { type: "graphviz", code: raw.trim() };
    }
    return { type: null, code: raw.trim() || null };
}

function parseDiagram(content: string): ParsedDiagram {
    const mermaidMatch = content.match(MERMAID_BLOCK_REGEX);
    if (mermaidMatch) return { type: "mermaid", code: mermaidMatch[1].trim() };
    const graphvizMatch = content.match(GRAPHVIZ_BLOCK_REGEX);
    if (graphvizMatch) return { type: "graphviz", code: graphvizMatch[1].trim() };
    // fallback heuristic (content might be only the code without wrapper fences)
    return heuristicDetect(content);
}

export const DiagramFragment: React.FC<BaseFragmentProps> = ({ content }) => {
    const { type, code } = useMemo(() => parseDiagram(content), [content]);
    const [showSource, setShowSource] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [isRendering, setIsRendering] = useState(false);
    const graphvizRef = useRef<HTMLDivElement | null>(null);
    const mermaidIdRef = useRef<string>(`mermaid-${Math.random().toString(36).slice(2)}`);

    // Render Mermaid
    useEffect(() => {
        if (type !== "mermaid" || !code || showSource) return;
        setIsRendering(true);
        setRenderError(null);
        try {
            mermaid.initialize({
                startOnLoad: false,
                theme: "default",
                securityLevel: "loose",
                suppressErrorRendering: true
            });
            const sanitized = code.replace(/```/g, "");
            mermaid
                .render(mermaidIdRef.current, sanitized)
                .then(result => {
                    const el = document.getElementById(mermaidIdRef.current);
                    if (el) {
                        el.innerHTML = result.svg;
                    }
                })
                .catch(err => {
                    console.error("Mermaid render error", err);
                    setRenderError("Mermaid rendering failed.");
                })
                .finally(() => setIsRendering(false));
        } catch (e) {
            console.error(e);
            setRenderError("Mermaid initialization failed.");
            setIsRendering(false);
        }
    }, [type, code, showSource]);

    // Render Graphviz
    useEffect(() => {
        if (type !== "graphviz" || !code || showSource) return;
        let cancelled = false;
        setIsRendering(true);
        setRenderError(null);
        try {
            if (!graphvizRef.current) {
                setRenderError("Render target missing.");
                setIsRendering(false);
                return;
            }
            const g = graphviz(graphvizRef.current).engine("dot");
            g.renderDot(code).on("end", () => {
                if (!cancelled) setIsRendering(false);
            });
        } catch (e) {
            console.error("Graphviz render error", e);
            setRenderError("Graphviz rendering failed.");
            setIsRendering(false);
        }
        return () => {
            cancelled = true;
        };
    }, [type, code, showSource]);

    const toggleSource = useCallback(() => setShowSource(s => !s), []);
    const toggleFullscreen = useCallback(() => setIsFullscreen(f => !f), []);

    const download = useCallback(() => {
        if (!code) return;
        const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `diagram.${type === "graphviz" ? "dot" : "mmd"}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [code, type]);

    const actions = (
        <>
            <Tooltip content={showSource ? "Show diagram" : "Show source"} relationship="description" positioning="above">
                <Button appearance="subtle" aria-label="toggle source" icon={<Code24Regular />} onClick={toggleSource} disabled={!code || isRendering} />
            </Tooltip>
            <Tooltip content={isFullscreen ? "Exit fullscreen" : "Fullscreen"} relationship="description" positioning="above">
                <Button
                    appearance="subtle"
                    aria-label="fullscreen"
                    icon={<ArrowExpand24Regular />}
                    onClick={toggleFullscreen}
                    disabled={!code || isRendering}
                />
            </Tooltip>
            <Tooltip content="Download" relationship="description" positioning="above">
                <Button appearance="subtle" aria-label="download" icon={<ArrowDownload24Regular />} onClick={download} disabled={!code} />
            </Tooltip>
        </>
    );

    const body = (
        <div className={styles.diagramContainer}>
            {isRendering && <Spinner label="Rendering diagram..." />}
            {renderError && <div className={styles.statusInfo}>{renderError}</div>}
            {!code && <div className={styles.statusInfo}>No diagram detected.</div>}
            {code && !showSource && type === "mermaid" && <div id={mermaidIdRef.current} className={styles.diagramRenderArea}></div>}
            {code && !showSource && type === "graphviz" && <div ref={graphvizRef} className={`${styles.diagramRenderArea} ${styles.graphvizContainer}`}></div>}
            {code && showSource && <pre className={styles.codeView}>{code}</pre>}
        </div>
    );

    return (
        <BaseFragment
            title={type ? `Diagram (${type})` : "Diagram"}
            content={code || content}
            actions={actions}
            className={isFullscreen ? styles.fullscreenWrapper : undefined}
        >
            {body}
        </BaseFragment>
    );
};
