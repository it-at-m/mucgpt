import { Button, Textarea, type TextareaOnChangeData, Tooltip } from "@fluentui/react-components";
import { Send28Filled, DocumentAdd24Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import styles from "./QuestionInput.module.css";
import { uploadFileApi } from "../../api/core-client";
import { ToolListResponse } from "../../api/models";
import { useConfigContext } from "../../context/ConfigContext";
import { upsertParsedDocumentFromUpload } from "../../service/parsedDocumentStorage";
import { ContextManagerDialog, UploadedData, createUploadedData, getDataSignature, getFileSignature } from "../ContextManagerDialog/ContextManagerDialog";
import { ChatToolSelector } from "../ChatToolSelector/ChatToolSelector";
import { MicrophoneButton } from "../MicrophoneButton/MicrophoneButton";
import { useTranscription } from "../TranscriptionSettings/TranscriptionSettingsContext";

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
    onTranscription
}: Props) => {
    const { t } = useTranslation();
    const config = useConfigContext();
    const allowFileUpload = allowFileUploadProp ?? config.document_processing_enabled;
    const allowTranscription = config.transcription_enabled;
    const resolvedPlaceholder = placeholder ?? (allowFileUpload ? t("chat.prompt") : t("chat.prompt_no_upload"));
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const sendButtonRef = useRef<HTMLButtonElement | null>(null);
    const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
    const wasDisabledRef = useRef(disabled);
    const wasDialogOpenRef = useRef(false);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [internalUploadedData, setInternalUploadedData] = useState<UploadedData[]>([]);
    const uploadedDataRef = useRef<UploadedData[]>([]);
    const [isDragActive, setIsDragActive] = useState(false);
    const [isExpandedInput, setIsExpandedInput] = useState(false);
    const dragCounterRef = useRef(0);
    const isDraftHydratedRef = useRef(false);
    const isPageUnloadingRef = useRef(false);
    const setQuestionRef = useRef(setQuestion);
    const recordingBaseRef = useRef("");
    const { isModelReady: transcriptionReady, status: transcriptionStatus } = useTranscription();
    const isTranscriptionActive = transcriptionStatus === "recording" || transcriptionStatus === "transcribing";

    const draftStorageKey = draftCacheKey ? `question-input-draft:${draftCacheKey}` : undefined;

    const uploadedData = externalUploadedData ?? internalUploadedData;
    const activeDocumentCount = uploadedData.filter(data => data.isActive !== false).length;
    const hasSendableQuestion = question.trim().length > 0;

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

    useEffect(() => {
        const resizeTextarea = () => {
            const textarea = textareaRef.current;
            if (!textarea) {
                return;
            }

            const maxHeight = 200;
            const computedStyle = window.getComputedStyle(textarea);
            const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 24;
            const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
            const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
            const verticalPadding = paddingTop + paddingBottom;
            const singleLineHeight = lineHeight + verticalPadding;
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            const horizontalPadding = (Number.parseFloat(computedStyle.paddingLeft) || 0) + (Number.parseFloat(computedStyle.paddingRight) || 0);
            const availableLineWidth = textarea.clientWidth - horizontalPadding;
            const needsWrappedLine =
                context && availableLineWidth > 0
                    ? question.split("\n").some(line => {
                          context.font = computedStyle.font;
                          return context.measureText(line || " ").width > availableLineWidth;
                      })
                    : false;
            const nextExpandedInput = question.trim().length > 0 && (question.includes("\n") || needsWrappedLine);

            setIsExpandedInput(nextExpandedInput);
            textarea.style.height = "auto";

            if (!nextExpandedInput) {
                textarea.style.height = `${singleLineHeight}px`;
                textarea.style.overflowY = "hidden";
                return;
            }

            const scrollHeight = textarea.scrollHeight;
            const newHeight = Math.min(scrollHeight, maxHeight);

            textarea.style.height = `${newHeight}px`;
            textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
        };

        resizeTextarea();

        if (question === "") {
            const textarea = textareaRef.current;
            if (textarea) {
                textarea.style.height = "auto";
                textarea.style.overflowY = "hidden";
            }
        }
    }, [question]);

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
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendQuestion();
            }
        },
        [sendQuestion]
    );

    const onQuestionChange = useCallback(
        (_event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, data: TextareaOnChangeData) => {
            setQuestion(data.value || "");
        },
        [setQuestion]
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

                <div
                    className={`${styles.questionInputContainer} ${
                        !tools?.tools?.length || !setSelectedTools ? styles.noTools : ""
                    } ${isDragActive ? styles.dragActive : ""} ${isExpandedInput ? styles.expandedInput : ""} ${!allowFileUpload ? styles.noUpload : ""}`}
                    onDragEnter={allowFileUpload ? handleDragEnter : undefined}
                    onDragOver={allowFileUpload ? handleDragOver : undefined}
                    onDragLeave={allowFileUpload ? handleDragLeave : undefined}
                    onDrop={allowFileUpload ? handleDrop : undefined}
                >
                    {allowFileUpload ? (
                        <Tooltip content={t("components.questioninput.upload_data", "Dokument hochladen")} relationship="label">
                            <div className={styles.uploadButtonWrapper}>
                                <Button
                                    ref={uploadButtonRef}
                                    size="large"
                                    appearance="subtle"
                                    icon={<DocumentAdd24Regular />}
                                    aria-label={t("components.questioninput.upload_data", "Dokument hochladen")}
                                    onClick={handleUploadButtonClick}
                                    disabled={disabled}
                                />
                                {activeDocumentCount > 0 ? <span className={styles.uploadCountBadge}>{activeDocumentCount}</span> : null}
                            </div>
                        </Tooltip>
                    ) : null}
                    <Textarea
                        className={styles.questionInputTextArea}
                        placeholder={resolvedPlaceholder}
                        resize="none"
                        value={question}
                        size="large"
                        onChange={onQuestionChange}
                        onKeyDown={onEnterPress}
                        ref={textareaRef}
                        disabled={disabled || isTranscriptionActive}
                    />
                    <div className={styles.questionInputButtons}>
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
                        {hasSendableQuestion ? (
                            <Tooltip content={resolvedPlaceholder} relationship="label">
                                <Button
                                    ref={sendButtonRef}
                                    size="large"
                                    appearance="transparent"
                                    icon={<Send28Filled />}
                                    aria-label={t("components.questioninput.send_question", "Frage senden")}
                                    disabled={disabled || isTranscriptionActive}
                                    onClick={sendQuestion}
                                />
                            </Tooltip>
                        ) : null}
                    </div>
                </div>

                <div className={styles.errorhintSection}>
                    <div className={styles.errorhint}>{t("components.questioninput.errorhint")}</div>
                </div>
            </div>

            {allowFileUpload ? (
                <ContextManagerDialog open={isUploadDialogOpen} onOpenChange={handleDialogOpenChange} data={uploadedData} onDataChange={handleDataChange} />
            ) : null}
        </>
    );
};
