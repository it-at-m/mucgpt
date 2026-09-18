import type { AssistantCreateResponse } from "../../api/models";

const ASSISTANTS_STORAGE_KEY = "mucgpt.dev-mocks.assistants.v9";
const SUBSCRIPTIONS_STORAGE_KEY = "mucgpt.dev-mocks.subscriptions.v4";

const clone = (assistants: AssistantCreateResponse[]): AssistantCreateResponse[] => JSON.parse(JSON.stringify(assistants)) as AssistantCreateResponse[];

const isAssistantList = (value: unknown): value is AssistantCreateResponse[] =>
    Array.isArray(value) &&
    value.every(
        assistant =>
            typeof assistant === "object" &&
            assistant !== null &&
            typeof (assistant as AssistantCreateResponse).id === "string" &&
            typeof (assistant as AssistantCreateResponse).latest_version?.id === "string"
    );

const getStorage = (): Storage | undefined => {
    if (typeof window === "undefined") return undefined;

    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
};

/** Loads the persisted mock database, falling back to the immutable demo seed. */
export const loadMockAssistants = (seed: AssistantCreateResponse[]): AssistantCreateResponse[] => {
    const storage = getStorage();
    if (!storage) return clone(seed);

    try {
        const stored = storage.getItem(ASSISTANTS_STORAGE_KEY);
        if (!stored) return clone(seed);

        const assistants: unknown = JSON.parse(stored);
        if (isAssistantList(assistants)) return assistants;

        storage.removeItem(ASSISTANTS_STORAGE_KEY);
    } catch {
        // A broken or inaccessible local store must never prevent the dev app from starting.
    }

    return clone(seed);
};

/** Persists the complete mock database after a create, update, or delete request. */
export const saveMockAssistants = (assistants: AssistantCreateResponse[]): void => {
    const storage = getStorage();
    if (!storage) return;

    try {
        storage.setItem(ASSISTANTS_STORAGE_KEY, JSON.stringify(assistants));
    } catch {
        // Keep the current tab usable when storage is unavailable or full.
    }
};

/** Removes only the dev assistant database. The next page load restores the demo seed. */
export const loadMockSubscriptions = (seed: string[]): string[] => {
    const storage = getStorage();
    if (!storage) return [...seed];

    try {
        const stored = storage.getItem(SUBSCRIPTIONS_STORAGE_KEY);
        if (!stored) return [...seed];

        const subscriptions: unknown = JSON.parse(stored);
        if (Array.isArray(subscriptions) && subscriptions.every(subscription => typeof subscription === "string")) return subscriptions;

        storage.removeItem(SUBSCRIPTIONS_STORAGE_KEY);
    } catch {
        // Fall back to the scenario defaults if a stored subscription list is invalid.
    }

    return [...seed];
};

export const saveMockSubscriptions = (subscriptions: Iterable<string>): void => {
    const storage = getStorage();
    if (!storage) return;

    try {
        storage.setItem(SUBSCRIPTIONS_STORAGE_KEY, JSON.stringify([...subscriptions]));
    } catch {
        // Keep the current tab usable when storage is unavailable or full.
    }
};

/** Removes all persisted mock-server state. The next page load restores the scenario seed. */
export const resetMockAssistants = (): void => {
    const storage = getStorage();
    if (!storage) return;

    try {
        storage.removeItem(ASSISTANTS_STORAGE_KEY);
        storage.removeItem(SUBSCRIPTIONS_STORAGE_KEY);
    } catch {
        // Keep the reset control safe in privacy-restricted browser contexts.
    }
};
