import { Dispatch, SetStateAction, useState, useCallback, useEffect, useMemo } from "react";
import { ToolBase } from "../../../../api";
import { FollowUpActionModel } from "../../../FollowUpAction";
import { StarterPromptModel } from "../../../StarterPrompt";
import { CREATIVITY_LOW } from "../../../../constants";
import { ensurePromptIds } from "../promptIds";
import { STORAGE_KEYS } from "../../../../pages/layout/LayoutHelper";

export type CreateView = "mode_select" | "ai_input" | "settings";

interface CreateAssistantDraft {
    view: CreateView;
    input: string;
    title: string;
    description: string;
    systemPrompt: string;
    selectedTemplate: string;
    tools: ToolBase[];
    followUpActions: FollowUpActionModel[];
    starterPrompts: StarterPromptModel[];
    hierarchicalAccess: string[];
    isVisible: boolean;
    creativity: string;
    defaultModel: string | undefined;
}

const loadDraft = (): CreateAssistantDraft | null => {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEYS.CREATE_ASSISTANT_DRAFT);
        if (!stored) {
            return null;
        }

        const draft = JSON.parse(stored) as CreateAssistantDraft;
        return {
            ...draft,
            followUpActions: Array.isArray(draft.followUpActions) ? draft.followUpActions : [],
            starterPrompts: Array.isArray(draft.starterPrompts) ? draft.starterPrompts : []
        };
    } catch {
        return null;
    }
};

