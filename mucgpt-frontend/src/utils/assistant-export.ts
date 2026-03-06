import { Assistant, AssistantVersionResponse } from "../api/models";

export interface AssistantExportData {
    title: string;
    description: string;
    system_message: string;
    creativity: string;
    default_model?: string;
    examples: AssistantVersionResponse["examples"];
    quick_prompts: AssistantVersionResponse["quick_prompts"];
    tools: AssistantVersionResponse["tools"];
    tags: AssistantVersionResponse["tags"];
    hierarchical_access: AssistantVersionResponse["hierarchical_access"];
    is_visible: boolean;
}

export const sanitizeAssistantFilename = (name: string): string => {
    const sanitized = name.replace(/[/\\:*?"<>|]/g, "_");
    const cleaned = sanitized.trim();
    if (!cleaned || /^_+$/.test(cleaned) || !/[a-zA-Z0-9]/.test(cleaned)) {
        return "assistant";
    }
    return cleaned;
};

export const mapAssistantToExportData = (assistant: Assistant): AssistantExportData => ({
    title: assistant.title,
    description: assistant.description ?? "",
    system_message: assistant.system_message ?? "",
    creativity: assistant.creativity,
    default_model: assistant.default_model,
    examples: assistant.examples ?? [],
    quick_prompts: assistant.quick_prompts ?? [],
    tools: assistant.tools ?? [],
    tags: assistant.tags ?? [],
    hierarchical_access: assistant.hierarchical_access ?? [],
    is_visible: assistant.is_visible
});

export const mapVersionToExportData = (version: AssistantVersionResponse): AssistantExportData => ({
    title: version.name,
    description: version.description ?? "",
    system_message: version.system_prompt ?? "",
    creativity: version.creativity,
    default_model: version.default_model,
    examples: version.examples ?? [],
    quick_prompts: version.quick_prompts ?? [],
    tools: version.tools ?? [],
    tags: version.tags ?? [],
    hierarchical_access: version.hierarchical_access ?? [],
    is_visible: version.is_visible
});

export const downloadAssistantExport = (data: AssistantExportData, filenameBase: string): void => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeAssistantFilename(filenameBase)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
