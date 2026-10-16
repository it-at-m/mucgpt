import type { Model } from "../api/models";

export const getModelDisplayName = (llmName: string, models: Model[]): string => {
    const displayName = models.find(model => model.llm_name === llmName)?.display_name?.trim();
    return displayName || llmName.split("/").pop() || llmName;
};
