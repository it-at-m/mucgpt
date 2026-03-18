import type { FormEvent, ReactNode } from "react";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Field,
    InfoLabel,
    Spinner,
    Textarea,
    TextareaOnChangeData
} from "@fluentui/react-components";
import { Bot24Regular, Dismiss24Regular, Save24Regular } from "@fluentui/react-icons";

import styles from "./AssistantEditorPage.module.css";
import { AssistantCreateFlow } from "./AssistantCreateFlow";
import { Assistant, ToolBase, ToolInfo } from "../../../api";
import { createCommunityAssistantApi } from "../../../api/assistant-client";
import { createAssistantApi } from "../../../api/core-client";
import { useGlobalToastContext } from "../../GlobalToastHandler/GlobalToastContext";
import { ExampleModel } from "../../Example";
import { LLMContext } from "../../LLMSelector/LLMContextProvider";
import { QuickPrompt } from "../../QuickPrompt/QuickPrompt";
import { useToolsContext } from "../../ToolsProvider";
import { useAssistantState } from "../shared/hooks/useAssistantState";
import { useCreateAssistantState } from "../shared/hooks/useCreateAssistantState";
import { ToolsStep, QuickPromptsStep, ExamplesStep, AdvancedSettingsStep, VisibilityStep } from "../shared";
import { AssistantStrategy } from "../../../pages/assistant/AssistantStrategy";
import { CREATIVITY_LOW } from "../../../constants";

type CreateView = "mode_select" | "ai_input" | "settings";
type DiscardTarget = "back" | "discovery";
type GeneratedAssistantResponse = {
    title?: string;
    description?: string;
    system_prompt?: string;
    detail?: string;
    error?: string;
    message?: string;
};

interface AssistantEditorPageCreateProps {
    mode: "create";
}

interface AssistantEditorPageEditProps {
    mode: "edit";
    assistant: Assistant;
    isOwner: boolean;
    strategy: AssistantStrategy;
    onSave: (assistant: Assistant) => void;
}

type AssistantEditorPageProps = AssistantEditorPageCreateProps | AssistantEditorPageEditProps;

function SectionCard({ title, children, className, hideTitle, id }: { title: string; children: ReactNode; className?: string; hideTitle?: boolean; id?: string }) {
    const sectionClassName = [styles.sectionCard, className].filter(Boolean).join(" ");
    return (
        <div className={sectionClassName} id={id}>
            {!hideTitle && <h3 className={styles.sectionTitle}>{title}</h3>}
            <div className={styles.sectionContent}>{children}</div>
        </div>
    );
}

interface SettingsFormProps {
    title: string;
    description: string;
    systemPrompt: string;
    onTitleChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onSystemPromptChange: (value: string) => void;
    creativity: string;
    defaultModel: string | undefined;
    onCreativityChange: (value: string) => void;
    onDefaultModelChange: (value: string | undefined) => void;
    selectedTools: ToolInfo[];
    onToolsChange: (tools: ToolBase[]) => void;
    quickPrompts: QuickPrompt[];
    onQuickPromptsChange: (value: QuickPrompt[]) => void;
    examples: ExampleModel[];
    onExamplesChange: (value: ExampleModel[]) => void;
    isOwner: boolean;
    publishDepartments: string[];
    isVisible: boolean;
    setPublishDepartments: (departments: string[]) => void;
    setInvisibleChecked: (invisible: boolean) => void;
    onHasChanged?: (changed: boolean) => void;
    actions?: ReactNode;
}

