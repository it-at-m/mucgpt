import type { Model } from "../api/models";

export const getModelDisplayName = (modelId: string, models: Model[]): string => {
    const displayName = models.find(model => model.id === modelId)?.display_name?.trim();
    return displayName || modelId.split("/").pop() || modelId;
};
