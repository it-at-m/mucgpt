import { Dispatch, SetStateAction, useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Assistant, ToolBase } from "../../../../api";
import { FollowUpActionModel } from "../../../FollowUpAction";
import { StarterPromptModel } from "../../../StarterPrompt";
import { ensurePromptIds } from "../promptIds";
import { STORAGE_KEYS } from "../../../../pages/layout/LayoutHelper";
import { clearSessionDraft, loadSessionDraft, saveSessionDraft } from "../sessionStorageDraft";

interface EditAssistantDraft {
    version: string;
    title: string;
    description: string;
    systemPrompt: string;
    creativity: string;
    defaultModel: string | undefined;
    defaultModelCleared: boolean;
    tools: ToolBase[];
    hierarchicalAccess: string[];
    isVisible: boolean;
    followUpActions: FollowUpActionModel[];
    starterPrompts: StarterPromptModel[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isEditAssistantDraft = (draft: unknown): draft is EditAssistantDraft => {
    if (!isRecord(draft)) return false;

    return (
        typeof draft.version === "string" &&
        typeof draft.title === "string" &&
        typeof draft.description === "string" &&
        typeof draft.systemPrompt === "string" &&
        typeof draft.creativity === "string" &&
        (draft.defaultModel === undefined || typeof draft.defaultModel === "string") &&
        typeof draft.defaultModelCleared === "boolean" &&
        typeof draft.isVisible === "boolean" &&
        Array.isArray(draft.tools) &&
        draft.tools.every(tool => isRecord(tool) && typeof tool.id === "string" && (tool.config === undefined || isRecord(tool.config))) &&
        Array.isArray(draft.hierarchicalAccess) &&
        draft.hierarchicalAccess.every(access => typeof access === "string") &&
        Array.isArray(draft.followUpActions) &&
        draft.followUpActions.every(
            action =>
                isRecord(action) &&
                typeof action.label === "string" &&
                typeof action.prompt === "string" &&
                (action.id === undefined || typeof action.id === "string")
        ) &&
        Array.isArray(draft.starterPrompts) &&
        draft.starterPrompts.every(
            prompt =>
                isRecord(prompt) &&
                typeof prompt.text === "string" &&
                typeof prompt.value === "string" &&
                (prompt.id === undefined || typeof prompt.id === "string") &&
                (prompt.system === undefined || typeof prompt.system === "string")
        )
    );
};

const getDraftKey = (assistantId: string | undefined): string | null => (assistantId ? `${STORAGE_KEYS.EDIT_ASSISTANT_DRAFT}_${assistantId}` : null);

export const useAssistantState = (initialAssistant: Assistant) => {
    const { t } = useTranslation();

    const draftKey = getDraftKey(initialAssistant.id);
    const [initialDraft] = useState<EditAssistantDraft | null>(() => {
        if (!draftKey) return null;
        const draft = loadSessionDraft<unknown>(draftKey);
        return isEditAssistantDraft(draft) && draft.version === (initialAssistant.version || "0") ? draft : null;
    });

    // All state variables
    const [assistantId, setAssistantId] = useState<string | undefined>(initialAssistant.id);
    const [title, setTitle] = useState<string>(() => initialDraft?.title ?? initialAssistant.title);
    const [description, setDescription] = useState<string>(() => initialDraft?.description ?? initialAssistant.description);
    const [systemPrompt, setSystemPrompt] = useState<string>(() => initialDraft?.systemPrompt ?? initialAssistant.system_message);
    const [followUpActions, setFollowUpActionsState] = useState<FollowUpActionModel[]>(() =>
        ensurePromptIds(initialDraft?.followUpActions ?? initialAssistant.quick_prompts)
    );
    const [starterPrompts, setStarterPromptsState] = useState<StarterPromptModel[]>(() =>
        ensurePromptIds(initialDraft?.starterPrompts ?? initialAssistant.examples)
    );
    const [creativity, setCreativity] = useState<string>(() => initialDraft?.creativity ?? initialAssistant.creativity);
    const [defaultModel, setDefaultModel] = useState<string | undefined>(() => initialDraft?.defaultModel ?? initialAssistant.default_model);
    const [defaultModelCleared, setDefaultModelCleared] = useState<boolean>(() => initialDraft?.defaultModelCleared ?? false);
    const [version, setVersion] = useState<string>(initialAssistant.version || "0");
    const [tools, setTools] = useState<ToolBase[]>(() => initialDraft?.tools ?? initialAssistant.tools ?? []);
    const [publish, setPublish] = useState<boolean>(initialAssistant.publish || false);
    const [ownerIds, setOwnerIds] = useState<string[]>(initialAssistant.owner_ids || []);
    const [hierarchicalAccess, setHierarchicalAccess] = useState<string[]>(
        () => initialDraft?.hierarchicalAccess ?? initialAssistant.hierarchical_access ?? []
    );
    const [tags, setTags] = useState<string[]>(initialAssistant.tags || []);
    const [hasChanged, setHasChanged] = useState<boolean>(() => initialDraft !== null);
    const [isVisible, setIsVisible] = useState<boolean>(
        () => initialDraft?.isVisible ?? (initialAssistant.is_visible !== undefined ? initialAssistant.is_visible : true)
    );
    const previousAssistantRef = useRef(initialAssistant);

    // Update state when assistant prop changes
    useEffect(() => {
        if (previousAssistantRef.current === initialAssistant) {
            return;
        }
        previousAssistantRef.current = initialAssistant;

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

    useEffect(() => {
        if (!draftKey) return;

        if (!hasChanged) {
            clearSessionDraft(draftKey);
            return;
        }

        const draft: EditAssistantDraft = {
            version,
            title,
            description,
            systemPrompt,
            creativity,
            defaultModel,
            defaultModelCleared,
            tools,
            hierarchicalAccess,
            isVisible,
            followUpActions,
            starterPrompts
        };
        saveSessionDraft(draftKey, draft);
    }, [
        draftKey,
        hasChanged,
        version,
        title,
        description,
        systemPrompt,
        creativity,
        defaultModel,
        defaultModelCleared,
        tools,
        hierarchicalAccess,
        isVisible,
        followUpActions,
        starterPrompts
    ]);

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

    const clearDraft = useCallback(() => {
        if (draftKey) clearSessionDraft(draftKey);
    }, [draftKey]);

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
        if (draftKey) clearSessionDraft(draftKey);
    }, [initialAssistant, draftKey]);

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
        clearDraft,
        createAssistantForSaving
    };
};
