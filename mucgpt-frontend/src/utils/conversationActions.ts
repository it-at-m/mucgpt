/** Replacement actions require stateless requests until the backend supports replace/resume. */
export function getConversationActionCapabilities(persist: boolean = true) {
    return { canRegenerate: !persist, canRetry: !persist };
}