function SettingsForm(props: SettingsFormProps) {
    const { t } = useTranslation();
    const { tools: availableTools } = useToolsContext();

    const onChange = (setter: (value: string) => void) => (_event: FormEvent<HTMLInputElement | HTMLTextAreaElement>, data?: TextareaOnChangeData) => {
        setter(data?.value || "");
        props.onHasChanged?.(true);
    };

    return (
        <div className={styles.settingsGrid}>
            <div className={styles.settingsColumn}>
                <SectionCard title={t("components.assistant_editor.section_basic")} className={styles.sectionBasic}>
                    <Field size="large" className={styles.formField} label={{ children: t("components.assistant_editor.title") }} required>
                        <Textarea
                            placeholder={t("components.assistant_editor.title_placeholder")}
                            value={props.title}
                            rows={1}
                            resize="vertical"
                            onChange={onChange(props.onTitleChange)}
                            maxLength={100}
                            disabled={!props.isOwner}
                        />
                    </Field>
                    <Field size="large" className={styles.formField} label={{ children: t("components.assistant_editor.description") }}>
                        <Textarea
                            placeholder={t("components.assistant_editor.description_placeholder")}
                            value={props.description}
                            rows={3}
                            resize="vertical"
                            onChange={onChange(props.onDescriptionChange)}
                            disabled={!props.isOwner}
                        />
                    </Field>
                </SectionCard>

                <SectionCard title={t("components.assistant_editor.section_tools")} className={styles.sectionTools}>
                    <ToolsStep
                        selectedTools={props.selectedTools}
                        availableTools={availableTools}
                        onToolsChange={props.onToolsChange}
                        onHasChanged={props.onHasChanged}
                    />
                </SectionCard>

                <SectionCard title={t("components.assistant_editor.section_access")} className={styles.sectionAccess} id="visibility-settings">
                    <VisibilityStep
                        isOwner={props.isOwner}
                        publishDepartments={props.publishDepartments}
                        invisibleChecked={!props.isVisible}
                        setPublishDepartments={props.setPublishDepartments}
                        onHasChanged={props.onHasChanged ?? (() => {})}
                        setInvisibleChecked={invisible => props.setInvisibleChecked(invisible)}
                    />
                </SectionCard>
            </div>

            <div className={styles.settingsColumn}>
                <SectionCard title={t("components.assistant_editor.section_behaviour")} className={styles.sectionBehaviour}>
                    <Field
                        size="large"
                        className={styles.formField}
                        label={{
                            className: styles.formLabel,
                            children: (
                                <>
                                    {t("components.assistant_editor.system_prompt")}
                                    <InfoLabel
                                        info={
                                            <div>
                                                <i>{t("components.chattsettingsdrawer.system_prompt")}s </i>
                                                {t("components.chattsettingsdrawer.system_prompt_info")}
                                            </div>
                                        }
                                    />
                                </>
                            )
                        }}
                        required
                    >
                        <Textarea
                            placeholder={t("components.assistant_editor.prompt_placeholder")}
                            value={props.systemPrompt}
                            rows={7}
                            resize="vertical"
                            onChange={onChange(props.onSystemPromptChange)}
                            disabled={!props.isOwner}
                        />
                    </Field>
                    <AdvancedSettingsStep
                        creativity={props.creativity}
                        defaultModel={props.defaultModel}
                        onCreativityChange={props.onCreativityChange}
                        onDefaultModelChange={props.onDefaultModelChange}
                        onHasChanged={props.onHasChanged}
                        isOwner={props.isOwner}
                    />
                </SectionCard>

                <SectionCard title={t("components.assistant_editor.section_prompts")} className={styles.sectionPrompts}>
                    <QuickPromptsStep
                        quickPrompts={props.quickPrompts}
                        isOwner={props.isOwner}
                        onQuickPromptsChange={props.onQuickPromptsChange}
                        onHasChanged={props.onHasChanged}
                    />
                    <ExamplesStep
                        examples={props.examples}
                        isOwner={props.isOwner}
                        onExamplesChange={props.onExamplesChange}
                        onHasChanged={props.onHasChanged}
                    />
                </SectionCard>
            </div>

            {props.actions && (
                <SectionCard title="" hideTitle className={styles.sectionActions}>
                    {props.actions}
                </SectionCard>
            )}
        </div>
    );
}

function getGenerationErrorMessage(result: GeneratedAssistantResponse, fallbackMessage: string) {
    if (typeof result.detail === "string" && result.detail.trim() !== "") return result.detail;
    if (typeof result.error === "string" && result.error.trim() !== "") return result.error;
    if (typeof result.message === "string" && result.message.trim() !== "") return result.message;
    return fallbackMessage;
}

