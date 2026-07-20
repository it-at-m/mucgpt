/**
 * Loads the vendored draw.io viewer script once.
 * The file lives in public/vendor/drawio/ (served as a static asset by Vite).
 * Nothing is imported from a CDN.
 */

export type DrawioGraphViewer = {
    processElements: (className?: string) => void;
    createViewerForElement: (element: HTMLElement) => void;
};

declare global {
    interface Window {
        GraphViewer?: DrawioGraphViewer;
        PROXY_URL?: string;
        STYLE_PATH?: string;
        STENCIL_PATH?: string;
        SHAPES_PATH?: string;
        GRAPH_IMAGE_PATH?: string;
        DRAW_MATH_URL?: string;
        DRAWIO_LIGHTBOX_URL?: string;
        EXPORT_URL?: string;
        VSS_CONVERT_URL?: string;
        DRAWIO_LOG_URL?: string;
    }
}

const VIEWER_SCRIPT_PATH = "vendor/drawio/viewer-static.min.js";

let loadPromise: Promise<DrawioGraphViewer> | null = null;

/** Blank out defaults that would otherwise point at viewer.diagrams.net. */
function disableRemoteDrawioEndpoints(): void {
    window.PROXY_URL = "";
    window.STYLE_PATH = "";
    window.STENCIL_PATH = "";
    window.SHAPES_PATH = "";
    window.GRAPH_IMAGE_PATH = "";
    window.DRAW_MATH_URL = "";
    window.DRAWIO_LIGHTBOX_URL = "";
    window.EXPORT_URL = "";
    window.VSS_CONVERT_URL = "";
    window.DRAWIO_LOG_URL = "";
}

function viewerScriptUrl(): string {
    const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    return `${base}${VIEWER_SCRIPT_PATH}`;
}

/**
 * Ensures GraphViewer is on window. Safe to call many times; only one script tag is added.
 */
export function loadDrawioViewer(): Promise<DrawioGraphViewer> {
    if (window.GraphViewer) {
        return Promise.resolve(window.GraphViewer);
    }

    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = new Promise<DrawioGraphViewer>((resolve, reject) => {
        disableRemoteDrawioEndpoints();

        const existing = document.querySelector<HTMLScriptElement>(`script[data-mucgpt-drawio-viewer="true"]`);
        if (existing) {
            existing.addEventListener("load", () => {
                if (window.GraphViewer) resolve(window.GraphViewer);
                else reject(new Error("Draw.io viewer loaded but GraphViewer is missing"));
            });
            existing.addEventListener("error", () => reject(new Error("Failed to load draw.io viewer script")));
            return;
        }

        const script = document.createElement("script");
        script.src = viewerScriptUrl();
        script.async = true;
        script.dataset.mucgptDrawioViewer = "true";
        script.onload = () => {
            if (window.GraphViewer) resolve(window.GraphViewer);
            else reject(new Error("Draw.io viewer loaded but GraphViewer is missing"));
        };
        script.onerror = () => {
            loadPromise = null;
            reject(new Error(`Failed to load draw.io viewer from ${script.src}`));
        };
        document.head.appendChild(script);
    });

    return loadPromise;
}
