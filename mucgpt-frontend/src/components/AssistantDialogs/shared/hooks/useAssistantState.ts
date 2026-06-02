import { Dispatch, SetStateAction, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Assistant, ToolBase } from "../../../../api";
import { FollowUpActionModel } from "../../../FollowUpAction";
import { StarterPromptModel } from "../../../StarterPrompt";
import { ensurePromptIds } from "../promptIds";

export const useAssistantState = (initialAssistant: Assistant) => {
    const { t } = useTranslation();

    // All state variables
    const [assistantId, setAssistantId] = useState<string | undefined>(initialAssistant.id);
    const [title, setTitle] = useState<string>(initialAssistant.title);
    const [description, setDescription] = useState<string>(initialAssistant.description);
    const [systemPrompt, setSystemPrompt] = useState<string>(initialAssistant.system_message);
    const [followUpActions, setFollowUpActionsState] = useState<FollowUpActionModel[]>(() => ensurePromptIds(initialAssistant.quick_prompts));
    const [starterPrompts, setStarterPromptsState] = useState<StarterPromptModel[]>(() => ensurePromptIds(initialAssistant.examples));
    const [creativity, setCreativity] = useState<string>(initialAssistant.creativity);
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

    // Update state when assistant prop changes
    useEffect(() => {
        const followUpActionsWithIds = ensurePromptIds(initialAssistant.quick_prompts);
        const starterPromptsWithIds = ensurePromptIds(initialAssistant.examples);

        setAssistantId(initialAssistant.id);
        setTitle(initialAssistant.title);
        setDescription(initialAssistant.description);
        setSystemPrompt(initialAssistant.system_message);
        setFollowUpActionsState(followUpActionsWithIds);
        setStarterPromptsState(starterPromptsWithIds);
        setCreativity(initialAssistant.creativity);
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
    }, [initialAssistant]);

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

    const updateCreativity = useCallback((newCreativity: string) => {
        setCreativity(newCreativity);
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

    const setFollowUpActions = useCallback<Dispatch<SetStateAction<FollowUpActionModel[]>>>(value => {
        setFollowUpActionsState(current => ensurePromptIds(typeof value === "function" ? value(current) : value));
    }, []);

    const setStarterPrompts = useCallback<Dispatch<SetStateAction<StarterPromptModel[]>>>(value => {
        setStarterPromptsState(current => ensurePromptIds(typeof value === "function" ? value(current) : value));
    }, []);

    // Reset to original values
    const resetToOriginal = useCallback(() => {
        const followUpActionsWithIds = ensurePromptIds(initialAssistant.quick_prompts);
        const starterPromptsWithIds = ensurePromptIds(initialAssistant.examples);

        setAssistantId(initialAssistant.id);
        setTitle(initialAssistant.title);
        setDescription(initialAssistant.description);
        setSystemPrompt(initialAssistant.system_message);
        setFollowUpActionsState(followUpActionsWithIds);
        setStarterPromptsState(starterPromptsWithIds);
        setCreativity(initialAssistant.creativity);
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
    }, [initialAssistant]);

    // Create assistant object for saving
    const createAssistantForSaving = useCallback((): Assistant => {
        const validFollowUpActions = followUpActions.filter(qp => qp.label && qp.label.trim() !== "" && qp.prompt && qp.prompt.trim() !== "");
        const validStarterPrompts = starterPrompts.filter(ex => ex.text && ex.text.trim() !== "" && ex.value && ex.value.trim() !== "");

        return {
            id: assistantId,
            title: title === "" ? t("components.assistant_editor.default_assistant_title") : title,
            description: description === "" ? t("components.assistant_editor.default_assistant_description") : description,
            system_message: systemPrompt,
            publish: publish,
            owner_ids: ownerIds,
            creativity: creativity,
            default_model: defaultModelCleared ? "" : defaultModel,
            quick_prompts: validFollowUpActions.map(({ id: _omitId, ...rest }) => {
                void _omitId;
                return rest;
            }),
            examples: validStarterPrompts.map(({ id: _omitId, ...rest }) => {
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
        creativity,
        defaultModel,
        defaultModelCleared,
        followUpActions,
        starterPrompts,
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
        followUpActions,
        starterPrompts,
        creativity,
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
        setFollowUpActions,
        setStarterPrompts,
        setTools,
        setHasChanged,

        // Update functions
        updateTitle,
        updateDescription,
        updateSystemPrompt,
        updateCreativity,
        updateDefaultModel,
        updateTools,
        updateIsVisible,
        updateHierarchicalAccess,

        // Utility functions
        resetToOriginal,
        createAssistantForSaving
    };
};
