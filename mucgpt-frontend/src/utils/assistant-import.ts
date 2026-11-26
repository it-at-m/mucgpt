import type { ToolBase } from "../api/models";
import type { FollowUpActionModel } from "../components/FollowUpAction";
import type { StarterPromptModel } from "../components/StarterPrompt";
import { CREATIVITY_HIGH, CREATIVITY_LOW, CREATIVITY_MEDIUM } from "../constants";

export type AssistantImportErrorCode = "unsupported_filename" | "malformed_json" | "invalid_structure";

export class AssistantImportError extends Error {
    constructor(public readonly code: AssistantImportErrorCode) {
        super(code);
        this.name = "AssistantImportError";
    }
}

export type AssistantImportData = {
    title: string;
    description: string;
    systemMessage: string;
    creativity: string;
    defaultModel: string | undefined;
    tools: ToolBase[];
    followUpActions: FollowUpActionModel[];
    starterPrompts: StarterPromptModel[];
    hierarchicalAccess: string[];
    isVisible: boolean;
};

const supportedCreativityLevels = new Set([CREATIVITY_LOW, CREATIVITY_MEDIUM, CREATIVITY_HIGH]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isTool = (value: unknown): value is ToolBase =>
    isRecord(value) && typeof value.id === "string" && value.id.trim() !== "" && (value.config === undefined || isRecord(value.config));

const isFollowUpAction = (value: unknown): value is FollowUpActionModel =>
    isRecord(value) && typeof value.label === "string" && typeof value.prompt === "string" && (value.id === undefined || typeof value.id === "string");

const isStarterPrompt = (value: unknown): value is StarterPromptModel =>
    isRecord(value) &&
    typeof value.text === "string" &&
    typeof value.value === "string" &&
    (value.id === undefined || typeof value.id === "string") &&
    (value.system === undefined || typeof value.system === "string");

const optionalArray = <T>(data: Record<string, unknown>, key: string, itemValidator: (item: unknown) => item is T): T[] | null => {
    const value = data[key];
    if (value === undefined) return [];
    return Array.isArray(value) && value.every(itemValidator) ? value : null;
};

export const hasValidAssistantImportFilename = (filename: string): boolean => /^[^.]+\.json$/i.test(filename);

export const parseAssistantImport = (filename: string, content: string): AssistantImportData => {
    if (!hasValidAssistantImportFilename(filename)) {
        throw new AssistantImportError("unsupported_filename");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new AssistantImportError("malformed_json");
    }

    if (!isRecord(parsed)) {
        throw new AssistantImportError("invalid_structure");
    }

    const tools = optionalArray(parsed, "tools", isTool);
    const followUpActions = optionalArray(parsed, "quick_prompts", isFollowUpAction);
    const starterPrompts = optionalArray(parsed, "examples", isStarterPrompt);
    const hierarchicalAccess = optionalArray(parsed, "hierarchical_access", (value): value is string => typeof value === "string");
    // TODO: Tags are currently not configurable in the UI. Preserve them when tag management is added.
    const tags = optionalArray(parsed, "tags", (value): value is string => typeof value === "string");

    if (
        typeof parsed.title !== "string" ||
        parsed.title.trim() === "" ||
        typeof parsed.system_message !== "string" ||
        parsed.system_message.trim() === "" ||
        (parsed.description !== undefined && typeof parsed.description !== "string") ||
        (parsed.creativity !== undefined && (typeof parsed.creativity !== "string" || !supportedCreativityLevels.has(parsed.creativity))) ||
        (parsed.default_model !== undefined && parsed.default_model !== null && typeof parsed.default_model !== "string") ||
        (parsed.is_visible !== undefined && typeof parsed.is_visible !== "boolean") ||
        tools === null ||
        followUpActions === null ||
        starterPrompts === null ||
        hierarchicalAccess === null ||
        tags === null
    ) {
        throw new AssistantImportError("invalid_structure");
    }

    return {
        title: parsed.title,
        description: parsed.description ?? "",
        systemMessage: parsed.system_message,
        creativity: parsed.creativity ?? CREATIVITY_LOW,
        defaultModel: parsed.default_model ?? undefined,
        tools,
        followUpActions,
        starterPrompts,
        hierarchicalAccess,
        isVisible: parsed.is_visible ?? false
    };
};
