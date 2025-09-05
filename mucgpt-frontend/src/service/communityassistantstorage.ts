import { StorageService } from "./storage";
import { ChatResponse, CommunityAssistant } from "../api";
import { IndexedDBStorage } from "./indexedDBStorage";

/**
 * Service for storing and retrieving community assistant configurations.
 */
export class CommunityAssistantStorageService {
    // service to handling with the indexeddb
    private storageService: StorageService<ChatResponse, CommunityAssistant>;
    // contains the name of the assistant indexeddb and the corresponding object store
    private config: IndexedDBStorage;
    static CONFIG_ID = "COMMUNITYASSISTANTCONFIG_";

    constructor(config: IndexedDBStorage) {
        this.storageService = new StorageService<ChatResponse, CommunityAssistant>(config);
        this.config = config;
    }

    /****************************
     * Helper methods
     ***************************/

    /**
     * Returns a new instance of StorageService for chat storage.
     * @returns New StorageService instance for ChatResponse and CommunityAssistant.
     */
    getChatStorageService() {
        return new StorageService<ChatResponse, CommunityAssistant>(this.config);
    }

    /**
     * Retrieves all configurations matching the filter predicate.
     * @param filter_predicate Function to check if an ID matches the desired criteria.
     * @returns Array of matching configurations.
     */
    private async _getAllConfigs(filter_predicate: (id: string) => boolean) {
        const results = await this.storageService.getAll();
        if (results)
            return results.filter(config => {
                if (config.id) {
                    return filter_predicate(config.id);
                }
                return false;
            });
        else return [];
    }

    /****************************
     * ID creation
     ***************************/

    /**
     * Generates a unique ID for the community assistant configuration.
     * @param id Base ID
     * @returns Generated configuration ID
     */
    static GENERATE_COMMUNITY_ASSISTANT_CONFIG_ID(id: string) {
        return CommunityAssistantStorageService.CONFIG_ID + id;
    }

    /****************************
     * Assistant configuration
     ***************************/

    /**
     * Creates and stores a new community assistant configuration.
     * @param assistant_config The configuration of the CommunityAssistant
     * @param id The unique ID
     * @returns The used ID
     */
    async createAssistantConfig(assistant_config: CommunityAssistant) {
        const config_with_id = { ...assistant_config, ...{ id: assistant_config.id } };
        await this.storageService.create([], config_with_id, CommunityAssistantStorageService.GENERATE_COMMUNITY_ASSISTANT_CONFIG_ID(assistant_config.id));
        return assistant_config.id;
    }

    /**
     * Retrieves the configuration of a community assistant by ID.
     * @param assistant_id The assistant's ID
     * @returns The configuration or undefined
     */
    async getAssistantConfig(assistant_id: string) {
        return await this.storageService.get(CommunityAssistantStorageService.GENERATE_COMMUNITY_ASSISTANT_CONFIG_ID(assistant_id)).then(assistant_config => {
            if (assistant_config) return assistant_config.config;
            else return undefined;
        });
    }

    /**
     * Updates the configuration of a community assistant.
     * @param assistant_id The assistant's ID
     * @param assistant_config The new configuration
     */
    async setAssistantConfig(assistant_id: string, assistant_config: CommunityAssistant) {
        await this.storageService.update(
            CommunityAssistantStorageService.GENERATE_COMMUNITY_ASSISTANT_CONFIG_ID(assistant_id),
            undefined,
            assistant_config,
            undefined,
            CommunityAssistantStorageService.GENERATE_COMMUNITY_ASSISTANT_CONFIG_ID(assistant_id)
        );
    }

    /**
     * Retrieves all stored community assistant configurations.
     * @returns Array of all configurations
     */
    async getAllAssistantConfigs() {
        const assistants = await this._getAllConfigs((id: string) => id.startsWith(CommunityAssistantStorageService.CONFIG_ID));
        const assistant_configs = assistants.map(config => {
            return config.config;
        });
        return assistant_configs;
    }

    /****************************
     * Delete
     ***************************/

    /**
     * Deletes the configuration of a community assistant by ID.
     * @param assistant_id The assistant's ID
     */
    async deleteConfigForAssistant(assistant_id: string) {
        const results = await this._getAllConfigs((id: string) => id === CommunityAssistantStorageService.GENERATE_COMMUNITY_ASSISTANT_CONFIG_ID(assistant_id));
        for (let i = 0; i < results.length; i++) {
            if (results[i].id) {
                await this.storageService.delete(results[i].id ?? "");
            }
        }
    }
}
