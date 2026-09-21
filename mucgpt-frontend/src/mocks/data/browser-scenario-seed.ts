import type { Assistant, CommunityAssistantSnapshot } from "../../api/models";
import { ASSISTANT_STORE, COMMUNITY_ASSISTANT_STORE, CREATIVITY_LOW, CREATIVITY_MEDIUM } from "../../constants";
import { AssistantStorageService } from "../../service/assistantstorage";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { StorageService } from "../../service/storage";
import { COMMUNITY_ASSISTANT_SNAPSHOT_VERSION } from "../../utils/community-assistant-snapshots";
import { resetMockAssistants } from "./assistant-store";

// Unlike handlers.ts, this file seeds browser-side IndexedDB data that MSW cannot provide,
// such as local assistants and snapshots of deleted subscribed assistants.
const SCENARIO_INITIALIZED_STORAGE_KEY = "mucgpt.dev-mocks.scenarios.v3";

export const MOCK_SUBSCRIPTION_SEED = ["foreign-subscribed-active", "foreign-subscribed-pending-review", "foreign-subscribed-deleted"];

export const MOCK_DELETED_SUBSCRIBED_SNAPSHOT: CommunityAssistantSnapshot = {
    snapshot_version: COMMUNITY_ASSISTANT_SNAPSHOT_VERSION,
    id: "foreign-subscribed-deleted",
    version: "3",
    title: "Gelöschter Reiseantrags-Assistent",
    description: "Eine lokal gespeicherte Fassung eines inzwischen gelöschten, zuvor abonnierten Assistenten.",
    system_message: "Du unterstützt beim Vorbereiten von Reiseanträgen und erläuterst die dafür benötigten Angaben.",
    creativity: CREATIVITY_LOW,
    examples: [{ text: "Welche Angaben brauche ich?", value: "Ich zeige dir die üblichen Angaben für einen Reiseantrag." }],
    quick_prompts: [{ label: "Antrag vorbereiten", prompt: "Welche Angaben brauche ich für meinen Reiseantrag?" }],
    tags: [],
    hierarchical_access: ["TEAM-C"],
    tools: [],
    is_visible: true
};

const MOCK_LOCAL_ASSISTANTS: Array<{ id: string; assistant: Assistant }> = [
    {
        id: "local-unpublished-assistant",
        assistant: {
            id: "local-unpublished-assistant",
            title: "Lokaler Formulierungshilfe-Entwurf",
            description: "Ein nur lokal gespeicherter Entwurf, der noch nicht veröffentlicht wurde.",
            system_message: "Hilf beim Formulieren klarer, freundlicher und verständlicher Verwaltungstexte.",
            publish: false,
            creativity: CREATIVITY_MEDIUM,
            version: "1",
            owner_ids: ["user-mock-123"],
            tags: [],
            hierarchical_access: ["TEAM-A"],
            tools: [{ id: "Vereinfachen", config: { enabled: true } }],
            examples: [],
            quick_prompts: [{ label: "Text vereinfachen", prompt: "Vereinfache diesen Text:" }],
            is_visible: false
        }
    }
];

const getStorage = (): Storage | undefined => {
    if (typeof window === "undefined") return undefined;

    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
};

const clearObjectStore = async (config: typeof ASSISTANT_STORE): Promise<void> => {
    const storageService = new StorageService(config);
    const database = await storageService.connectToDB();
    await database.clear(config.objectStore_name);
    database.close();
};

const clearScenarioIndexedDb = async (): Promise<void> => {
    await Promise.all([clearObjectStore(ASSISTANT_STORE), clearObjectStore(COMMUNITY_ASSISTANT_STORE)]);
};

/** Seeds local-only and deleted-assistant scenarios once, without overwriting active mock work. */
export const initializeMockScenarios = async (): Promise<void> => {
    const storage = getStorage();
    if (storage?.getItem(SCENARIO_INITIALIZED_STORAGE_KEY)) return;

    try {
        await clearScenarioIndexedDb();

        const assistantStorageService = new AssistantStorageService(ASSISTANT_STORE);
        const communityAssistantStorageService = new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE);

        await Promise.all([
            ...MOCK_LOCAL_ASSISTANTS.map(({ assistant, id }) => assistantStorageService.createAssistantConfig(assistant, id)),
            communityAssistantStorageService.createAssistantConfig(MOCK_DELETED_SUBSCRIBED_SNAPSHOT)
        ]);

        storage?.setItem(SCENARIO_INITIALIZED_STORAGE_KEY, "true");
    } catch (error) {
        console.warn("Could not initialize dev mock scenarios:", error);
    }
};

/** Clears all browser-side mock data so the next load receives a pristine scenario catalog. */
export const resetMockScenarios = async (): Promise<void> => {
    resetMockAssistants();
    getStorage()?.removeItem(SCENARIO_INITIALIZED_STORAGE_KEY);

    try {
        await clearScenarioIndexedDb();
    } catch (error) {
        console.warn("Could not reset dev mock scenarios:", error);
    }
};
