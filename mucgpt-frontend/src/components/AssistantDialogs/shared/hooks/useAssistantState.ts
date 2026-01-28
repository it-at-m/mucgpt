import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Assistant, ToolBase } from "../../../../api";
import { QuickPrompt } from "../../../QuickPrompt/QuickPrompt";
import { ExampleModel } from "../../../Example";

export const useAssistantState = (initialAssistant: Assistant) => {
    const { t } = useTranslation();

    // All state variables
    const [assistantId, setAssistantId] = useState<string | undefined>(initialAssistant.id);
    const [title, setTitle] = useState<string>(initialAssistant.title);
    const [description, setDescription] = useState<string>(initialAssistant.description);
    const [systemPrompt, setSystemPrompt] = useState<string>(initialAssistant.system_message);
    const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>(initialAssistant.quick_prompts || []);
    const [examples, setExamples] = useState<ExampleModel[]>(initialAssistant.examples || []);
    const [temperature, setTemperature] = useState<number>(initialAssistant.temperature);
    const [defaultModel, setDefaultModel] = useState<string | undefined>(initialAssistant.default_model);
    const [defaultModelCleared, setDefaultModelCleared] = useState<boolean>(false);
    const [version, setVersion] = useState<string>(initialAssistant.version || "0");
    const [tools, setTools] = useState<ToolBase[]>(initialAssistant.tools || []);
    const [publish, setPublish] = useState<boolean>(initialAssistant.publish || false);
    const [ownerIds, setOwnerIds] = useState<string[]>(initialAssistant.owner_ids || []);
    const [hierarchicalAccess, setHierarchicalAccess] = useState<string[]>(initialAssistant.hierarchical_access || []);
    const [tags, setTags] = useState<string[]>(initialAssistant.tags || []);
    const [hasChanged, setHasChanged] = useState<boolean>(false);
    const [isVisible, setIsVisible] = useState<boolean>(initialAssistant.is_visible !== undefined ? initialAssistant.is_visible : true);

    const ensureIds = useCallback(
        <T extends { id?: string }>(items: T[] | undefined) => (items || []).map(it => ({ ...it, id: it.id || crypto.randomUUID() })),
        []
    );

    // Update state when assistant prop changes
    useEffect(() => {
        const quickPromptsWithIds = ensureIds(initialAssistant.quick_prompts);
        const examplesWithIds = ensureIds(initialAssistant.examples);

        setAssistantId(initialAssistant.id);
        setTitle(initialAssistant.title);
        setDescription(initialAssistant.description);
        setSystemPrompt(initialAssistant.system_message);
        setQuickPrompts(quickPromptsWithIds);
        setExamples(examplesWithIds);
        setTemperature(initialAssistant.temperature);
        setDefaultModel(initialAssistant.default_model);
        setVersion(initialAssistant.version || "0");
        setTools(initialAssistant.tools || []);
        setPublish(initialAssistant.publish || false);
        setOwnerIds(initialAssistant.owner_ids || []);
        setHierarchicalAccess(initialAssistant.hierarchical_access || []);
        setTags(initialAssistant.tags || []);
        setHasChanged(false);
        setIsVisible(initialAssistant.is_visible !== undefined ? initialAssistant.is_visible : true);
        setDefaultModelCleared(false);
    }, [initialAssistant, ensureIds]);

    // Change handlers
    const updateTitle = useCallback((newTitle: string) => {
        setTitle(newTitle);
        setHasChanged(true);
    }, []);

    const updateDescription = useCallback((newDescription: string) => {
        setDescription(newDescription);
        setHasChanged(true);
    }, []);

    const updateSystemPrompt = useCallback((newPrompt: string) => {
        setSystemPrompt(newPrompt);
        setHasChanged(true);
    }, []);

    const updateTemperature = useCallback((newTemp: number) => {
        setTemperature(newTemp);
        setHasChanged(true);
    }, []);
    const updateDefaultModel = useCallback((model: string | undefined) => {
        setDefaultModel(model);
        setDefaultModelCleared(model === undefined);
        setHasChanged(true);
    }, []);

    const updateTools = useCallback((newTools: ToolBase[]) => {
        setTools(newTools);
        setHasChanged(true);
    }, []);

    const updateIsVisible = useCallback((visible: boolean) => {
        setIsVisible(visible);
        setHasChanged(true);
    }, []);

    const updateHierarchicalAccess = useCallback((access: string[]) => {
        setHierarchicalAccess(access);
        setHasChanged(true);
    }, []);

    const updateOwnerIds = useCallback((owners: string[]) => {
        setOwnerIds(owners);
        setHasChanged(true);
    }, []);

    // Reset to original values
    const resetToOriginal = useCallback(() => {
        const quickPromptsWithIds = ensureIds(initialAssistant.quick_prompts);
        const examplesWithIds = ensureIds(initialAssistant.examples);

        setAssistantId(initialAssistant.id);
        setTitle(initialAssistant.title);
        setDescription(initialAssistant.description);
        setSystemPrompt(initialAssistant.system_message);
        setQuickPrompts(quickPromptsWithIds);
        setExamples(examplesWithIds);
        setTemperature(initialAssistant.temperature);
        setDefaultModel(initialAssistant.default_model);
        setVersion(initialAssistant.version);
        setTools(initialAssistant.tools || []);
        setPublish(initialAssistant.publish || false);
        setOwnerIds(initialAssistant.owner_ids || []);
        setHierarchicalAccess(initialAssistant.hierarchical_access || []);
        setTags(initialAssistant.tags || []);
        setHasChanged(false);
        setIsVisible(initialAssistant.is_visible !== undefined ? initialAssistant.is_visible : true);
        setDefaultModelCleared(false);
    }, [initialAssistant, ensureIds]);

    // Create assistant object for saving
    const createAssistantForSaving = useCallback((): Assistant => {
        const validQuickPrompts = quickPrompts.filter(qp => qp.label && qp.label.trim() !== "" && qp.prompt && qp.prompt.trim() !== "");
        const validExamples = examples.filter(ex => ex.text && ex.text.trim() !== "" && ex.value && ex.value.trim() !== "");

        return {
            id: assistantId,
            title: title === "" ? t("components.edit_assistant_dialog.default_assistant_title") : title,
            description: description === "" ? t("components.edit_assistant_dialog.default_assistant_description") : description,
            system_message: systemPrompt,
            publish: publish,
            owner_ids: ownerIds,
            temperature: temperature,
            default_model: defaultModelCleared ? "" : defaultModel,
            quick_prompts: validQuickPrompts.map(({ id: _omitId, ...rest }) => {
                void _omitId;
                return rest;
            }),
            examples: validExamples.map(({ id: _omitId, ...rest }) => {
                void _omitId;
                return rest;
            }),
            version: version,
            tools: tools,
            hierarchical_access: hierarchicalAccess,
            tags: tags,
            is_visible: isVisible
        };
    }, [
        assistantId,
        title,
        description,
        systemPrompt,
        ownerIds,
        temperature,
        defaultModel,
        defaultModelCleared,
        quickPrompts,
        examples,
        version,
        tools,
        hierarchicalAccess,
        tags,
        isVisible,
        t
    ]);

    return {
        // State
        assistantId,
        title,
        description,
        systemPrompt,
        quickPrompts,
        examples,
        temperature,
        defaultModel,
        version,
        tools,
        publish,
        ownerIds,
        hierarchicalAccess,
        tags,
        hasChanged,
        isVisible,

        // Setters
        setQuickPrompts,
        setExamples,
        setTools,
        setHasChanged,

        // Update functions
        updateTitle,
        updateDescription,
        updateSystemPrompt,
        updateTemperature,
        updateDefaultModel,
        updateTools,
        updateIsVisible,
        updateHierarchicalAccess,
        updateOwnerIds,

        // Utility functions
        resetToOriginal,
        createAssistantForSaving
    };
};
