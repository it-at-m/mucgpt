export const generatePromptId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const ensurePromptIds = <T extends { id?: string }>(items: T[] | undefined) =>
    (items || []).map(item => ({ ...item, id: item.id || generatePromptId() }));
