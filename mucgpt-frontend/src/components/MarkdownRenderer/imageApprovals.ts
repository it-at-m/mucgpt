import { useMemo, useSyncExternalStore } from "react";
import { putApprovedImagesApi } from "../../api/conversations-client";

/**
 * Session store of image decisions, scoped to the active conversation and
 * persisted to the backend (approved and by-URL rejected lists) so decisions
 * follow the chat across browsers. Without a bound conversation (assistant
 * previews, browser-only chats) decisions stay session-only.
 */
interface ApprovalState {
    conversationId: string | null;
    approved: string[];
    rejected: string[];
}

let state: ApprovalState = { conversationId: null, approved: [], rejected: [] };
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const persist = () => {
    if (!state.conversationId) {
        console.warn("Image approval not persisted: this view has no bound conversation (browser-only chat or preview)");
        return;
    }
    putApprovedImagesApi(state.conversationId, [...state.approved], [...state.rejected]).catch((error: unknown) => {
        console.warn("Failed to persist image approvals:", error);
    });
};

/** Reset the store when another conversation is opened; called from loadConversation. */
export const configureImageApprovals = (conversationId: string | null, approvedImages: string[], rejectedImages: string[] = []): void => {
    state = { conversationId, approved: [...approvedImages], rejected: [...rejectedImages] };
    emit();
};

/**
 * Point the store at a conversation the transcript was loaded for before
 * (e.g. a chat created in this session): the decision lists stay, the
 * backend learns to persist them.
 */
export const bindImageApprovals = (conversationId: string): void => {
    if (state.conversationId === conversationId) return;
    state = { ...state, conversationId };
    if (state.approved.length || state.rejected.length) persist();
    emit();
};

let suspended: ApprovalState | null = null;
// The exact blank state suspendImageApprovals installed; resumeImageApprovals
// restores the snapshot only while this is still the current state, so a
// configure that ran while suspended survives the preview unmount.
let suspendedPlaceholder: ApprovalState | null = null;

/**
 * Temporarily empty the store (assistant previews run stateless) and restore
 * the previous conversation's decisions afterwards.
 */
export const suspendImageApprovals = (): void => {
    suspended = state;
    suspendedPlaceholder = { conversationId: null, approved: [], rejected: [] };
    state = suspendedPlaceholder;
    emit();
};

export const resumeImageApprovals = (): void => {
    if (suspended === null) return;
    if (state === suspendedPlaceholder) state = suspended;
    suspended = null;
    suspendedPlaceholder = null;
    emit();
};

/** Non-reactive read for non-component flows (export preparation). */
export const getApprovedImageUrls = (): string[] => state.approved;

export const approveImageUrl = (url: string): void => {
    if (state.approved.includes(url)) return;
    state = { ...state, approved: [...state.approved, url], rejected: state.rejected.filter(rejected => rejected !== url) };
    emit();
    persist();
};

export const rejectImageUrl = (url: string): void => {
    if (state.rejected.includes(url)) return;
    state = { ...state, rejected: [...state.rejected, url] };
    emit();
    persist();
};

export interface ImageApprovals {
    isApproved: (url: string) => boolean;
    isRejected: (url: string) => boolean;
    approve: (url: string) => void;
    reject: (url: string) => void;
}

export const useImageApprovals = (): ImageApprovals => {
    const approved = useSyncExternalStore(
        subscribe,
        () => state.approved,
        () => state.approved
    );
    const rejected = useSyncExternalStore(
        subscribe,
        () => state.rejected,
        () => state.rejected
    );
    return useMemo(
        () => ({
            isApproved: (url: string) => approved.includes(url),
            isRejected: (url: string) => rejected.includes(url),
            approve: approveImageUrl,
            reject: rejectImageUrl
        }),
        [approved, rejected]
    );
};
