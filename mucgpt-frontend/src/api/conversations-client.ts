import { deleteConfig, getConfig, handleApiRequest, patchConfig, postConfig } from "./fetch-utils";
import { ConversationDetail, ConversationSummary, CreateConversationRequest, DeletedConversation, UpdateConversationRequest } from "./models";

const CONVERSATIONS_BASE = "/api/backend/v1/conversations";

/**
 * List the authenticated user's conversations (most-recently-updated first).
 * User identity is derived server-side from the session, never sent by the client.
 */
export async function listConversations(): Promise<ConversationSummary[]> {
    return handleApiRequest(() => fetch(CONVERSATIONS_BASE, getConfig()), "Failed to list conversations");
}

/**
 * Fetch the tombstone feed: ids the user deleted (on any device), oldest-deleted
 * first. The sync layer applies these by removing the chats locally instead of
 * re-pushing them. Pass the max `deleted_at` already applied as `since` for
 * incremental sync; omit it to fetch the full current tombstone set.
 */
export async function listDeletedConversations(since?: string): Promise<DeletedConversation[]> {
    const url = since ? `${CONVERSATIONS_BASE}/deleted?since=${encodeURIComponent(since)}` : `${CONVERSATIONS_BASE}/deleted`;
    return handleApiRequest(() => fetch(url, getConfig()), "Failed to list deleted conversations");
}

/** Fetch a single conversation including its ordered messages. */
export async function getConversation(id: string): Promise<ConversationDetail> {
    return handleApiRequest(() => fetch(`${CONVERSATIONS_BASE}/${encodeURIComponent(id)}`, getConfig()), "Failed to load conversation");
}

/** Create a conversation, optionally with a client-supplied id and seed messages. */
export async function createConversation(request: CreateConversationRequest): Promise<ConversationDetail> {
    return handleApiRequest(() => fetch(CONVERSATIONS_BASE, postConfig(request)), "Failed to create conversation");
}

/** Update a conversation's title and/or favorite flag. */
export async function patchConversation(id: string, request: UpdateConversationRequest): Promise<ConversationSummary> {
    return handleApiRequest(() => fetch(`${CONVERSATIONS_BASE}/${encodeURIComponent(id)}`, patchConfig(request)), "Failed to update conversation");
}

/**
 * Delete a conversation. Returns 204 (no body) on success, so we check the
 * response directly rather than going through the JSON-parsing helper.
 */
export async function deleteConversation(id: string): Promise<void> {
    const response = await fetch(`${CONVERSATIONS_BASE}/${encodeURIComponent(id)}`, deleteConfig());
    if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete conversation: ${response.status}`);
    }
}
