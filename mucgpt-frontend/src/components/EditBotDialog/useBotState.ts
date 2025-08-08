import { useState, useEffect, useCallback } from "react";
import { Bot, ToolBase } from "../../api";
import { QuickPrompt } from "../QuickPrompt/QuickPrompt";
import { ExampleModel } from "../Example";

export const useBotState = (initialBot: Bot) => {
    // All state variables
    const [botId, setBotId] = useState<string | undefined>(initialBot.id);
    const [title, setTitle] = useState<string>(initialBot.title);
    const [description, setDescription] = useState<string>(initialBot.description);
    const [systemPrompt, setSystemPrompt] = useState<string>(initialBot.system_message);
    const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>(initialBot.quick_prompts || []);
    const [examples, setExamples] = useState<ExampleModel[]>(initialBot.examples || []);
    const [temperature, setTemperature] = useState<number>(initialBot.temperature);
    const [maxOutputTokens, setMaxOutputTokens] = useState<number>(initialBot.max_output_tokens);
    const [version, setVersion] = useState<string>(initialBot.version || "0");
    const [tools, setTools] = useState<ToolBase[]>(initialBot.tools || []);
    const [publish, setPublish] = useState<boolean>(initialBot.publish || false);
    const [ownerIds, setOwnerIds] = useState<string[]>(initialBot.owner_ids || []);
    const [hierarchicalAccess, setHierarchicalAccess] = useState<string[]>(initialBot.hierarchical_access || []);
    const [tags, setTags] = useState<string[]>(initialBot.tags || []);
    const [hasChanged, setHasChanged] = useState<boolean>(false);
    const [isVisible, setIsVisible] = useState<boolean>(initialBot.is_visible || true);

    // Update state when bot prop changes
    useEffect(() => {
        setBotId(initialBot.id);
        setTitle(initialBot.title);
        setDescription(initialBot.description);
        setSystemPrompt(initialBot.system_message);
        setQuickPrompts(initialBot.quick_prompts || []);
        setExamples(initialBot.examples || []);
        setTemperature(initialBot.temperature);
        setMaxOutputTokens(initialBot.max_output_tokens || 1024);
        setVersion(initialBot.version || "0");
        setTools(initialBot.tools || []);
        setPublish(initialBot.publish || false);
        setOwnerIds(initialBot.owner_ids || []);
        setHierarchicalAccess(initialBot.hierarchical_access || []);
        setTags(initialBot.tags || []);
        setHasChanged(false);
        setIsVisible(initialBot.is_visible || true);
    }, [initialBot]);

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

    const updateMaxTokens = useCallback((newTokens: number) => {
        setMaxOutputTokens(newTokens);
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

    // Reset to original values
    const resetToOriginal = useCallback(() => {
        setBotId(initialBot.id);
        setTitle(initialBot.title);
        setDescription(initialBot.description);
        setSystemPrompt(initialBot.system_message);
        setQuickPrompts(initialBot.quick_prompts || []);
        setExamples(initialBot.examples || []);
        setTemperature(initialBot.temperature);
        setMaxOutputTokens(initialBot.max_output_tokens);
        setVersion(initialBot.version);
        setTools(initialBot.tools || []);
        setPublish(initialBot.publish || false);
        setOwnerIds(initialBot.owner_ids || []);
        setHierarchicalAccess(initialBot.hierarchical_access || []);
        setTags(initialBot.tags || []);
        setHasChanged(false);
        setIsVisible(initialBot.is_visible || true);
    }, [initialBot]);

    // Create bot object for saving
    const createBotForSaving = useCallback((): Bot => {
        const validQuickPrompts = quickPrompts.filter(qp => qp.label && qp.label.trim() !== "" && qp.prompt && qp.prompt.trim() !== "");
        const validExamples = examples.filter(ex => ex.text && ex.text.trim() !== "" && ex.value && ex.value.trim() !== "");

        return {
            id: botId,
            title: title === "" ? "Assistent" : title,
            description: description === "" ? "Ein Assistent" : description,
            system_message: systemPrompt,
            publish: publish,
            owner_ids: ownerIds,
            temperature: temperature,
            max_output_tokens: maxOutputTokens,
            quick_prompts: validQuickPrompts,
            examples: validExamples,
            version: version,
            tools: tools,
            hierarchical_access: hierarchicalAccess,
            tags: tags,
            is_visible: isVisible
        };
    }, [
        botId,
        title,
        description,
        systemPrompt,
        publish,
        ownerIds,
        temperature,
        maxOutputTokens,
        quickPrompts,
        examples,
        version,
        tools,
        hierarchicalAccess,
        tags,
        isVisible
    ]);

    return {
        // State
        botId,
        title,
        description,
        systemPrompt,
        quickPrompts,
        examples,
        temperature,
        maxOutputTokens,
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
        updateMaxTokens,
        updateTools,
        updateIsVisible,

        // Utility functions
        resetToOriginal,
        createBotForSaving
    };
};
