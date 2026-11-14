import { useCallback, useEffect, useRef } from "react";

interface Options {
    /** Drafts are kept per input; without a key nothing is persisted. */
    draftCacheKey?: string;
    question: string;
    setQuestion: (question: string) => void;
    /** Discards a stored draft instead of restoring it, e.g. when the question comes from the URL. */
    skipDraftRestore: boolean;
}

// sessionStorage can throw (private mode, quota, disabled storage); a lost draft is acceptable then.
const tryStorage = (action: () => void) => {
    try {
        action();
    } catch {
        // Continue without draft persistence.
    }
};

/** Persists the unsent question in sessionStorage so it survives a reload but not leaving the route. */
export const useQuestionDraft = ({ draftCacheKey, question, setQuestion, skipDraftRestore }: Options) => {
    const storageKey = draftCacheKey ? `question-input-draft:${draftCacheKey}` : undefined;
    const isRestoredRef = useRef(false);
    const isPageUnloadingRef = useRef(false);
    const setQuestionRef = useRef(setQuestion);

    useEffect(() => {
        setQuestionRef.current = setQuestion;
    }, [setQuestion]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            isPageUnloadingRef.current = true;
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    // Leaving the route drops the draft; a reload keeps it.
    useEffect(() => {
        return () => {
            if (storageKey && !isPageUnloadingRef.current) tryStorage(() => sessionStorage.removeItem(storageKey));
        };
    }, [storageKey]);

    // Only runs when the key changes: restoring must not overwrite what the user types afterwards.
    useEffect(() => {
        isRestoredRef.current = false;
        if (storageKey && question.trim().length === 0) {
            if (skipDraftRestore) {
                tryStorage(() => sessionStorage.removeItem(storageKey));
            } else {
                tryStorage(() => {
                    const draft = sessionStorage.getItem(storageKey);
                    if (draft) setQuestionRef.current(draft);
                });
            }
        }
        isRestoredRef.current = true;
    }, [storageKey, skipDraftRestore]);

    useEffect(() => {
        if (!storageKey || skipDraftRestore || !isRestoredRef.current) return;
        tryStorage(() => {
            if (question.trim().length > 0) {
                sessionStorage.setItem(storageKey, question);
            } else {
                sessionStorage.removeItem(storageKey);
            }
        });
    }, [storageKey, question, skipDraftRestore]);

    const clearDraft = useCallback(() => {
        if (storageKey) tryStorage(() => sessionStorage.removeItem(storageKey));
    }, [storageKey]);

    return { clearDraft };
};
