import { Button, Textarea, TextareaOnChangeData, Tooltip } from "@fluentui/react-components";
import { Send28Filled, DocumentAdd24Regular } from "@fluentui/react-icons";

import styles from "./QuestionInput.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { ToolListResponse } from "../../api/models";
import { ContextManagerDialog, UploadedData, createUploadedData, getDataSignature, getFileSignature } from "../ContextManagerDialog/ContextManagerDialog";
import { ToolBadges } from "./ToolBadges";
import { uploadFileApi } from "../../api/core-client";
import { upsertParsedDocumentFromUpload } from "../../service/parsedDocumentStorage";
import { useConfigContext } from "../../context/ConfigContext";

interface Props {
    onSend: (question: string, data: UploadedData[]) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    question: string;
    setQuestion: (question: string) => void;
    selectedTools: string[];
    setSelectedTools?: (tools: string[]) => void;
    tools?: ToolListResponse;
    allowToolSelection?: boolean;
    /** Override whether the file upload / context manager is available. Defaults to the `document_processing_enabled` flag from the application config. */
    allowFileUpload?: boolean;
    onDataChange?: (data: UploadedData[]) => void;
    uploadedData?: UploadedData[];
    setUploadedData?: (data: UploadedData[]) => void;
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
    allowFileUpload: allowFileUploadProp,
    onDataChange,
    uploadedData: externalUploadedData,
    setUploadedData: setExternalUploadedData
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

    // Use external state when provided (controlled), otherwise fall back to internal state
    const uploadedData = externalUploadedData ?? internalUploadedData;
    const activeDocumentCount = uploadedData.filter(data => data.isActive !== false).length;

    const setUploadedData = useCallback(
        (data: UploadedData[] | ((prev: UploadedData[]) => UploadedData[])) => {
            if (setExternalUploadedData) {
                const resolved = typeof data === "function" ? data(uploadedData) : data;
                setExternalUploadedData(resolved);
            } else {
                setInternalUploadedData(data as any);
            }
        },
        [setExternalUploadedData, uploadedData]
    );

    useEffect(() => {
        uploadedDataRef.current = uploadedData;
    }, [uploadedData]);

    const hasFileData = useCallback((dataTransfer?: DataTransfer | null) => {
        if (!dataTransfer || !dataTransfer.types) {
            return false;
        }
        for (let i = 0; i < dataTransfer.types.length; i += 1) {
            if (dataTransfer.types[i] === "Files") {
                return true;
            }
        }
        return false;
    }, []);

