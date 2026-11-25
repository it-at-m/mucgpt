// Pre-chat canvas draft: a single sessionStorage slot protects canvas content
// typed before any conversation exists (no server autosave is possible yet).
// It is cleared when the content is adopted into a fresh conversation or
// deliberately cleared. sessionStorage survives reloads but is tab-local and
// vanishes with the tab.
const CANVAS_DRAFT_KEY = "canvas-draft";

// sessionStorage can throw (private mode, quota, disabled storage); a lost draft is acceptable then.
const tryStorage = (action: () => void) => {
    try {
        action();
    } catch {
        // Continue without draft persistence.
    }
};

export const loadCanvasDraft = (): string | null => {
    try {
        return sessionStorage.getItem(CANVAS_DRAFT_KEY);
    } catch {
        return null;
    }
};

export const saveCanvasDraft = (markdown: string): void => tryStorage(() => sessionStorage.setItem(CANVAS_DRAFT_KEY, markdown));

export const clearCanvasDraft = (): void => tryStorage(() => sessionStorage.removeItem(CANVAS_DRAFT_KEY));
