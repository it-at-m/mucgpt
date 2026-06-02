import { Dispatch, SetStateAction, useState, useCallback, useMemo, useContext, useEffect } from "react";
import { ToolBase } from "../../../../api";
import { FollowUpActionModel } from "../../../FollowUpAction";
import { StarterPromptModel } from "../../../StarterPrompt";
import { LLMContext } from "../../../LLMSelector/LLMContextProvider";
import { CREATIVITY_LOW } from "../../../../constants";
import { ensurePromptIds } from "../promptIds";

export const useCreateAssistantState = () => {
    // Context
    const { LLM } = useContext(LLMContext);

    // All state variables
    const [input, setInput] = useState<string>("");
    const [title, setTitle] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [systemPrompt, setSystemPrompt] = useState<string>("");
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");
    const [tools, setTools] = useState<ToolBase[]>([]);
    const [followUpActions, setFollowUpActionsState] = useState<FollowUpActionModel[]>([]);
    const [starterPrompts, setStarterPromptsState] = useState<StarterPromptModel[]>([]);
    const [hierarchicalAccess, setHierarchicalAccess] = useState<string[]>([]);
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const [creativity, setCreativity] = useState<string>(CREATIVITY_LOW);
    const [defaultModel, setDefaultModel] = useState<string | undefined>(LLM.llm_name);

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
            (defaultModel !== undefined && defaultModel !== LLM.llm_name)
        );
    }, [
        input,
        title,
        description,
        systemPrompt,
        tools,
        followUpActions,
        starterPrompts,
        hierarchicalAccess,
        isVisible,
        creativity,
        defaultModel,
        LLM.llm_name
    ]);

    useEffect(() => {
        setDefaultModel(LLM.llm_name);
    }, [LLM.llm_name]);

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

    // Reset all state
    const resetAll = useCallback(() => {
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
        setDefaultModel(LLM.llm_name);
    }, [LLM.llm_name]);

    return {
        // State
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