    // Auto-resize functionality
    useEffect(() => {
        const resizeTextarea = () => {
            const textarea = textareaRef.current;
            if (textarea) {
                // Check if textarea currently has focus
                const hadFocus = document.activeElement === textarea;

                // Store current cursor position
                const selectionStart = textarea.selectionStart;
                const selectionEnd = textarea.selectionEnd;

                // Reset height first to get accurate scrollHeight
                textarea.style.height = "auto";

                // Calculate new height, capped at 200px
                const maxHeight = 200;
                const scrollHeight = textarea.scrollHeight;
                const newHeight = Math.min(scrollHeight, maxHeight);

                textarea.style.height = `${newHeight}px`;

                // Enable scrolling if content exceeds max height
                if (scrollHeight > maxHeight) {
                    textarea.style.overflowY = "auto";
                } else {
                    textarea.style.overflowY = "hidden";
                }

                // Only restore focus and cursor position if textarea had focus before
                if (hadFocus) {
                    textarea.focus();
                    textarea.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        };

        resizeTextarea();

        // Reset height when question is cleared
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

        if (clearOnSend) {
            setQuestion("");
            // Only clear uploaded data when using internal (uncontrolled) state.
            // When external state is provided, the parent is responsible for clearing.
            if (!externalUploadedData && uploadedData.length > 0) {
                setUploadedData([]);
                onDataChange?.([]);
            }
        }
    }, [disabled, question, onSend, uploadedData, clearOnSend, setQuestion, onDataChange, externalUploadedData]);

    const onEnterPress = useCallback(
        (ev: React.KeyboardEvent<Element>) => {
            if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                sendQuestion();
            }
        },
        [sendQuestion]
    );

    const onQuestionChange = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            if (!newValue?.value) {
                setQuestion("");
            } else {
                setQuestion(newValue.value);
            }
        },
        [setQuestion]
    );

    const handleUploadButtonClick = useCallback(() => {
        if (disabled) {
            return;
        }
        setIsUploadDialogOpen(true);
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

            setUploadedData(prev => {
                const existingSignatures = new Set(prev.map(getDataSignature));
                const newData = fileArray.filter(file => !existingSignatures.has(getFileSignature(file))).map(file => createUploadedData(file, "uploading"));

                if (newData.length === 0) {
                    return prev;
                }

                const updated = [...prev, ...newData];

                // Upload each new document
                newData.forEach(data => {
                    uploadFileApi(data.file)
                        .then(fileContent => {
                            const storedDocument = upsertParsedDocumentFromUpload(data.file, fileContent);
                            const current = uploadedDataRef.current;
                            const updatedData = current.map(d =>
                                d.id === data.id
                                    ? {
                                          ...d,
                                          status: "ready" as const,
                                          fileContent,
                                          storedDocumentId: storedDocument?.id,
                                          parsedAt: storedDocument?.parsedAt,
                                          fileSignature: storedDocument?.fileSignature,
                                          mimeType: storedDocument?.mimeType,
                                          source: "upload" as const
                                      }
                                    : d
                            );
                            setUploadedData(updatedData);
                            onDataChange?.(updatedData);
                        })
                        .catch(error => {
                            console.error("Failed to upload document:", error);
                            const current = uploadedDataRef.current;
                            const updatedData = current.map(d =>
                                d.id === data.id ? { ...d, status: "error" as const, errorMessage: error.message || "Upload failed" } : d
                            );
                            setUploadedData(updatedData);
                            onDataChange?.(updatedData);
                        });
                });

                onDataChange?.(updated);
                return updated;
            });
        },
        [onDataChange]
    );

    const handleDataChange = useCallback(
        (data: UploadedData[]) => {
            setUploadedData(data);
            onDataChange?.(data);
        },
        [onDataChange]
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
        [disabled, hasFileData, appendDataFromFiles]
    );

    return (
        <>
            <div className={styles.questionInputWrapper}>
                {/* Tool badges at the top - show all tools */}
                <ToolBadges tools={tools} selectedTools={selectedTools} allowToolSelection={allowToolSelection} setSelectedTools={setSelectedTools} />

                {/* Input container with textarea and buttons */}
                <div
                    className={`${styles.questionInputContainer} ${
                        !tools || !tools.tools || tools.tools.length === 0 ? styles.noTools : ""
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
                        {allowFileUpload && (
                            <Tooltip content={t("components.questioninput.upload_data", "Dokument hochladen")} relationship="label">
                                <div className={styles.uploadButtonWrapper}>
                                    <Button
                                        ref={uploadButtonRef}
                                        size="large"
                                        appearance={"subtle"}
                                        icon={<DocumentAdd24Regular />}
                                        aria-label={t("components.questioninput.upload_data", "Dokument hochladen")}
                                        onClick={handleUploadButtonClick}
                                        disabled={disabled}
                                    />
                                    {activeDocumentCount > 0 && <span className={styles.uploadCountBadge}>{activeDocumentCount}</span>}
                                </div>
                            </Tooltip>
                        )}
                        <Tooltip content={resolvedPlaceholder} relationship="label">
                            <Button
                                ref={sendButtonRef}
                                size="large"
                                appearance={"subtle"}
                                icon={<Send28Filled />}
                                aria-label={t("components.questioninput.send_question", "Frage senden")}
                                disabled={disabled || !question.trim()}
                                onClick={sendQuestion}
                            />
                        </Tooltip>
                    </div>
                </div>

                {/* Error hint at the bottom */}
                <div className={styles.errorhintSection}>
                    <div className={styles.errorhint}>{t("components.questioninput.errorhint")}</div>
                </div>
            </div>
            {allowFileUpload && (
                <ContextManagerDialog open={isUploadDialogOpen} onOpenChange={handleDialogOpenChange} data={uploadedData} onDataChange={handleDataChange} />
            )}
        </>
    );
};
