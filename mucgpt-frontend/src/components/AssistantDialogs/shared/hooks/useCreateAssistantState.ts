import { useState, useCallback, useMemo, useContext, useEffect } from "react";
import { ToolBase } from "../../../../api";
import { QuickPrompt } from "../../../QuickPrompt/QuickPrompt";
import { ExampleModel } from "../../../Example";
import { LLMContext } from "../../../LLMSelector/LLMContextProvider";
import { DEFAULT_MAX_OUTPUT_TOKENS } from "../../../../constants";

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
    const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([]);
    const [examples, setExamples] = useState<ExampleModel[]>([]);
    const [temperature, setTemperature] = useState<number>(0.6);
    const [defaultModel, setDefaultModel] = useState<string | undefined>(LLM.llm_name);

    // Track if user has made any changes
    const hasChanges = useMemo(() => {
        return (
            input !== "" ||
            title !== "" ||
            description !== "" ||
            systemPrompt !== "" ||
            tools.length > 0 ||
            quickPrompts.length > 0 ||
            examples.length > 0 ||
            temperature !== 0.6 ||
            (defaultModel !== undefined && defaultModel !== LLM.llm_name)
        );
    }, [input, title, description, systemPrompt, tools, quickPrompts, examples, temperature, defaultModel]);

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

    const updateTemperature = useCallback((newTemp: number) => {
        setTemperature(newTemp);
    }, []);

    const updateDefaultModel = useCallback((newModel: string | undefined) => {
        setDefaultModel(newModel);
    }, []);

    const updateTools = useCallback((newTools: ToolBase[]) => {
        setTools(newTools);
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
        setQuickPrompts([]);
        setExamples([]);
        setTemperature(0.6);
        setDefaultModel(LLM.llm_name);
    },[]);

    return {
        // State
        input,
        title,
        description,
        systemPrompt,
        selectedTemplate,
        tools,
        quickPrompts,
        examples,
        temperature,
        defaultModel,
        hasChanges,

        // Setters (direct)
        setQuickPrompts,
        setExamples,

        // Update functions
        updateInput,
        updateTitle,
        updateDescription,
        updateSystemPrompt,
        updateTemperature,
        updateDefaultModel,
        updateTools,
        updateTemplate,
        setGeneratedAssistant,

        // Utility functions
        resetAll
    };
};
