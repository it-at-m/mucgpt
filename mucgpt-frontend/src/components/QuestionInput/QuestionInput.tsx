import { AriaLiveAnnouncer, Button, Caption1, mergeClasses, Tooltip } from "@fluentui/react-components";
import { ArrowUp20Regular } from "@fluentui/react-icons";
import {
    useCallback,
    useEffect,
    useRef,
    type ChangeEvent,
    type ClipboardEvent,
    type Dispatch,
    type KeyboardEvent,
    type MouseEvent,
    type SetStateAction
} from "react";
import { useTranslation } from "react-i18next";

import styles from "./QuestionInput.module.css";
import { useAutoGrowTextarea } from "./useAutoGrowTextarea";
import { useQuestionDraft } from "./useQuestionDraft";
import { useUsageNudges } from "./useUsageNudges";
import { Model, ToolListResponse } from "../../api/models";
import { useConfigContext } from "../../context/ConfigContext";
import { DocumentAttachMenu } from "../ChatDocuments/DocumentAttachMenu";
import { DocumentChips } from "../ChatDocuments/DocumentChips";
import { DuplicateDocumentNotice } from "../ChatDocuments/DuplicateDocumentNotice";
import type { ChatDocument } from "../ChatDocuments/documentSelection";
import { useChatDocuments } from "../ChatDocuments/useChatDocuments";
import { useFileDropZone } from "../ChatDocuments/useFileDropZone";
import { ChatDisclaimer } from "../ChatDisclaimer";
import { ChatToolSelector } from "../ChatToolSelector/ChatToolSelector";
import { ChatUsageIndicator, type ChatUsageSummary } from "../ChatUsageIndicator/ChatUsageIndicator";
import { ChatUsageMessageBar } from "../ChatUsageIndicator/ChatUsageMessageBar";
import { LLMSelector } from "../LLMSelector/LLMSelector";
import { MicrophoneButton } from "../MicrophoneButton/MicrophoneButton";
import { useTranscription } from "../Transcription/TranscriptionContext";

export type { ChatUsageSummary } from "../ChatUsageIndicator/ChatUsageIndicator";

interface Props {
    onSend: (question: string) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    question: string;
    setQuestion: (question: string) => void;
    selectedTools: string[];
    setSelectedTools?: Dispatch<SetStateAction<string[]>>;
    tools?: ToolListResponse;
    allowToolSelection?: boolean;
    lockedToolIds?: string[];
    /** Documents attached to the chat. Attaching is offered only when a setter is given and document processing is enabled. */
    documents?: ChatDocument[];
    setDocuments?: Dispatch<SetStateAction<ChatDocument[]>>;
    draftCacheKey?: string;
    skipDraftRestore?: boolean;
    /** Optional notification callback for a final transcript. The transcript itself is merged into `question` automatically. */
    onTranscription?: (text: string) => void;
    /** Explicitly hides the microphone on inputs where speech input makes no sense (e.g. demo/tutorial inputs). */
    transcriptionDisabled?: boolean;
    usage?: ChatUsageSummary;
    onStartNewChat?: () => void;
    usageConversationKey?: string;
    hideDisclaimer?: boolean;
    llmOptions?: Model[];
    selectedLLM?: string;
    onLLMSelectionChange?: (nextLLM: string) => void;
    llmLockedByAssistant?: boolean;
}

const NO_DOCUMENTS: ChatDocument[] = [];
const ignoreDocumentChanges: Dispatch<SetStateAction<ChatDocument[]>> = () => {};

// The app has no global announcer yet, so the composer provides one for its own status announcements.
export const QuestionInput = (props: Props) => (
    <AriaLiveAnnouncer>
        <QuestionInputContent {...props} />
    </AriaLiveAnnouncer>
);

