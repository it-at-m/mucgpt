import { BotStorageService } from "../../service/botstorage";
import { AssistantUpdateInput, Bot, Model } from "../../api/models";
import { BOT_STORE } from "../../constants";
import { countTokensAPI } from "../../api/core-client";
import { deleteCommunityAssistantApi, getCommunityAssistantApi, unsubscribeFromAssistantApi, updateCommunityAssistantApi } from "../../api/assistant-client";

export interface BotStrategy {
    loadBotConfig(botId: string, botStorageService: BotStorageService): Promise<Bot | undefined>;
    deleteBot(botId: string, botStorageService: BotStorageService): Promise<void>;
    updateBot?(botId: string, newBot: Bot, botConfig: Bot, LLM: Model): Promise<{ updatedBot?: Bot; systemPromptTokens?: number }>;
    isOwned: boolean;
    canEdit: boolean;
}

export class LocalBotStrategy implements BotStrategy {
    isOwned = false;
    canEdit = true;

    async loadBotConfig(botId: string, botStorageService: BotStorageService): Promise<Bot | undefined> {
        return await botStorageService.getBotConfig(botId);
    }

    async deleteBot(botId: string, botStorageService: BotStorageService): Promise<void> {
        await botStorageService.deleteConfigAndChatsForBot(botId);
    }

    async updateBot(botId: string, newBot: Bot, botConfig: Bot, LLM: Model): Promise<{ updatedBot?: Bot; systemPromptTokens?: number }> {
        const botStorageService = new BotStorageService(BOT_STORE); // TODO: Pass this properly
        await botStorageService.setBotConfig(botId, newBot);

        let systemPromptTokens: number | undefined;
        if (newBot.system_message !== botConfig.system_message) {
            const response = await countTokensAPI({ text: newBot.system_message, model: LLM });
            systemPromptTokens = response.count;
        }

        return { updatedBot: newBot, systemPromptTokens };
    }
}

export class CommunityBotStrategy implements BotStrategy {
    isOwned = false;
    canEdit = false;

    async loadBotConfig(botId: string): Promise<Bot | undefined> {
        const response = await getCommunityAssistantApi(botId);
        const latest = response.latest_version;
        return {
            id: botId,
            title: latest.name,
            description: latest.description || "",
            system_message: latest.system_prompt,
            publish: true,
            temperature: latest.temperature || 0.7,
            max_output_tokens: latest.max_output_tokens,
            version: latest.version.toString(),
            examples: latest.examples || [],
            quick_prompts: latest.quick_prompts || [],
            tags: latest.tags || [],
            owner_ids: latest.owner_ids || [],
            tools: latest.tools || [],
            hierarchical_access: latest.hierarchical_access || []
        };
    }

    async deleteBot(botId: string): Promise<void> {
        await unsubscribeFromAssistantApi(botId);
    }
}

export class OwnedCommunityBotStrategy implements BotStrategy {
    isOwned = true;
    canEdit = true;

    async loadBotConfig(botId: string): Promise<Bot | undefined> {
        const response = await getCommunityAssistantApi(botId);
        const latest = response.latest_version;
        return {
            id: botId,
            title: latest.name,
            description: latest.description || "",
            system_message: latest.system_prompt,
            publish: true,
            temperature: latest.temperature || 0.7,
            max_output_tokens: latest.max_output_tokens,
            version: latest.version.toString(),
            examples: latest.examples,
            quick_prompts: latest.quick_prompts,
            tags: latest.tags,
            owner_ids: latest.owner_ids,
            hierarchical_access: latest.hierarchical_access || [],
            tools: latest.tools || []
        };
    }

    async deleteBot(botId: string): Promise<void> {
        await deleteCommunityAssistantApi(botId);
    }

    async updateBot(botId: string, newBot: Bot, botConfig: Bot, LLM: Model): Promise<{ systemPromptTokens?: number }> {
        const updateInput: AssistantUpdateInput = {
            name: newBot.title,
            description: newBot.description,
            system_prompt: newBot.system_message,
            hierarchical_access: newBot.hierarchical_access,
            temperature: newBot.temperature,
            max_output_tokens: newBot.max_output_tokens,
            tools: newBot.tools || [],
            owner_ids: newBot.owner_ids,
            examples: newBot.examples?.map(e => ({ text: e.text, value: e.value })) || [],
            quick_prompts: newBot.quick_prompts || [],
            tags: newBot.tags || [],
            version: Number(newBot.version)
        };

        await updateCommunityAssistantApi(botId, updateInput);

        let systemPromptTokens: number | undefined;
        if (newBot.system_message !== botConfig.system_message) {
            const response = await countTokensAPI({ text: newBot.system_message, model: LLM });
            systemPromptTokens = response.count;
        }

        return { systemPromptTokens };
    }
}
