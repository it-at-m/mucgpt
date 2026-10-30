/**
 * Canvas size limits, mirroring the backend (app/api/api_models.py
 * CANVAS_CONTENT_MAX_CHARS / CANVAS_READ_LIMIT_CHARS and
 * app/export/converter.py _MAX_CONTENT_CHARS).
 */

/** Editor input limit and export endpoint cap ("512 kB of characters"). */
export const CANVAS_EXPORT_LIMIT_CHARS = 512 * 1024;

/** Canvas content cap for persistence and agent interaction ("256 kB"). The
 * request is clipped here; content in the editor may exceed it up to the
 * export limit and is then only readable and exportable, not persistable. */
export const CANVAS_CONTENT_LIMIT_CHARS = 256 * 1024;

/** Above this length the user is warned and the editor greys the overflow. */
export const CANVAS_WARN_CHARS = Math.floor((CANVAS_CONTENT_LIMIT_CHARS * 95) / 100);
