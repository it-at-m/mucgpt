import { useSyncExternalStore } from "react";

/**
 * Session store for external-link confirmations: the URL awaiting user
 * confirmation plus URLs the user allowed for this session (non-whitelisted
 * links whose confirmation was once accepted stay clickable). Nothing is
 * persisted; a page reload resets the allowlist.
 */
interface ExternalLinkState {
    pendingUrl: string | null;
    allowedUrls: string[];
}

let state: ExternalLinkState = { pendingUrl: null, allowedUrls: [] };
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const requestExternalLink = (url: string): void => {
    if (state.pendingUrl === url) return;
    state = { ...state, pendingUrl: url };
    emit();
};

export const dismissExternalLink = (): void => {
    if (state.pendingUrl === null) return;
    state = { ...state, pendingUrl: null };
    emit();
};

export const allowForSession = (url: string): void => {
    if (state.allowedUrls.includes(url)) return;
    state = { ...state, allowedUrls: [...state.allowedUrls, url] };
    emit();
};

export const isAllowedForSession = (url: string): boolean => state.allowedUrls.includes(url);

export const useExternalLinkRequest = (): string | null =>
    useSyncExternalStore(
        subscribe,
        () => state.pendingUrl,
        () => state.pendingUrl
    );

/** Opens the confirmed target: mail clients via anchor, web pages in a new tab. */
export const openExternalUrl = (url: string): void => {
    if (url.startsWith("mailto:")) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.click();
        return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
};
