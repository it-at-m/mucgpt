import { Button, Textarea, TextareaOnChangeData, Tooltip } from "@fluentui/react-components";
import { Send28Filled, DocumentAdd24Regular } from "@fluentui/react-icons";

import styles from "./QuestionInput.module.css";
import { useTranslation } from "react-i18next";
import {useCallback, useEffect, useRef, useState} from "react";
import { ToolListResponse } from "../../api/models";
import {
    DataUploadDialog,
    UploadedData,
    createUploadedData,
    getDataSignature,
    getFileSignature
} from "../DataUploadDialog/DataUploadDialog";
import { ToolBadges } from "./ToolBadges";
import { DataUpload } from "./DataUpload";
import { uploadFileApi } from "../../api/data-client";





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
    onDataChange?: (data: UploadedData[]) => void;
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
    onDataChange
}: Props) => {
    const { t } = useTranslation();
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const sendButtonRef = useRef<HTMLButtonElement | null>(null);
    const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
    const wasDialogOpenRef = useRef(false);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [uploadedData, setUploadedData] = useState<UploadedData[]>([]);
    const uploadedDataRef = useRef<UploadedData[]>([]);
    const [isDragActive, setIsDragActive] = useState(false);
    const dragCounterRef = useRef(0);

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

        if (uploadedData.length > 0) {
            onDataChange?.(uploadedData);
        }

        if (clearOnSend) {
            setQuestion("");
            if (uploadedData.length > 0) {
                setUploadedData([]);
                onDataChange?.([]);
            }
        }
    }, [disabled, question, onSend, uploadedData, clearOnSend, setQuestion, onDataChange]);

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
                const newData = fileArray
                    .filter(file => !existingSignatures.has(getFileSignature(file)))
                    .map(file => createUploadedData(file, "uploading"));

                if (newData.length === 0) {
                    return prev;
                }

                const updated = [...prev, ...newData];

                // Upload each new document
                newData.forEach(data => {
                    uploadFileApi(data.file)
                        .then(fileId => {
                            const current = uploadedDataRef.current;
                            const updatedData = current.map(d => (d.id === data.id ? { ...d, status: "ready" as const, fileId } : d));
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

    const handleRemoveData = useCallback(
        (id: string) => {
            setUploadedData(prev => {
                const updated = prev.filter(data => data.id !== id);
                onDataChange?.(updated);
                return updated;
            });
        },
        [onDataChange]
    );




    const handleToggleData = useCallback(
        (id: string) => {
            setUploadedData(prev => {
                const updated = prev.map(data => (data.id === id ? { ...data, isActive: !(data.isActive !== false) } : data));
                onDataChange?.(updated);
                return updated;
            });
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
                <DataUpload data={uploadedData} onToggle={handleToggleData} onRemove={handleRemoveData} />

                {/* Input container with textarea and buttons */}
                <div
                    className={`${styles.questionInputContainer} ${
                        !tools || !tools.tools || tools.tools.length === 0 ? styles.noTools : ""
                    } ${isDragActive ? styles.dragActive : ""}`}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <Textarea
                        className={styles.questionInputTextArea}
                        placeholder={placeholder}
                        resize="none"
                        value={question}
                        size="large"
                        onChange={onQuestionChange}
                        onKeyDown={onEnterPress}
                        ref={textareaRef}
                    />
                    <div className={styles.questionInputButtons}>
                        <Tooltip content={t("components.questioninput.upload_data", "Dokument hochladen")} relationship="label">
                            <Button
                                ref={uploadButtonRef}
                                size="large"
                                appearance={"subtle"}
                                icon={<DocumentAdd24Regular />}
                                aria-label={t("components.questioninput.upload_data", "Dokument hochladen")}
                                onClick={handleUploadButtonClick}
                                disabled={disabled}
                            />
                        </Tooltip>
                        <Tooltip content={placeholder || ""} relationship="label">
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
            <DataUploadDialog
                open={isUploadDialogOpen}
                onOpenChange={handleDialogOpenChange}
                data={uploadedData}
                onDataChange={handleDataChange}
            />
        </>
    );
};