const QuestionInputContent = ({
    onSend,
    disabled,
    placeholder,
    clearOnSend,
    question,
    setQuestion,
    selectedTools,
    setSelectedTools,
    tools,
    allowToolSelection = true,
    lockedToolIds = [],
    documents = NO_DOCUMENTS,
    setDocuments,
    draftCacheKey,
    skipDraftRestore = false,
    onTranscription,
    transcriptionDisabled = false,
    usage,
    onStartNewChat,
    usageConversationKey,
    hideDisclaimer = false,
    llmOptions,
    selectedLLM,
    onLLMSelectionChange,
    llmLockedByAssistant
}: Props) => {
    const { t } = useTranslation();
    const config = useConfigContext();
    const { enabled: isTranscriptionEnabled, status: transcriptionStatus } = useTranscription();
    const allowFileUpload = config.document_processing_enabled && setDocuments !== undefined;
    const resolvedPlaceholder = placeholder ?? (allowFileUpload ? t("chat.prompt") : t("chat.prompt_no_upload"));
    const textareaRef = useAutoGrowTextarea(question);
    const wasDisabledRef = useRef(disabled);
    const recordingBaseRef = useRef("");
    const isTranscriptionActive = transcriptionStatus === "recording" || transcriptionStatus === "transcribing";
    const hasSendableQuestion = question.trim().length > 0;

    const { clearDraft } = useQuestionDraft({ draftCacheKey, question, setQuestion, skipDraftRestore });
    const usageNudges = useUsageNudges({ usage, conversationKey: usageConversationKey, onStartNewChat });
    // Without a setter the attach controls are hidden, so no document change is ever requested.
    const chatDocuments = useChatDocuments(documents, setDocuments ?? ignoreDocumentChanges);
    const { attachFiles, isSendBlocked, markReadyDocumentsAsUsed } = chatDocuments;

    const sendQuestion = useCallback(() => {
        if (disabled || isSendBlocked || !hasSendableQuestion) return;

        onSend(question);
        markReadyDocumentsAsUsed();

        if (clearOnSend) {
            clearDraft();
            setQuestion("");
        }
    }, [clearDraft, clearOnSend, disabled, hasSendableQuestion, isSendBlocked, markReadyDocumentsAsUsed, onSend, question, setQuestion]);

    useEffect(() => {
        if (wasDisabledRef.current && !disabled && document.activeElement === document.body) {
            textareaRef.current?.focus({ preventScroll: true });
        }

        wasDisabledRef.current = disabled;
    }, [disabled]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                sendQuestion();
            }
        },
        [sendQuestion]
    );

    const handleQuestionChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            setQuestion(event.target.value);
        },
        [setQuestion]
    );

    const focusInputOnBackgroundClick = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            const target = event.target as HTMLElement;
            // React events bubble out of portals (e.g. popovers), which are not part of the composer surface.
            if (event.currentTarget.contains(target) && !target.closest("button")) {
                textareaRef.current?.focus();
            }
        },
        [textareaRef]
    );

    const handlePaste = useCallback(
        (event: ClipboardEvent<HTMLTextAreaElement>) => {
            if (event.clipboardData.files.length === 0) return;
            event.preventDefault();
            void attachFiles(Array.from(event.clipboardData.files));
        },
        [attachFiles]
    );

    const focusTextarea = useCallback(() => textareaRef.current?.focus(), [textareaRef]);

    const uploadFiles = useCallback((files: File[]) => void attachFiles(files), [attachFiles]);
    const { isDragActive, dropZoneProps } = useFileDropZone(uploadFiles, allowFileUpload && !disabled);

    const applyTranscript = (text: string) => {
        const fullQuestion = recordingBaseRef.current ? `${recordingBaseRef.current} ${text}` : text;
        setQuestion(fullQuestion);
        onTranscription?.(fullQuestion);
    };

    return (
        <div className={styles.questionInputWrapper}>
            {tools?.tools?.length && setSelectedTools ? (
                <ChatToolSelector
                    tools={tools}
                    selectedTools={selectedTools}
                    setSelectedTools={setSelectedTools}
                    allowToolSelection={allowToolSelection}
                    lockedToolIds={lockedToolIds}
                />
            ) : null}

            {usageNudges.isMessageBarVisible && onStartNewChat && (
                <ChatUsageMessageBar onDismiss={usageNudges.dismissMessageBar} onStartNewChat={onStartNewChat} />
            )}

            {allowFileUpload && chatDocuments.duplicateUploads.length > 0 && (
                <DuplicateDocumentNotice
                    names={chatDocuments.duplicateUploads.map(duplicate => duplicate.file.name)}
                    onUploadAnyway={chatDocuments.uploadDuplicatesAnyway}
                    onDismiss={chatDocuments.dismissDuplicates}
                />
            )}

            <div className={mergeClasses(styles.composer, isDragActive && styles.dragActive)} onClick={focusInputOnBackgroundClick} {...dropZoneProps}>
                {allowFileUpload && (
                    <DocumentChips
                        documents={documents}
                        onRemove={chatDocuments.removeDocument}
                        onRetry={chatDocuments.retryUpload}
                        onFocusLeave={focusTextarea}
                        disabled={disabled}
                    />
                )}
                {allowFileUpload && chatDocuments.hasUnavailableDocuments && (
                    <Caption1 className={styles.sendBlockedReason} role="status">
                        {t("document_library.send_blocked_unavailable")}
                    </Caption1>
                )}
                <textarea
                    ref={textareaRef}
                    className={styles.input}
                    rows={1}
                    placeholder={resolvedPlaceholder}
                    value={question}
                    onChange={handleQuestionChange}
                    onKeyDown={handleKeyDown}
                    onPaste={allowFileUpload ? handlePaste : undefined}
                    disabled={disabled || isTranscriptionActive}
                />
                <div className={styles.actions}>
                    {allowFileUpload && (
                        <DocumentAttachMenu
                            documents={documents}
                            onToggleDocument={chatDocuments.toggleLibraryDocument}
                            onUploadFiles={uploadFiles}
                            disabled={disabled}
                        />
                    )}
                    <div className={styles.spacer} />
                    {usage && (
                        <ChatUsageIndicator
                            usage={usage}
                            autoOpenNotice={usageNudges.isPopoverOpen}
                            onStartNewChat={onStartNewChat}
                            onDismissNotice={usageNudges.closePopover}
                        />
                    )}
                    {llmOptions && selectedLLM && onLLMSelectionChange && (
                        <LLMSelector
                            onSelectionChange={onLLMSelectionChange}
                            selectedLLM={selectedLLM}
                            options={llmOptions}
                            lockedByAssistant={llmLockedByAssistant}
                        />
                    )}
                    {isTranscriptionEnabled && !transcriptionDisabled && (
                        <MicrophoneButton
                            onRecordingStart={() => {
                                recordingBaseRef.current = question;
                            }}
                            onLiveTranscription={applyTranscript}
                            onTranscription={applyTranscript}
                            disabled={disabled}
                        />
                    )}
                    <Tooltip positioning={"below"} content={t("components.questioninput.send_question", "Frage senden")} relationship="label">
                        <Button
                            appearance="primary"
                            icon={<ArrowUp20Regular />}
                            disabled={!hasSendableQuestion || disabled || isTranscriptionActive || isSendBlocked}
                            onClick={sendQuestion}
                        />
                    </Tooltip>
                </div>
            </div>

            {hideDisclaimer ? null : <ChatDisclaimer className={styles.disclaimer} />}
        </div>
    );
};