export const AssistantEditorPage = (props: AssistantEditorPageProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { LLM } = useContext(LLMContext);
    const { showError, showSuccess } = useGlobalToastContext();
    const { tools: availableTools } = useToolsContext();

    const isCreate = props.mode === "create";
    const isOwner = isCreate ? true : (props as AssistantEditorPageEditProps).isOwner;

    const [createView, setCreateView] = useState<CreateView>("mode_select");
    const createState = useCreateAssistantState();

    const editAssistant = isCreate ? null : (props as AssistantEditorPageEditProps).assistant;
    const emptyAssistant: Assistant = useMemo(
        () => ({
            id: undefined,
            title: "",
            description: "",
            system_message: "",
            quick_prompts: [],
            examples: [],
            creativity: CREATIVITY_LOW,
            default_model: LLM.llm_name,
            tools: [],
            publish: false,
            owner_ids: [],
            hierarchical_access: [],
            tags: [],
            is_visible: false,
            version: "0"
        }),
        [LLM.llm_name]
    );
    const editState = useAssistantState(editAssistant ?? emptyAssistant);

    const state = isCreate ? createState : editState;

    const [loading, setLoading] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [discardTarget, setDiscardTarget] = useState<DiscardTarget>("back");

    const selectedTools = useMemo(() => {
        if (!availableTools) return [] as ToolInfo[];
        const toolMap = new Map(availableTools.tools.map(tool => [tool.id, tool]));
        return (state.tools ?? []).map(tool => toolMap.get(tool.id)).filter(Boolean) as ToolInfo[];
    }, [availableTools, state.tools]);

    const handleCancel = useCallback(() => {
        const hasChanges = isCreate ? createState.hasChanges : editState.hasChanged;
        if (hasChanges) {
            setDiscardTarget("back");
            setDiscardOpen(true);
        } else {
            navigate(-1);
        }
    }, [isCreate, createState.hasChanges, editState.hasChanged, navigate]);

    const handleHeaderClose = useCallback(() => {
        if (!isCreate) {
            handleCancel();
            return;
        }

        if (createView === "mode_select") {
            navigate("/discovery");
            return;
        }

        if (createView === "ai_input") {
            if (createState.hasChanges) {
                setDiscardTarget("discovery");
                setDiscardOpen(true);
            } else {
                navigate("/discovery");
            }
            return;
        }

        handleCancel();
    }, [isCreate, createView, createState.hasChanges, navigate, handleCancel]);

    const handleDiscardConfirm = useCallback(() => {
        setDiscardOpen(false);
        if (discardTarget === "discovery") {
            navigate("/discovery");
            return;
        }
        navigate(-1);
    }, [discardTarget, navigate]);

    const handleSave = useCallback(async () => {
        if (loading) return;

        const s = state as typeof createState & typeof editState;
        const assistantTitle = s.title.trim();
        const systemPrompt = s.systemPrompt.trim();

        if (assistantTitle === "" || systemPrompt === "") {
            showError(t("components.assistant_editor.assistant_save_failed"), t("components.assistant_editor.save_config_failed"));
            return;
        }

        setLoading(true);

        const validQuickPrompts = (s.quickPrompts ?? []).filter((quickPrompt: QuickPrompt) => quickPrompt.label?.trim() && quickPrompt.prompt?.trim());
        const validExamples = (s.examples ?? []).filter((example: ExampleModel) => example.text?.trim() && example.value?.trim());
        const assistantDescription = s.description || "";

        try {
            if (isCreate) {
                const response = await createCommunityAssistantApi({
                    name: assistantTitle,
                    description: assistantDescription,
                    system_prompt: systemPrompt,
                    creativity: createState.creativity,
                    default_model: createState.defaultModel,
                    tools: createState.tools ?? [],
                    owner_ids: [],
                    examples: validExamples.map(example => ({ text: example.text, value: example.value })),
                    quick_prompts: validQuickPrompts.map(quickPrompt => ({
                        label: quickPrompt.label,
                        prompt: quickPrompt.prompt,
                        tooltip: quickPrompt.tooltip
                    })),
                    tags: [],
                    hierarchical_access: createState.hierarchicalAccess ?? [],
                    is_visible: createState.isVisible
                });

                if (response?.id) {
                    showSuccess(
                        t("components.assistant_editor.assistant_saved_success"),
                        t("components.assistant_editor.assistant_saved_message", { title: assistantTitle })
                    );
                    navigate(`/owned/communityassistant/${response.id}`);
                } else {
                    showError(t("components.assistant_editor.assistant_creation_failed"), t("components.assistant_editor.save_config_failed"));
                }
            } else {
                const editProps = props as AssistantEditorPageEditProps;
                const updatedAssistant = editState.createAssistantForSaving();
                await editProps.onSave(updatedAssistant);
                showSuccess(
                    t("components.assistant_editor.saved_successfully"),
                    t("components.assistant_editor.assistant_saved_description", { assistantName: updatedAssistant.title || "" })
                );
                navigate(-1);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("components.assistant_editor.save_config_failed");
            showError(t("components.assistant_editor.assistant_save_failed"), errorMessage);
        } finally {
            setLoading(false);
        }
    }, [loading, state, isCreate, createState, editState, t, showError, showSuccess, navigate, props]);

    const handleGenerate = useCallback(async () => {
        if (!createState.input.trim() || loading) return;
        setLoading(true);

        try {
            const response = await createAssistantApi({ input: createState.input, model: LLM.llm_name });
            const result = (await response.json().catch(() => ({}))) as GeneratedAssistantResponse;

            if (!response.ok) {
                throw new Error(getGenerationErrorMessage(result, t("components.assistant_editor.assistant_generation_failed")));
            }

            if (
                typeof result.title !== "string" ||
                result.title.trim() === "" ||
                typeof result.system_prompt !== "string" ||
                result.system_prompt.trim() === ""
            ) {
                throw new Error(t("components.assistant_editor.assistant_generation_failed"));
            }

            createState.setGeneratedAssistant(result.title, result.description ?? "", result.system_prompt);
            setCreateView("settings");
            showSuccess(t("components.assistant_editor.assistant_generated_success"), t("components.assistant_editor.assistant_generated_message"));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("components.assistant_editor.assistant_generation_failed");
            showError(t("components.assistant_editor.assistant_creation_failed"), errorMessage);
        } finally {
            setLoading(false);
        }
    }, [createState, LLM.llm_name, loading, showError, showSuccess, t]);

    const pageTitle = isCreate ? t("components.assistant_editor.create_title") : t("components.assistant_editor.edit_title");
    const settingsState = isCreate ? createState : editState;
    const isSettingsValid = settingsState.title.trim() !== "" && settingsState.systemPrompt.trim() !== "";

    useEffect(() => {
        // Support both hash router (/#/route#fragment) and regular routing (#fragment)
        const parts = window.location.hash.split("#");
        const hash = parts[2] || parts[1];
        if (hash !== "visibility-settings") {
            return;
        }

        requestAnimationFrame(() => {
            document.getElementById("visibility-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }, []);

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <Bot24Regular className={styles.headerIcon} />
                    <h1 className={styles.headerTitle}>{pageTitle}</h1>
                </div>
                <div className={styles.headerActions}>
                    <Button appearance="subtle" icon={<Dismiss24Regular />} aria-label={t("common.close")} onClick={handleHeaderClose} />
                </div>
            </div>

            <div className={styles.body}>
                {isCreate && createView !== "settings" && (
                    <AssistantCreateFlow
                        view={createView}
                        input={createState.input}
                        loading={loading}
                        onSelectManual={() => setCreateView("settings")}
                        onSelectGenerate={() => setCreateView("ai_input")}
                        onInputChange={createState.updateInput}
                        onGenerate={handleGenerate}
                        onBack={() => setCreateView("mode_select")}
                        onExampleClick={example => createState.updateInput(example)}
                    />
                )}

                {(!isCreate || createView === "settings") && (
                    <SettingsForm
                        title={settingsState.title}
                        description={settingsState.description}
                        systemPrompt={settingsState.systemPrompt}
                        onTitleChange={settingsState.updateTitle}
                        onDescriptionChange={settingsState.updateDescription}
                        onSystemPromptChange={settingsState.updateSystemPrompt}
                        creativity={settingsState.creativity}
                        defaultModel={settingsState.defaultModel}
                        onCreativityChange={settingsState.updateCreativity}
                        onDefaultModelChange={settingsState.updateDefaultModel}
                        selectedTools={selectedTools}
                        onToolsChange={settingsState.updateTools}
                        quickPrompts={settingsState.quickPrompts ?? []}
                        onQuickPromptsChange={settingsState.setQuickPrompts}
                        examples={settingsState.examples ?? []}
                        onExamplesChange={settingsState.setExamples}
                        isOwner={isOwner}
                        publishDepartments={settingsState.hierarchicalAccess ?? []}
                        isVisible={settingsState.isVisible ?? false}
                        setPublishDepartments={settingsState.updateHierarchicalAccess}
                        setInvisibleChecked={invisible => settingsState.updateIsVisible(!invisible)}
                        onHasChanged={isCreate ? undefined : value => value && editState.setHasChanged?.(true)}
                        actions={
                            <div className={styles.footerActionStack}>
                                <Button
                                    appearance="primary"
                                    onClick={handleSave}
                                    disabled={loading || !isOwner || !isSettingsValid}
                                    icon={loading ? <Spinner size="tiny" /> : <Save24Regular />}
                                    className={styles.primaryActionButton}
                                >
                                    {isCreate ? t("common.create") : t("components.assistant_editor.save")}
                                </Button>
                                <Button appearance="transparent" onClick={handleCancel} disabled={loading}>
                                    {t("common.cancel")}
                                </Button>
                            </div>
                        }
                    />
                )}
            </div>

            <Dialog open={discardOpen} onOpenChange={(_event, data) => setDiscardOpen(data.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>{t("components.assistant_editor.discard_title")}</DialogTitle>
                        <DialogContent>{t("components.assistant_editor.discard_message")}</DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={() => setDiscardOpen(false)}>
                                {t("common.cancel")}
                            </Button>
                            <Button appearance="primary" onClick={handleDiscardConfirm}>
                                {t("common.close")}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};
