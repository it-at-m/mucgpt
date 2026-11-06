import { DEFAULT_APP_CONFIG } from "../../constants";
import { useConfigContext } from "../../context/ConfigContext";

/**
 * Canvas size limits.
 *
 * The authoritative values come from the backend (app/api/api_models.py and
 * app/config/settings.py: CANVAS_CONTENT_MAX_CHARS / CANVAS_EDITOR_MAX_CHARS)
 * and reach the frontend through the /config endpoint (ConfigResponse).
 * Components read them via useCanvasLimits(); the ConfigContext default
 * (DEFAULT_APP_CONFIG) doubles as the fallback for the time before the config
 * has loaded.
 */
export interface CanvasLimits {
    /** Editor input limit and export endpoint cap ("512 kB of characters"). */
    editorLimitChars: number;
    /** Canvas content cap for persistence and agent interaction ("256 kB"). The
     * request is clipped here; content in the editor may exceed it up to the
     * editor limit and is then only readable and exportable, not persistable. */
    contentLimitChars: number;
    /** Above this length the user is warned and the editor greys the overflow. */
    warnChars: number;
}

/** The over-limit warning threshold derives from the content limit (95 %). */
export const canvasWarnCharsFor = (contentLimitChars: number): number => Math.floor((contentLimitChars * 95) / 100);

export const fallbackCanvasLimits = (): CanvasLimits => ({
    editorLimitChars: DEFAULT_APP_CONFIG.canvas_editor_max_chars,
    contentLimitChars: DEFAULT_APP_CONFIG.canvas_content_max_chars,
    warnChars: canvasWarnCharsFor(DEFAULT_APP_CONFIG.canvas_content_max_chars)
});

export function useCanvasLimits(): CanvasLimits {
    const { canvas_content_max_chars: contentLimitChars, canvas_editor_max_chars: editorLimitChars } = useConfigContext();
    // Configs that do not carry the canvas limits (older backends, partial test
    // setups) fall back to the built-in defaults instead of producing invalid
    // limits.
    const fallback = fallbackCanvasLimits();
    const content = Number.isFinite(contentLimitChars) && contentLimitChars > 0 ? contentLimitChars : fallback.contentLimitChars;
    const editor = Number.isFinite(editorLimitChars) && editorLimitChars > 0 ? editorLimitChars : fallback.editorLimitChars;
    return { editorLimitChars: editor, contentLimitChars: content, warnChars: canvasWarnCharsFor(content) };
}
