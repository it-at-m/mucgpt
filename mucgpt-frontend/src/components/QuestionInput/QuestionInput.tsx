import { Button, Textarea, type TextareaOnChangeData, Tooltip } from "@fluentui/react-components";
import { Send28Filled, DocumentAdd24Regular } from "@fluentui/react-icons";
import { useCallback, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import styles from "./QuestionInput.module.css";
import { uploadFileApi } from "../../api/core-client";
import { ToolListResponse } from "../../api/models";
import { useConfigContext } from "../../context/ConfigContext";
import { upsertParsedDocumentFromUpload } from "../../service/parsedDocumentStorage";
import { ContextManagerDialog, UploadedData, createUploadedData, getDataSignature, getFileSignature } from "../ContextManagerDialog/ContextManagerDialog";
import { ChatToolSelector } from "../ChatToolSelector/ChatToolSelector";
import { MicrophoneButton } from "../MicrophoneButton/MicrophoneButton";
import { TranscriptionSettingsContext } from "../TranscriptionSettings/TranscriptionSettingsContext";

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
    onTranscription
}: Props) => {
    const { t } = useTranslation();
    const config = useConfigContext();
    const allowFileUpload = allowFileUploadProp ?? config.document_processing_enabled;
    const resolvedPlaceholder = placeholder ?? (allowFileUpload ? t("chat.prompt") : t("chat.prompt_no_upload"));
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const sendButtonRef = useRef<HTMLButtonElement | null>(null);
    const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
    const wasDialogOpenRef = useRef(false);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [internalUploadedData, setInternalUploadedData] = useState<UploadedData[]>([]);
    const uploadedDataRef = useRef<UploadedData[]>([]);
    const [isDragActive, setIsDragActive] = useState(false);
    const dragCounterRef = useRef(0);
    const recordingBaseRef = useRef("");
    const { isModelReady: transcriptionReady } = useContext(TranscriptionSettingsContext);

    const uploadedData = externalUploadedData ?? internalUploadedData;
    const activeDocumentCount = uploadedData.filter(data => data.isActive !== false).length;

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

            const hadFocus = document.activeElement === textarea;
            const selectionStart = textarea.selectionStart;
            const selectionEnd = textarea.selectionEnd;

            textarea.style.height = "auto";

            const maxHeight = 200;
            const scrollHeight = textarea.scrollHeight;
            const newHeight = Math.min(scrollHeight, maxHeight);

            textarea.style.height = `${newHeight}px`;
            textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";

            if (hadFocus) {
                textarea.focus();
                textarea.setSelectionRange(selectionStart, selectionEnd);
            }
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

        setQuestion("");

        if (!externalUploadedData && uploadedData.length > 0) {
            setUploadedData([]);
            onDataChange?.([]);
        }
    }, [clearOnSend, disabled, externalUploadedData, onDataChange, onSend, question, setQuestion, setUploadedData, uploadedData]);

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
                    } ${isDragActive ? styles.dragActive : ""}`}
                    onDragEnter={allowFileUpload ? handleDragEnter : undefined}
                    onDragOver={allowFileUpload ? handleDragOver : undefined}
                    onDragLeave={allowFileUpload ? handleDragLeave : undefined}
                    onDrop={allowFileUpload ? handleDrop : undefined}
                >
                    <Textarea
                        className={styles.questionInputTextArea}
                        placeholder={resolvedPlaceholder}
                        resize="none"
                        value={question}
                        size="large"
                        onChange={onQuestionChange}
                        onKeyDown={onEnterPress}
                        ref={textareaRef}
                    />
                    <div className={styles.questionInputButtons}>
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
                        {onTranscription && transcriptionReady && (
                            <MicrophoneButton
                                onRecordingStart={() => {
                                    recordingBaseRef.current = question;
                                }}
                                onLiveTranscription={text => setQuestion(recordingBaseRef.current ? `${recordingBaseRef.current} ${text}` : text)}
                                onTranscription={text => setQuestion(recordingBaseRef.current ? `${recordingBaseRef.current} ${text}` : text)}
                                disabled={disabled}
                            />
                        )}
                        <Tooltip content={resolvedPlaceholder} relationship="label">
                        <Button
                            ref={sendButtonRef}
                            size="large"
                            appearance="transparent"
                            icon={<Send28Filled />}
                            aria-label={t("components.questioninput.send_question", "Frage senden")}
                            disabled={disabled || !question.trim()}
                            onClick={sendQuestion}
                        />
                    </Tooltip>
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
