import { useState, useEffect, useCallback } from "react";
import { Assistant, ToolBase } from "../../api";
import { QuickPrompt } from "../QuickPrompt/QuickPrompt";
import { ExampleModel } from "../Example";

export const useAssistantState = (initialAssistant: Assistant) => {
    // All state variables
    const [assistantId, setAssistantId] = useState<string | undefined>(initialAssistant.id);
    const [title, setTitle] = useState<string>(initialAssistant.title);
    const [description, setDescription] = useState<string>(initialAssistant.description);
    const [systemPrompt, setSystemPrompt] = useState<string>(initialAssistant.system_message);
    const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>(initialAssistant.quick_prompts || []);
    const [examples, setExamples] = useState<ExampleModel[]>(initialAssistant.examples || []);
    const [temperature, setTemperature] = useState<number>(initialAssistant.temperature);
    const [maxOutputTokens, setMaxOutputTokens] = useState<number>(initialAssistant.max_output_tokens);
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
        setAssistantId(initialAssistant.id);
        setTitle(initialAssistant.title);
        setDescription(initialAssistant.description);
        setSystemPrompt(initialAssistant.system_message);
        // Ensure all quick prompts have IDs
        const quickPromptsWithIds = (initialAssistant.quick_prompts || []).map(qp => ({
            ...qp,
            id: qp.id || crypto.randomUUID()
        }));
        setQuickPrompts(quickPromptsWithIds);
        // Ensure all examples have IDs
        const examplesWithIds = (initialAssistant.examples || []).map(ex => ({
            ...ex,
            id: ex.id || crypto.randomUUID()
        }));
        setExamples(examplesWithIds);
        setTemperature(initialAssistant.temperature);
        setMaxOutputTokens(initialAssistant.max_output_tokens || 1024);
        setVersion(initialAssistant.version || "0");
        setTools(initialAssistant.tools || []);
        setPublish(initialAssistant.publish || false);
        setOwnerIds(initialAssistant.owner_ids || []);
        setHierarchicalAccess(initialAssistant.hierarchical_access || []);
        setTags(initialAssistant.tags || []);
        setHasChanged(false);
        setIsVisible(initialAssistant.is_visible !== undefined ? initialAssistant.is_visible : true);
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

    const updateHierarchicalAccess = useCallback((access: string[]) => {
        setHierarchicalAccess(access);
        setHasChanged(true);
    }, []);

    // Reset to original values
    const resetToOriginal = useCallback(() => {
        setAssistantId(initialAssistant.id);
        setTitle(initialAssistant.title);
        setDescription(initialAssistant.description);
        setSystemPrompt(initialAssistant.system_message);
        // Ensure all quick prompts have IDs
        const quickPromptsWithIds = (initialAssistant.quick_prompts || []).map(qp => ({
            ...qp,
            id: qp.id || crypto.randomUUID()
        }));
        setQuickPrompts(quickPromptsWithIds);
        // Ensure all examples have IDs
        const examplesWithIds = (initialAssistant.examples || []).map(ex => ({
            ...ex,
            id: ex.id || crypto.randomUUID()
        }));
        setExamples(examplesWithIds);
        setTemperature(initialAssistant.temperature);
        setMaxOutputTokens(initialAssistant.max_output_tokens);
        setVersion(initialAssistant.version);
        setTools(initialAssistant.tools || []);
        setPublish(initialAssistant.publish || false);
        setOwnerIds(initialAssistant.owner_ids || []);
        setHierarchicalAccess(initialAssistant.hierarchical_access || []);
        setTags(initialAssistant.tags || []);
        setHasChanged(false);
        setIsVisible(initialAssistant.is_visible !== undefined ? initialAssistant.is_visible : true);
    }, [initialAssistant]);

    // Create assistant object for saving
    const createAssistantForSaving = useCallback((): Assistant => {
        const validQuickPrompts = quickPrompts.filter(qp => qp.label && qp.label.trim() !== "" && qp.prompt && qp.prompt.trim() !== "");
        const validExamples = examples.filter(ex => ex.text && ex.text.trim() !== "" && ex.value && ex.value.trim() !== "");

        return {
            id: assistantId,
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
        assistantId,
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
        assistantId,
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
        updateHierarchicalAccess,

        // Utility functions
        resetToOriginal,
        createAssistantForSaving
    };
};
