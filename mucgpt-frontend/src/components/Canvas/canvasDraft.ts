// Pre-chat canvas draft: a single localStorage slot protects canvas content
// typed before any conversation exists (no server autosave is possible yet).
// The slot is per browser profile and shared across tabs and device users of
// that profile. It is cleared when the content is adopted into a fresh
// conversation or deliberately cleared, and switching to persisted chats
// keeps it: any later new chat restores it. localStorage keeps the draft
// across browser restarts, so a stale draft can resurface much later, and
// concurrent pre-chat edits in two tabs are last-writer-wins — an adoption in
// one tab clears the slot even if another tab wrote it after this tab
// mounted; that tab's next edit or pagehide re-writes it.
const CANVAS_DRAFT_KEY = "canvas-draft";

// localStorage can throw (private mode, quota, disabled storage); a lost draft is acceptable then.
const tryStorage = (action: () => void) => {
    try {
        action();
    } catch {
        // Continue without draft persistence.
    }
};

export const loadCanvasDraft = (): string | null => {
    try {
        return localStorage.getItem(CANVAS_DRAFT_KEY);
    } catch {
        return null;
    }
};

export const saveCanvasDraft = (markdown: string): void => tryStorage(() => localStorage.setItem(CANVAS_DRAFT_KEY, markdown));

export const clearCanvasDraft = (): void => tryStorage(() => localStorage.removeItem(CANVAS_DRAFT_KEY));
