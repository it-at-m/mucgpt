// Small sessionStorage helpers shared by the assistant create and edit draft persistence hooks.

export function loadSessionDraft<T>(key: string): T | null {
    try {
        const stored = sessionStorage.getItem(key);
        return stored ? (JSON.parse(stored) as T) : null;
    } catch {
        return null;
    }
}

export function saveSessionDraft(key: string, value: unknown): void {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Ignore sessionStorage errors and continue without draft persistence.
    }
}

export function clearSessionDraft(key: string): void {
    try {
        sessionStorage.removeItem(key);
    } catch {
        // Ignore sessionStorage errors.
    }
}
