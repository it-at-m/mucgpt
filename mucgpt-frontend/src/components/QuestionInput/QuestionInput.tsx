import { Button, mergeClasses, Tooltip } from "@fluentui/react-components";
import { Add20Regular, ArrowUp20Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type Dispatch, type MouseEvent, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import styles from "./QuestionInput.module.css";
import { useAutoGrowTextarea } from "./useAutoGrowTextarea";
import { Button as SubtleButton } from "../../ui/Button";
import { uploadFileApi } from "../../api/core-client";
import { ToolListResponse } from "../../api/models";
import { useConfigContext } from "../../context/ConfigContext";
import { upsertParsedDocumentFromUpload } from "../../service/parsedDocumentStorage";
import { ContextManagerDialog, UploadedData, createUploadedData, getDataSignature, getFileSignature } from "../ContextManagerDialog/ContextManagerDialog";
import { ChatDisclaimer } from "../ChatDisclaimer";
import { ChatToolSelector } from "../ChatToolSelector/ChatToolSelector";
import { ChatUsageIndicator, type ChatUsageSummary } from "../ChatUsageIndicator/ChatUsageIndicator";
import { ChatUsageMessageBar } from "../ChatUsageIndicator/ChatUsageMessageBar";
import { getContextUsagePercent, getUsageCriticalThreshold, getUsageWarningThreshold } from "../ChatUsageIndicator/chatUsage";
import { MicrophoneButton } from "../MicrophoneButton/MicrophoneButton";
import { useTranscription } from "../TranscriptionSettings/TranscriptionSettingsContext";

export type { ChatUsageSummary } from "../ChatUsageIndicator/ChatUsageIndicator";

interface Props {
    onSend: (question: string, data: UploadedData[]) => void;
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
    allowFileUpload?: boolean;
    onDataChange?: (data: UploadedData[]) => void;
    uploadedData?: UploadedData[];
    setUploadedData?: Dispatch<SetStateAction<UploadedData[]>>;
    draftCacheKey?: string;
    skipDraftRestore?: boolean;
    onTranscription?: (text: string) => void;
    usage?: ChatUsageSummary;
    onStartNewChat?: () => void;
    usageConversationKey?: string;
    hideDisclaimer?: boolean;
}

export const QuestionInput = ({
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
    allowFileUpload: allowFileUploadProp,
    onDataChange,
    uploadedData: externalUploadedData,
    setUploadedData: setExternalUploadedData,
    draftCacheKey,
    skipDraftRestore = false,
    onTranscription,
    usage,
    onStartNewChat,
    usageConversationKey,
    hideDisclaimer = false
}: Props) => {
    const { t } = useTranslation();
    const config = useConfigContext();
    const allowFileUpload = allowFileUploadProp ?? config.document_processing_enabled;
    const allowTranscription = config.transcription_enabled;
    const resolvedPlaceholder = placeholder ?? (allowFileUpload ? t("chat.prompt") : t("chat.prompt_no_upload"));
    const textareaRef = useAutoGrowTextarea(question);
    const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
    const wasDisabledRef = useRef(disabled);
    const wasDialogOpenRef = useRef(false);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [internalUploadedData, setInternalUploadedData] = useState<UploadedData[]>([]);
    const uploadedDataRef = useRef<UploadedData[]>([]);
    const [isDragActive, setIsDragActive] = useState(false);
    const [hasShownUsagePopover, setHasShownUsagePopover] = useState(false);
    const [isUsagePopoverOpen, setIsUsagePopoverOpen] = useState(false);
    const [isUsageMessageBarDismissed, setIsUsageMessageBarDismissed] = useState(false);
    const dragCounterRef = useRef(0);
    const isDraftHydratedRef = useRef(false);
    const isPageUnloadingRef = useRef(false);
    const setQuestionRef = useRef(setQuestion);
    const previousUsageConversationKeyRef = useRef<string | undefined>(usageConversationKey);
    const recordingBaseRef = useRef("");
    const { isModelReady: transcriptionReady, status: transcriptionStatus } = useTranscription();
    const isTranscriptionActive = transcriptionStatus === "recording" || transcriptionStatus === "transcribing";

    const draftStorageKey = draftCacheKey ? `question-input-draft:${draftCacheKey}` : undefined;

    const uploadedData = externalUploadedData ?? internalUploadedData;
    const activeDocumentCount = uploadedData.filter(data => data.isActive !== false).length;
    const hasSendableQuestion = question.trim().length > 0;
    const contextPercent = getContextUsagePercent(usage);
    const warningThreshold = getUsageWarningThreshold(usage);
    const criticalThreshold = getUsageCriticalThreshold(usage);
    const hasUsageNudges = Boolean(onStartNewChat && usageConversationKey && contextPercent !== undefined);
    const isUsageMessageBarVisible = hasUsageNudges && contextPercent !== undefined && contextPercent >= criticalThreshold && !isUsageMessageBarDismissed;

    useEffect(() => {
        const isNewConversation = previousUsageConversationKeyRef.current !== usageConversationKey;

        if (isNewConversation) {
            previousUsageConversationKeyRef.current = usageConversationKey;
            setHasShownUsagePopover(false);
            setIsUsagePopoverOpen(false);
            setIsUsageMessageBarDismissed(false);
        }

        if (!hasUsageNudges || contextPercent === undefined) {
            setIsUsagePopoverOpen(false);
            return;
        }

        const isPopoverRange = contextPercent >= warningThreshold && contextPercent < criticalThreshold;
        const alreadyShownForConversation = isNewConversation ? false : hasShownUsagePopover;

        if (isPopoverRange && !alreadyShownForConversation) {
            setHasShownUsagePopover(true);
            setIsUsagePopoverOpen(true);
        } else if (!isPopoverRange) {
            setIsUsagePopoverOpen(false);
        }

        if (contextPercent < criticalThreshold) {
            setIsUsageMessageBarDismissed(false);
        }
    }, [contextPercent, criticalThreshold, hasShownUsagePopover, hasUsageNudges, usageConversationKey, warningThreshold]);

    const setUploadedData = useCallback(
        (data: UploadedData[] | ((prev: UploadedData[]) => UploadedData[])) => {
            if (setExternalUploadedData) {
                setExternalUploadedData(data);
                return;
            }

            setInternalUploadedData(data);
        },
        [setExternalUploadedData]
    );

    useEffect(() => {
        uploadedDataRef.current = uploadedData;
    }, [uploadedData]);

    useEffect(() => {
        setQuestionRef.current = setQuestion;
    }, [setQuestion]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            isPageUnloadingRef.current = true;
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    useEffect(() => {
        return () => {
            if (!draftStorageKey || isPageUnloadingRef.current) {
                return;
            }

            try {
                sessionStorage.removeItem(draftStorageKey);
            } catch {
                // Ignore sessionStorage errors while cleaning up route-local drafts.
            }
        };
    }, [draftStorageKey]);

    useEffect(() => {
        isDraftHydratedRef.current = false;

        if (!draftStorageKey || question.trim().length > 0) {
            isDraftHydratedRef.current = true;
            return;
        }

        if (skipDraftRestore) {
            try {
                sessionStorage.removeItem(draftStorageKey);
            } catch {
                // Ignore sessionStorage errors while clearing skipped drafts.
            } finally {
                isDraftHydratedRef.current = true;
            }
            return;
        }

        try {
            const draftQuestion = sessionStorage.getItem(draftStorageKey);

            if (draftQuestion) {
                setQuestionRef.current(draftQuestion);
            }
        } catch {
            // Ignore sessionStorage errors and continue without draft restore.
        } finally {
            isDraftHydratedRef.current = true;
        }
    }, [draftStorageKey, skipDraftRestore]);

    useEffect(() => {
        if (!draftStorageKey || skipDraftRestore || !isDraftHydratedRef.current) {
            return;
        }

        try {
            if (question.trim().length > 0) {
                sessionStorage.setItem(draftStorageKey, question);
            } else {
                sessionStorage.removeItem(draftStorageKey);
            }
        } catch {
            // Ignore sessionStorage errors and continue without draft persistence.
        }
    }, [draftStorageKey, question, skipDraftRestore]);

    const hasFileData = useCallback((dataTransfer?: DataTransfer | null) => {
        if (!dataTransfer?.types) {
            return false;
        }

        for (let i = 0; i < dataTransfer.types.length; i += 1) {
            if (dataTransfer.types[i] === "Files") {
                return true;
            }
        }

        return false;
    }, []);

    const sendQuestion = useCallback(() => {
        if (disabled || !question.trim()) {
            return;
        }

        const activeData = uploadedData.filter(data => data.isActive !== false);
        onSend(question, activeData);

        if (!clearOnSend) {
            return;
        }

        try {
            if (draftStorageKey) sessionStorage.removeItem(draftStorageKey);
        } catch {
            // Ignore sessionStorage errors and keep the UI state unchanged.
        }

        setQuestion("");

        if (!externalUploadedData && uploadedData.length > 0) {
            setUploadedData([]);
            onDataChange?.([]);
        }
    }, [clearOnSend, disabled, draftStorageKey, externalUploadedData, onDataChange, onSend, question, setQuestion, setUploadedData, uploadedData]);

    useEffect(() => {
        if (wasDisabledRef.current && !disabled && document.activeElement === document.body) {
            textareaRef.current?.focus({ preventScroll: true });
        }

        wasDisabledRef.current = disabled;
    }, [disabled]);

    const onEnterPress = useCallback(
        (event: React.KeyboardEvent<Element>) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                sendQuestion();
            }
        },
        [sendQuestion]
    );

    const onQuestionChange = useCallback(
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

    const handleUploadButtonClick = useCallback(() => {
        if (!disabled) {
            setIsUploadDialogOpen(true);
        }
    }, [disabled]);

    const handleDialogOpenChange = useCallback((open: boolean) => {
        setIsUploadDialogOpen(open);
    }, []);

    const appendDataFromFiles = useCallback(
        (files: FileList | File[]) => {
            const fileArray = Array.from(files ?? []);
            if (fileArray.length === 0) {
                return;
            }

            const previousData = uploadedDataRef.current;
            const existingSignatures = new Set(previousData.map(getDataSignature));
            const newData = fileArray.filter(file => !existingSignatures.has(getFileSignature(file))).map(file => createUploadedData(file, "uploading"));

            if (newData.length === 0) {
                return;
            }

            const updatedData = [...previousData, ...newData];

            setUploadedData(updatedData);
            onDataChange?.(updatedData);

            newData.forEach(data => {
                uploadFileApi(data.file)
                    .then(fileContent => {
                        const storedDocument = upsertParsedDocumentFromUpload(data.file, fileContent);
                        const currentData = uploadedDataRef.current;
                        const nextData = currentData.map(currentItem =>
                            currentItem.id === data.id
                                ? {
                                    ...currentItem,
                                    status: "ready" as const,
                                    fileContent,
                                    storedDocumentId: storedDocument?.id,
                                    parsedAt: storedDocument?.parsedAt,
                                    fileSignature: storedDocument?.fileSignature,
                                    mimeType: storedDocument?.mimeType,
                                    source: "upload" as const
                                }
                                : currentItem
                        );

                        setUploadedData(nextData);
                        onDataChange?.(nextData);
                    })
                    .catch(error => {
                        console.error("Failed to upload document:", error);
                        const currentData = uploadedDataRef.current;
                        const nextData = currentData.map(currentItem =>
                            currentItem.id === data.id
                                ? { ...currentItem, status: "error" as const, errorMessage: error.message || "Upload failed" }
                                : currentItem
                        );

                        setUploadedData(nextData);
                        onDataChange?.(nextData);
                    });
            });
        },
        [onDataChange, setUploadedData]
    );

    const handleDataChange = useCallback(
        (data: UploadedData[]) => {
            setUploadedData(data);
            onDataChange?.(data);
        },
        [onDataChange, setUploadedData]
    );

    useEffect(() => {
        if (wasDialogOpenRef.current && !isUploadDialogOpen) {
            uploadButtonRef.current?.focus();
        }

        wasDialogOpenRef.current = isUploadDialogOpen;
    }, [isUploadDialogOpen]);

    const handleDragEnter = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            if (disabled || !hasFileData(event.dataTransfer)) {
                return;
            }

            event.preventDefault();
            dragCounterRef.current += 1;
            setIsDragActive(true);
        },
        [disabled, hasFileData]
    );

    const handleDragOver = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            if (disabled || !hasFileData(event.dataTransfer)) {
                return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        },
        [disabled, hasFileData]
    );

    const handleDragLeave = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            if (disabled || !hasFileData(event.dataTransfer)) {
                return;
            }

            event.preventDefault();
            dragCounterRef.current = Math.max(dragCounterRef.current - 1, 0);

            if (dragCounterRef.current === 0) {
                setIsDragActive(false);
            }
        },
        [disabled, hasFileData]
    );

    const handleDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            if (disabled || !hasFileData(event.dataTransfer)) {
                return;
            }

            event.preventDefault();
            dragCounterRef.current = 0;
            setIsDragActive(false);
            appendDataFromFiles(event.dataTransfer.files);
        },
        [appendDataFromFiles, disabled, hasFileData]
    );

    return (
        <>
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

                {isUsageMessageBarVisible && onStartNewChat && (
                    <ChatUsageMessageBar onDismiss={() => setIsUsageMessageBarDismissed(true)} onStartNewChat={onStartNewChat} />
                )}

                <div
                    className={mergeClasses(styles.composer, isDragActive && styles.dragActive)}
                    onClick={focusInputOnBackgroundClick}
                    onDragEnter={allowFileUpload ? handleDragEnter : undefined}
                    onDragOver={allowFileUpload ? handleDragOver : undefined}
                    onDragLeave={allowFileUpload ? handleDragLeave : undefined}
                    onDrop={allowFileUpload ? handleDrop : undefined}
                >
                    <textarea
                        ref={textareaRef}
                        className={styles.input}
                        rows={1}
                        placeholder={resolvedPlaceholder}
                        value={question}
                        onChange={onQuestionChange}
                        onKeyDown={onEnterPress}
                        disabled={disabled || isTranscriptionActive}
                    />
                    <div className={styles.actions}>
                        {allowFileUpload ? (
                            <div className={styles.uploadAction}>
                                <Tooltip positioning={"below"} content={t("components.questioninput.upload_data", "Dokument hochladen")} relationship="label">
                                    <SubtleButton
                                        ref={uploadButtonRef}
                                        appearance="subtle"
                                        icon={<Add20Regular />}
                                        onClick={handleUploadButtonClick}
                                        disabled={disabled}
                                    />
                                </Tooltip>
                                {activeDocumentCount > 0 ? <span className={styles.uploadCountBadge}>{activeDocumentCount}</span> : null}
                            </div>
                        ) : null}
                        <div className={styles.spacer} />
                        {usage && (
                            <ChatUsageIndicator
                                usage={usage}
                                autoOpenNotice={isUsagePopoverOpen}
                                onStartNewChat={onStartNewChat}
                                onDismissNotice={() => setIsUsagePopoverOpen(false)}
                            />
                        )}
                        {allowTranscription && onTranscription && transcriptionReady && (
                            <MicrophoneButton
                                onRecordingStart={() => {
                                    recordingBaseRef.current = question;
                                }}
                                onLiveTranscription={text => {
                                    const full = recordingBaseRef.current ? `${recordingBaseRef.current} ${text}` : text;
                                    setQuestion(full);
                                    onTranscription(full);
                                }}
                                onTranscription={text => {
                                    const full = recordingBaseRef.current ? `${recordingBaseRef.current} ${text}` : text;
                                    setQuestion(full);
                                    onTranscription(full);
                                }}
                                disabled={disabled}
                            />
                        )}
                        <Tooltip positioning={"below"} content={t("components.questioninput.send_question", "Frage senden")} relationship="label">
                            <Button
                                appearance="primary"
                                icon={<ArrowUp20Regular />}
                                disabled={!hasSendableQuestion || disabled || isTranscriptionActive}
                                onClick={sendQuestion}
                            />
                        </Tooltip>
                    </div>
                </div>

                {hideDisclaimer ? null : <ChatDisclaimer className={styles.disclaimer} />}
            </div>

            {allowFileUpload ? (
                <ContextManagerDialog open={isUploadDialogOpen} onOpenChange={handleDialogOpenChange} data={uploadedData} onDataChange={handleDataChange} />
            ) : null}
        </>
    );
};
