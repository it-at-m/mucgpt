import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowClockwise24Regular } from "@fluentui/react-icons";

import styles from "./AssistantPreviewChat.module.css";
import { AskResponse, ChatResponse } from "../../../api";
import { chatApi } from "../../../api/core-client";
import { Answer } from "../../Answer";
import { AnswerList } from "../../AnswerList/AnswerList";
import { QuestionInput } from "../../QuestionInput";
import { StarterPromptList, StarterPromptModel } from "../../StarterPrompt";
import { LLMSelector } from "../../LLMSelector/LLMSelector";
import { LLMContext } from "../../LLMSelector/LLMContextProvider";
import { FollowUpActionContext, FollowUpActionModel } from "../../FollowUpAction";
import { useToolsContext } from "../../ToolsProvider";
import { ToolStatus } from "../../../utils/ToolStreamHandler";
import { useToolStatusToasts } from "../../../hooks/useToolStatusToasts";
import { getChatReducer, makeApiRequest } from "../../../pages/page_helpers";
import type { StorageService } from "../../../service/storage";

interface AssistantPreviewChatProps {
    /** Live system prompt from the editor form. */
    systemPrompt: string;
    /** Live creativity setting from the editor form. */
    creativity: string;
    /** Live selected tool ids from the editor form. */
    selectedToolIds: string[];
    /** Live starter prompts from the editor form. */
    starterPrompts: StarterPromptModel[];
    /** Live follow-up actions (quick prompts) from the editor form. */
    followUpActions: FollowUpActionModel[];
    /** Optional fixed default model configured for the assistant. */
    defaultModel?: string;
    /** Collapses (hides) the preview pane. */
    onCollapse?: () => void;
    /** Icon for the collapse button. */
    collapseIcon?: ReactElement;
}

