import React, { useCallback, useEffect, useState, useRef } from "react";
import styles from "./Mermaid.module.css";
import { ArrowDownload24Regular, ZoomIn24Regular, ZoomOut24Regular, FullScreenMaximize24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import mermaid, { MermaidConfig } from "mermaid";
import DOMPurify from "dompurify";
export interface MermaidProps {
    text: string;
    darkTheme: boolean;
}

export const Mermaid: React.FC<MermaidProps> = ({ text, darkTheme }) => {
    const [diagram, setDiagram] = useState<string | boolean>(true);
    const [id, setID] = useState<string>("");
    const [zoomLevel, setZoomLevel] = useState<number>(1); // Back to 100% default
    const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const svgContainerRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const initializedThemeRef = useRef<boolean | null>(null);

    // Initialize once per theme
    useEffect(() => {
        if (initializedThemeRef.current !== darkTheme) {
            // Enhanced Mermaid configuration for better rendering
            mermaid.initialize({
                startOnLoad: false,
                theme: darkTheme ? "dark" : "default",
                securityLevel: "strict",
                suppressErrorRendering: true,
                fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                fontSize: 18, // Further increased from 16 for even higher resolution
                // Enhanced configuration for better rendering
                themeVariables: {
                    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    fontSize: "18px", // Further increased from 16px
                    fontWeight: "500", // Slightly bolder for better visibility
                    primaryColor: darkTheme ? "#1f2937" : "#f8fafc",
                    primaryTextColor: darkTheme ? "#f9fafb" : "#1f2937",
                    primaryBorderColor: darkTheme ? "#374151" : "#d1d5db",
                    lineColor: darkTheme ? "#6b7280" : "#4b5563",
                    secondaryColor: darkTheme ? "#374151" : "#e5e7eb",
                    tertiaryColor: darkTheme ? "#4b5563" : "#f3f4f6"
                },
                // Flowchart specific settings for better layout
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: "basis",
                    padding: 40, // Further increased padding
                    nodeSpacing: 80, // Further increased spacing
                    rankSpacing: 80, // Further increased spacing
                    diagramPadding: 40 // Further increased padding
                },
                // Graph specific settings
                graph: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: "basis",
                    padding: 40 // Further increased padding
                },
                // Additional settings for better rendering
                er: {
                    fontSize: 18,
                    useMaxWidth: true
                },
                gantt: {
                    fontSize: 18,
                    useMaxWidth: true
                },
                journey: {
                    useMaxWidth: true
                },
                sequence: {
                    useMaxWidth: true,
                    fontSize: 18
                }
            } as MermaidConfig);
            initializedThemeRef.current = darkTheme;
        }
    }, [darkTheme]);

    useEffect(() => {
        const render = async () => {
            // Generate a random ID for Mermaid to use.
            const id = `mermaid-svg-${Math.round(Math.random() * 10000000)}`;
            setID(id);

            // Confirm the diagram is valid before rendering (basic input cleaning only)
            const cleanedInput = text.replaceAll("`", "").trim();

            // Additional input validation to prevent potentially malicious Mermaid syntax
            if (cleanedInput.length > 50000) {
                console.warn("Mermaid input too large, potential DoS attempt");
                setDiagram(false);
                return;
            }

            // Check for potentially dangerous patterns in Mermaid input
            const suspiciousPatterns = [/<script/i, /javascript:/i, /data:text\/html/i, /vbscript:/i, /on\w+\s*=/i];

            if (suspiciousPatterns.some(pattern => pattern.test(cleanedInput))) {
                console.warn("Potentially malicious content detected in Mermaid input");
                setDiagram(false);
                return;
            }

            const validMermaid = await mermaid.parse(cleanedInput, { suppressErrors: true });
            if (validMermaid) {
                let svg: string | undefined;
                try {
                    // Attempt to render the Mermaid diagram
                    const result = await mermaid.render(id, cleanedInput);
                    svg = result.svg;
                } catch (error) {
                    // If rendering fails, ensure svg is undefined
                    svg = undefined;
                    console.error("Mermaid rendering failed:", error);
                }
                if (svg) {
                    // Parse the SVG directly without aggressive sanitization first
                    const svgImage = new DOMParser().parseFromString(svg, "text/html").body.firstElementChild;
                    if (svgImage) {
                        // Get original dimensions
                        const originalWidth = svgImage.getAttribute("width") || "800";
                        const originalHeight = svgImage.getAttribute("height") || "600";

                        // Remove fixed dimensions to allow responsive scaling
                        svgImage.removeAttribute("width");
                        svgImage.removeAttribute("height");

                        // Set responsive attributes for sharp rendering with high DPI support
                        const viewBox = svgImage.getAttribute("viewBox") || `0 0 ${originalWidth} ${originalHeight}`;
                        svgImage.setAttribute("viewBox", viewBox);
                        svgImage.setAttribute("preserveAspectRatio", "xMidYMid meet");

                        // Enhanced styling for maximum sharpness
                        svgImage.setAttribute(
                            "style",
                            `
                            width: 100%;
                            height: auto;
                            max-width: 100%;
                            display: block;
                            transform: scale(${zoomLevel});
                            transform-origin: top left;
                            image-rendering: -webkit-optimize-contrast;
                            image-rendering: -moz-crisp-edges;
                            image-rendering: crisp-edges;
                            image-rendering: pixelated;
                            shape-rendering: geometricPrecision;
                            text-rendering: geometricPrecision;
                            vector-effect: non-scaling-stroke;
                        `
                        );

                        // Enhance all text elements for maximum sharpness
                        const textElements = svgImage.querySelectorAll("text, tspan, foreignObject");
                        textElements.forEach(textEl => {
                            textEl.setAttribute("text-rendering", "geometricPrecision");
                            textEl.setAttribute("dominant-baseline", "central");
                            textEl.setAttribute("font-weight", "500"); // Slightly bolder

                            // Add text stroke for better definition
                            const currentFill = textEl.getAttribute("fill") || (textEl as HTMLElement).style?.fill;
                            if (currentFill && currentFill !== "none") {
                                textEl.setAttribute("stroke", currentFill);
                                textEl.setAttribute("stroke-width", "0.3");
                                textEl.setAttribute("paint-order", "stroke fill");
                            }
                        });

                        // Enhance line and path rendering
                        const pathElements = svgImage.querySelectorAll("path, line, polyline, polygon, rect, circle, ellipse");
                        pathElements.forEach(pathEl => {
                            pathEl.setAttribute("shape-rendering", "geometricPrecision");
                            pathEl.setAttribute("vector-effect", "non-scaling-stroke");

                            // Ensure minimum stroke width for visibility
                            const strokeWidth = pathEl.getAttribute("stroke-width") || "1";
                            if (parseFloat(strokeWidth) < 1.5) {
                                pathEl.setAttribute("stroke-width", "1.5");
                            }
                        });

                        // Add high-DPI support
                        svgImage.setAttribute("data-dpr", window.devicePixelRatio?.toString() || "1");

                        // Final sanitization - comprehensive allowlist to preserve all styling
                        const finalSanitizedSvg = DOMPurify.sanitize(svgImage.outerHTML, {
                            USE_PROFILES: { svg: true },
                            KEEP_CONTENT: true,
                            ADD_TAGS: ["foreignObject", "tspan", "text", "defs", "marker", "pattern", "clipPath", "mask"],
                            ADD_ATTR: [
                                // Basic SVG attributes
                                "class",
                                "id",
                                "x",
                                "y",
                                "dx",
                                "dy",
                                "width",
                                "height",
                                "viewBox",
                                "preserveAspectRatio",
                                // Text attributes
                                "text-anchor",
                                "dominant-baseline",
                                "font-family",
                                "font-size",
                                "font-weight",
                                "font-style",
                                // Visual styling
                                "fill",
                                "stroke",
                                "stroke-width",
                                "stroke-dasharray",
                                "stroke-linecap",
                                "stroke-linejoin",
                                "opacity",
                                "fill-opacity",
                                "stroke-opacity",
                                // Rendering attributes
                                "text-rendering",
                                "shape-rendering",
                                "vector-effect",
                                "paint-order",
                                "image-rendering",
                                // Transform and positioning
                                "style",
                                "transform",
                                "transform-origin",
                                "data-dpr",
                                // Geometry attributes
                                "d",
                                "cx",
                                "cy",
                                "r",
                                "rx",
                                "ry",
                                "x1",
                                "y1",
                                "x2",
                                "y2",
                                "points",
                                // Path and shape attributes
                                "pathLength",
                                "marker-start",
                                "marker-mid",
                                "marker-end",
                                // Filter and effects
                                "filter",
                                "clip-path",
                                "mask",
                                // Additional Mermaid-specific attributes
                                "data-id",
                                "data-node-id",
                                "data-edge-id",
                                "role",
                                "aria-label",
                                "tabindex"
                            ],
                            FORBID_TAGS: ["script", "object", "embed", "link", "meta", "base"],
                            FORBID_ATTR: [
                                "onload",
                                "onerror",
                                "onclick",
                                "onmouseover",
                                "onfocus",
                                "onblur",
                                "onmousedown",
                                "onmouseup",
                                "onmousemove",
                                "onkeydown",
                                "onkeyup",
                                "onkeypress",
                                "onchange",
                                "onsubmit",
                                "onreset"
                            ]
                        });

                        setDiagram(finalSanitizedSvg);
                    } else {
                        setDiagram(false);
                    }
                } else {
                    const stale = document.getElementById(id);
                    if (stale) stale.remove();
                    setDiagram(false);
                }
            } else {
                setDiagram(false);
            }
        };
        render();
    }, [text, darkTheme]);

    const download = useCallback(() => {
        const svgElement = document.getElementById(id);

        if (svgElement) {
            // Create a copy of the SVG for download (without zoom transform)
            const svgCopy = svgElement.cloneNode(true) as SVGElement;
            svgCopy.setAttribute(
                "style",
                `
                width: 100%;
                height: auto;
                max-width: 100%;
                display: block;
                image-rendering: crisp-edges;
                shape-rendering: geometricPrecision;
            `
            );

            if (!svgCopy.getAttribute("xmlns")) {
                svgCopy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            }
            const blob = new Blob([svgCopy.outerHTML], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.download = "mermaid-diagram.svg";
            a.href = url;
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [id]);

    const handleZoomIn = useCallback(() => {
        setZoomLevel(prev => Math.min(prev + 0.25, 5));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoomLevel(prev => Math.max(prev - 0.25, 0.1));
    }, []);

    const handleResetZoom = useCallback(() => {
        setZoomLevel(1); // Reset to 100%
        setPanOffset({ x: 0, y: 0 });
    }, []);

    // Remove zoom presets functionality

    // Mouse wheel zoom
    const handleWheel = useCallback((event: React.WheelEvent) => {
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            event.stopPropagation();

            const delta = event.deltaY > 0 ? -0.1 : 0.1;
            setZoomLevel(prev => Math.min(Math.max(prev + delta, 0.1), 5));
        }
    }, []);

    // Pan functionality
    const handleMouseDown = useCallback(
        (event: React.MouseEvent) => {
            if (zoomLevel > 1) {
                // Allow panning when zoomed above 100%
                setIsDragging(true);
                setDragStart({ x: event.clientX - panOffset.x, y: event.clientY - panOffset.y });
                event.preventDefault();
            }
        },
        [zoomLevel, panOffset]
    );

    const handleMouseMove = useCallback(
        (event: React.MouseEvent) => {
            if (isDragging && zoomLevel > 1) {
                setPanOffset({
                    x: event.clientX - dragStart.x,
                    y: event.clientY - dragStart.y
                });
            }
        },
        [isDragging, dragStart, zoomLevel]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Double-click to fit or reset
    const handleDoubleClick = useCallback(() => {
        if (zoomLevel === 1) {
            // If at default zoom (100%), zoom to fit width
            if (containerRef.current && svgContainerRef.current) {
                const containerWidth = containerRef.current.clientWidth - 32; // Account for padding
                const svgElement = svgContainerRef.current.querySelector("svg");
                if (svgElement) {
                    const svgWidth = svgElement.getBoundingClientRect().width; // Get current width without division
                    const fitZoom = Math.min(containerWidth / svgWidth, 3); // Max 3x zoom
                    setZoomLevel(fitZoom);
                }
            }
        } else {
            // If zoomed, reset to default (100%)
            handleResetZoom();
        }
    }, [zoomLevel, handleResetZoom]);

    // Enhanced wheel event handling with DOM event listener
    useEffect(() => {
        const handleWheelEvent = (event: WheelEvent) => {
            if ((event.ctrlKey || event.metaKey) && containerRef.current?.contains(event.target as Node)) {
                event.preventDefault();
                event.stopPropagation();

                const delta = event.deltaY > 0 ? -0.1 : 0.1;
                setZoomLevel(prev => Math.min(Math.max(prev + delta, 0.1), 5));
            }
        };

        // Add event listener with capture to ensure we get the event before browser zoom
        document.addEventListener("wheel", handleWheelEvent, { passive: false, capture: true });

        return () => {
            document.removeEventListener("wheel", handleWheelEvent, { capture: true });
        };
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                return; // Don't interfere with input fields
            }

            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case "+":
                    case "=":
                        event.preventDefault();
                        handleZoomIn();
                        break;
                    case "-":
                        event.preventDefault();
                        handleZoomOut();
                        break;
                    case "0":
                        event.preventDefault();
                        handleResetZoom();
                        break;
                }
            }
        };

        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    }, [handleZoomIn, handleZoomOut, handleResetZoom]);

    if (diagram === true) {
        return <p className="...">{t("components.mermaid.render")}</p>;
    } else if (diagram === false) {
        return <p className="...">{t("components.mermaid.error")}</p>;
    } else {
        return (
            <div className={styles.diagramContainer} ref={containerRef}>
                <div className={styles.diagramWrapper} onWheel={handleWheel}>
                    <div
                        ref={svgContainerRef}
                        className={styles.svgContainer}
                        style={{
                            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                            transformOrigin: "top left",
                            transition: isDragging ? "none" : "transform 0.2s ease-in-out",
                            cursor: zoomLevel > 1 ? (isDragging ? "grabbing" : "grab") : "default"
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        onDoubleClick={handleDoubleClick}
                        /* biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify above */
                        dangerouslySetInnerHTML={{ __html: diagram ?? "" }}
                    />
                </div>
                <div className={styles.controlsContainer}>
                    <div className={styles.zoomControls}>
                        <div className={styles.zoomButtons}>
                            <Tooltip content={t("components.mermaid.zoomOut", "Zoom Out (Ctrl + -)")} relationship="description" positioning="above">
                                <Button
                                    appearance="subtle"
                                    aria-label={t("components.mermaid.zoomOut", "Zoom Out")}
                                    icon={<ZoomOut24Regular />}
                                    onClick={handleZoomOut}
                                    size="small"
                                    disabled={zoomLevel <= 0.1}
                                />
                            </Tooltip>
                            <span className={styles.zoomLevel}>{Math.round(zoomLevel * 100)}%</span>
                            <Tooltip content={t("components.mermaid.zoomIn", "Zoom In (Ctrl + +)")} relationship="description" positioning="above">
                                <Button
                                    appearance="subtle"
                                    aria-label={t("components.mermaid.zoomIn", "Zoom In")}
                                    icon={<ZoomIn24Regular />}
                                    onClick={handleZoomIn}
                                    size="small"
                                    disabled={zoomLevel >= 5}
                                />
                            </Tooltip>
                            <Tooltip
                                content={t("components.mermaid.resetZoom", "Reset Zoom (Ctrl + 0, Double-click)")}
                                relationship="description"
                                positioning="above"
                            >
                                <Button
                                    appearance="subtle"
                                    aria-label={t("components.mermaid.resetZoom", "Reset Zoom")}
                                    icon={<FullScreenMaximize24Regular />}
                                    onClick={handleResetZoom}
                                    size="small"
                                />
                            </Tooltip>
                        </div>
                    </div>
                    <div className={styles.downloadContainer}>
                        <span className={styles.mermaidLabel}>mermaid</span>
                        <Tooltip content={t("components.mermaid.download")} relationship="description" positioning="above">
                            <Button
                                appearance="subtle"
                                aria-label={t("components.mermaid.download")}
                                icon={<ArrowDownload24Regular />}
                                onClick={download}
                                size="small"
                            />
                        </Tooltip>
                    </div>
                </div>
            </div>
        );
    }
};