export const useCreateAssistantState = () => {
    const [initialDraft] = useState<CreateAssistantDraft | null>(() => loadDraft());

    // All state variables
    const [view, setView] = useState<CreateView>(() => initialDraft?.view ?? "mode_select");
    const [input, setInput] = useState<string>(() => initialDraft?.input ?? "");
    const [title, setTitle] = useState<string>(() => initialDraft?.title ?? "");
    const [description, setDescription] = useState<string>(() => initialDraft?.description ?? "");
    const [systemPrompt, setSystemPrompt] = useState<string>(() => initialDraft?.systemPrompt ?? "");
    const [selectedTemplate, setSelectedTemplate] = useState<string>(() => initialDraft?.selectedTemplate ?? "");
    const [tools, setTools] = useState<ToolBase[]>(() => initialDraft?.tools ?? []);
    const [followUpActions, setFollowUpActionsState] = useState<FollowUpActionModel[]>(() => ensurePromptIds(initialDraft?.followUpActions));
    const [starterPrompts, setStarterPromptsState] = useState<StarterPromptModel[]>(() => ensurePromptIds(initialDraft?.starterPrompts));
    const [hierarchicalAccess, setHierarchicalAccess] = useState<string[]>(() => initialDraft?.hierarchicalAccess ?? []);
    const [isVisible, setIsVisible] = useState<boolean>(() => initialDraft?.isVisible ?? false);
    const [creativity, setCreativity] = useState<string>(() => initialDraft?.creativity ?? CREATIVITY_LOW);
    const [defaultModel, setDefaultModel] = useState<string | undefined>(() => initialDraft?.defaultModel ?? undefined);

    // Track if user has made any changes
    const hasChanges = useMemo(() => {
        return (
            input !== "" ||
            title !== "" ||
            description !== "" ||
            systemPrompt !== "" ||
            tools.length > 0 ||
            followUpActions.length > 0 ||
            starterPrompts.length > 0 ||
            hierarchicalAccess.length > 0 ||
            isVisible !== false ||
            creativity !== CREATIVITY_LOW ||
            defaultModel !== undefined
        );
    }, [input, title, description, systemPrompt, tools, followUpActions, starterPrompts, hierarchicalAccess, isVisible, creativity, defaultModel]);

    // Persist the in-progress draft so it survives a page refresh, and drop it once the flow is back at its
    // starting point (nothing left worth restoring).
    useEffect(() => {
        try {
            if (hasChanges || view !== "mode_select") {
                const draft: CreateAssistantDraft = {
                    view,
                    input,
                    title,
                    description,
                    systemPrompt,
                    selectedTemplate,
                    tools,
                    followUpActions,
                    starterPrompts,
                    hierarchicalAccess,
                    isVisible,
                    creativity,
                    defaultModel
                };
                sessionStorage.setItem(STORAGE_KEYS.CREATE_ASSISTANT_DRAFT, JSON.stringify(draft));
            } else {
                sessionStorage.removeItem(STORAGE_KEYS.CREATE_ASSISTANT_DRAFT);
            }
        } catch {
            // Ignore sessionStorage errors and continue without draft persistence.
        }
    }, [
        view,
        input,
        title,
        description,
        systemPrompt,
        selectedTemplate,
        tools,
        followUpActions,
        starterPrompts,
        hierarchicalAccess,
        isVisible,
        creativity,
        defaultModel,
        hasChanges
    ]);

    // Change handlers that automatically track changes
    const updateInput = useCallback((newInput: string) => {
        setInput(newInput);
        // Reset template selection when user types manually
        if (newInput !== "") {
            setSelectedTemplate("");
        }
    }, []);

    const updateTitle = useCallback((newTitle: string) => {
        setTitle(newTitle);
    }, []);

    const updateDescription = useCallback((newDescription: string) => {
        setDescription(newDescription);
    }, []);

    const updateSystemPrompt = useCallback((newPrompt: string) => {
        setSystemPrompt(newPrompt);
    }, []);

    const updateCreativity = useCallback((newCreativity: string) => {
        setCreativity(newCreativity);
    }, []);

    const updateDefaultModel = useCallback((newModel: string | undefined) => {
        setDefaultModel(newModel);
    }, []);

    const updateTools = useCallback((newTools: ToolBase[]) => {
        setTools(newTools);
    }, []);

    const updateHierarchicalAccess = useCallback((newHierarchicalAccess: string[]) => {
        setHierarchicalAccess(newHierarchicalAccess);
    }, []);

    const updateIsVisible = useCallback((newIsVisible: boolean) => {
        setIsVisible(newIsVisible);
    }, []);

    const setFollowUpActions = useCallback<Dispatch<SetStateAction<FollowUpActionModel[]>>>(value => {
        setFollowUpActionsState(current => ensurePromptIds(typeof value === "function" ? value(current) : value));
    }, []);

    const setStarterPrompts = useCallback<Dispatch<SetStateAction<StarterPromptModel[]>>>(value => {
        setStarterPromptsState(current => ensurePromptIds(typeof value === "function" ? value(current) : value));
    }, []);

    const updateTemplate = useCallback(
        (template: string, templateId: string) => {
            // Toggle functionality: if already selected, deselect it
            if (selectedTemplate === templateId) {
                setInput("");
                setSelectedTemplate("");
            } else {
                setInput(template);
                setSelectedTemplate(templateId);
            }
        },
        [selectedTemplate]
    );

    const setGeneratedAssistant = useCallback((generatedTitle: string, generatedDescription: string, generatedSystemPrompt: string) => {
        setTitle(generatedTitle);
        setDescription(generatedDescription);
        setSystemPrompt(generatedSystemPrompt);
    }, []);

    // Reset all state, e.g. after the assistant was created or the create flow was discarded
    const resetAll = useCallback(() => {
        setView("mode_select");
        setInput("");
        setTitle("");
        setDescription("");
        setSystemPrompt("");
        setSelectedTemplate("");
        setTools([]);
        setFollowUpActionsState([]);
        setStarterPromptsState([]);
        setHierarchicalAccess([]);
        setIsVisible(false);
        setCreativity(CREATIVITY_LOW);
        setDefaultModel(undefined);
        try {
            sessionStorage.removeItem(STORAGE_KEYS.CREATE_ASSISTANT_DRAFT);
        } catch {
            // Ignore sessionStorage errors.
        }
    }, []);

    return {
        // State
        view,
        input,
        title,
        description,
        systemPrompt,
        selectedTemplate,
        tools,
        followUpActions,
        starterPrompts,
        hierarchicalAccess,
        isVisible,
        creativity,
        defaultModel,
        hasChanges,

        // Setters (direct)
        setView,
        setFollowUpActions,
        setStarterPrompts,

        // Update functions
        updateInput,
        updateTitle,
        updateDescription,
        updateSystemPrompt,
        updateCreativity,
        updateDefaultModel,
        updateTools,
        updateHierarchicalAccess,
        updateIsVisible,
        updateTemplate,
        setGeneratedAssistant,

        // Utility functions
        resetAll
    };
};