export const AssistantPreviewChat = ({
    systemPrompt,
    creativity,
    selectedToolIds,
    starterPrompts,
    followUpActions,
    defaultModel,
    onCollapse,
    collapseIcon
}: AssistantPreviewChatProps) => {
    const { t } = useTranslation();
    const { LLM, setLLM, availableLLMs } = useContext(LLMContext);
    const { tools } = useToolsContext();
    const { setFollowUpActions } = useContext(FollowUpActionContext);

    const chatReducer = useMemo(() => getChatReducer<never>(), []);
    const [chatState, dispatch] = useReducer(chatReducer, {
        answers: [],
        creativity,
        systemPrompt,
        active_chat: undefined,
        allChats: []
    });
    const { answers } = chatState;

    const [question, setQuestion] = useState<string>("");
    const [lastQuestion, setLastQuestion] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();
    const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);

    const isLoadingRef = useRef(false);
    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const lastAnswerRef = useRef<HTMLDivElement | null>(null);

    // The preview never persists, so it has no active chat and no storage service.
    // makeApiRequest is called with persist=false and short-circuits before touching
    // either of these; they exist only to satisfy its signature.
    const noActiveChatRef = useRef<string | undefined>(undefined);
    const noopStorageService = useRef({} as StorageService<ChatResponse, unknown>);

    // Keep the always-current config in a ref so callApi never uses stale values.
    const configRef = useRef({ systemPrompt, creativity, selectedToolIds });
    configRef.current = { systemPrompt, creativity, selectedToolIds };

    useToolStatusToasts(toolStatuses);

    // Mirror the live follow-up actions into the shared context so the Answer
    // component renders the assistant's current quick prompts inside the preview.
    // The context is app-global (mounted once at the root and also used by the
    // real chat), so we must clear it on unmount — otherwise the preview's quick
    // prompts leak into the next chat the user opens.
    useEffect(() => {
        setFollowUpActions(followUpActions);
        return () => setFollowUpActions([]);
    }, [followUpActions, setFollowUpActions]);

    // When the assistant pins a default model, the selector below is filtered to only
    // that model. Switch the actual context LLM to match, so the preview requests run
    // against the model the user sees — otherwise the dropdown would show the default
    // while callApi still sent requests with whatever LLM was previously in context.
    useEffect(() => {
        if (!defaultModel || LLM.llm_name === defaultModel) return;
        const defaultModelConfig = availableLLMs.find(m => m.llm_name === defaultModel);
        if (defaultModelConfig) setLLM(defaultModelConfig);
    }, [defaultModel, availableLLMs, LLM.llm_name, setLLM]);

    const setLastQuestionValue = useCallback((value: string) => {
        lastQuestionRef.current = value;
        setLastQuestion(value);
    }, []);

    const setIsLoadingValue = useCallback((value: boolean) => {
        isLoadingRef.current = value;
        setIsLoading(value);
    }, []);

    const callApi = useCallback(
        async (nextQuestion: string, historyOverride?: typeof answers) => {
            setLastQuestionValue(nextQuestion);
            if (error) setError(undefined);
            setIsLoadingValue(true);

            const askResponse: ChatResponse = {} as AskResponse;
            const { systemPrompt: system, creativity: temp, selectedToolIds: toolIds } = configRef.current;
            try {
                await makeApiRequest(
                    historyOverride ?? answers,
                    nextQuestion,
                    dispatch,
                    chatApi,
                    LLM,
                    noActiveChatRef,
                    noopStorageService.current,
                    { system: system ?? "", creativity: temp },
                    askResponse,
                    chatMessageStreamEnd,
                    isLoadingRef,
                    undefined, // fetchHistory — preview has no history list
                    undefined, // assistant_id — preview is not tied to a stored assistant
                    toolIds,
                    setToolStatuses,
                    undefined, // data_sources — preview has no file uploads
                    undefined, // answerTopRef
                    setIsLoadingValue,
                    false // persist — keep the preview conversation ephemeral
                );
            } catch (e) {
                setError(e);
            }
            setIsLoadingValue(false);
        },
        [answers, error, LLM, setIsLoadingValue, setLastQuestionValue]
    );

    const onRegenerate = useCallback(() => {
        if (answers.length === 0 || isLoading) return;
        const trimmed = answers.slice(0, -1);
        const lastUser = answers[answers.length - 1].user;
        dispatch({ type: "SET_ANSWERS", payload: trimmed });
        void callApi(lastUser, trimmed);
    }, [answers, isLoading, callApi]);

    const resetChat = useCallback(() => {
        setLastQuestionValue("");
        setError(undefined);
        setQuestion("");
        dispatch({ type: "CLEAR_ANSWERS" });
    }, [setLastQuestionValue]);

    // Selection is driven by the editor form, so the input's tool selector is read-only.
    const noopSetSelectedTools = useCallback(() => {}, []);

    const onStarterPromptClicked = useCallback((value: string) => callApi(value), [callApi]);

    const onLLMSelectionChange = useCallback(
        (nextLLM: string) => {
            const found = availableLLMs.find(m => m.llm_name === nextLLM);
            if (found) setLLM(found);
        },
        [availableLLMs, setLLM]
    );

    const modelsToShow = useMemo(() => {
        if (defaultModel) {
            const defaultModelExists = availableLLMs.some(m => m.llm_name === defaultModel);
            if (defaultModelExists) return availableLLMs.filter(m => m.llm_name === defaultModel);
        }
        return availableLLMs;
    }, [availableLLMs, defaultModel]);

    const answerList = useMemo(
        () => (
            <AnswerList
                answers={answers}
                regularAssistantMsg={(answer, index) => (
                    <>
                        {index === answers.length - 1 ? (
                            <Answer
                                key={index}
                                answer={answer.response}
                                onRegenerateResponseClicked={onRegenerate}
                                onFollowUpActionSend={prompt => void callApi(prompt)}
                            />
                        ) : (
                            <Answer key={index} answer={answer.response} />
                        )}
                    </>
                )}
                isLoading={isLoading}
                error={error}
                makeApiRequest={() => {
                    const trimmed = answers.slice(0, -1);
                    dispatch({ type: "SET_ANSWERS", payload: trimmed });
                    void callApi(lastQuestion, trimmed);
                }}
                chatMessageStreamEnd={chatMessageStreamEnd}
                lastQuestionRef={lastQuestionRef}
                onRollbackError={() => {
                    setQuestion(lastQuestion);
                    setError(undefined);
                    dispatch({ type: "SET_ANSWERS", payload: answers.slice(0, -1) });
                }}
                lastAnswerRef={lastAnswerRef}
            />
        ),
        [answers, isLoading, error, callApi, lastQuestion, onRegenerate]
    );

    const showStarterPrompts = !lastQuestion && answers.length === 0;

    return (
        <div className={styles.previewContainer}>
            <header className={styles.previewHeader}>
                <div className={styles.previewHeaderLeft}>
                    <span className={styles.previewTitle}>{t("components.assistant_preview.title")}</span>
                    <LLMSelector onSelectionChange={onLLMSelectionChange} defaultLLM={LLM.llm_name} options={modelsToShow} compact />
                </div>
                <div className={styles.previewHeaderActions}>
                    <Tooltip content={t("components.assistant_preview.reset")} relationship="label">
                        <Button
                            appearance="subtle"
                            icon={<ArrowClockwise24Regular />}
                            onClick={resetChat}
                            disabled={answers.length === 0 && !lastQuestion && error === undefined}
                            aria-label={t("components.assistant_preview.reset")}
                        />
                    </Tooltip>
                    {onCollapse && (
                        <Tooltip content={t("components.assistant_preview.hide")} relationship="label">
                            <Button appearance="subtle" icon={collapseIcon} onClick={onCollapse} aria-label={t("components.assistant_preview.hide")} />
                        </Tooltip>
                    )}
                </div>
            </header>

            <div className={styles.previewBody}>
                {showStarterPrompts ? (
                    <div className={styles.previewEmptyState}>
                        <p className={styles.previewWelcome}>{t("components.assistant_preview.welcome")}</p>
                        {starterPrompts.length > 0 && <StarterPromptList starterPrompts={starterPrompts} onStarterPromptClicked={onStarterPromptClicked} />}
                    </div>
                ) : (
                    <ul className={styles.previewMessages} aria-description={t("common.messages")}>
                        {answerList}
                    </ul>
                )}
            </div>

            <div className={styles.previewInput}>
                <QuestionInput
                    clearOnSend
                    disabled={isLoading || error !== undefined}
                    onSend={q => void callApi(q)}
                    question={question}
                    setQuestion={setQuestion}
                    selectedTools={selectedToolIds}
                    setSelectedTools={noopSetSelectedTools}
                    tools={tools}
                    allowToolSelection={false}
                    allowFileUpload={false}
                />
            </div>
        </div>
    );
};
