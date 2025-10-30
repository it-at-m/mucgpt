import { Button, Textarea, TextareaOnChangeData, Tooltip } from "@fluentui/react-components";
import { Send28Filled, DocumentAdd24Regular } from "@fluentui/react-icons";

import styles from "./QuestionInput.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { ToolListResponse } from "../../api/models";
import {
    DocumentUploadDialog,
    UploadedDocument,
    createUploadedDocument,
    getDocumentSignature,
    getFileSignature
} from "../DocumentUploadDialog/DocumentUploadDialog";
import { ToolBadges } from "./ToolBadges";
import { UploadedDocuments } from "./UploadedDocuments";
import { uploadFileApi } from "../../api/doc-client";

interface Props {
    onSend: (question: string, documents: UploadedDocument[]) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    question: string;
    setQuestion: (question: string) => void;
    selectedTools: string[];
    setSelectedTools?: (tools: string[]) => void;
    tools?: ToolListResponse;
    allowToolSelection?: boolean;
    onDocumentsChange?: (documents: UploadedDocument[]) => void;
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
    onDocumentsChange
}: Props) => {
    const { t } = useTranslation();
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const sendButtonRef = useRef<HTMLButtonElement | null>(null);
    const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
    const wasDialogOpenRef = useRef(false);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
    const uploadedDocumentsRef = useRef<UploadedDocument[]>([]);
    const [isDragActive, setIsDragActive] = useState(false);
    const dragCounterRef = useRef(0);

    useEffect(() => {
        uploadedDocumentsRef.current = uploadedDocuments;
    }, [uploadedDocuments]);

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

                // Calculate new height
                const newHeight = textarea.scrollHeight;
                textarea.style.height = `${newHeight}px`;

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
            }
        }
    }, [question]);

    const sendQuestion = useCallback(() => {
        if (disabled || !question.trim()) {
            return;
        }

        const activeDocuments = uploadedDocuments.filter(doc => doc.isActive !== false);
        onSend(question, activeDocuments);

        if (uploadedDocuments.length > 0) {
            onDocumentsChange?.(uploadedDocuments);
        }

        if (clearOnSend) {
            setQuestion("");
        }
    }, [disabled, question, onSend, uploadedDocuments, clearOnSend, setQuestion, onDocumentsChange]);

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

    const appendDocumentsFromFiles = useCallback(
        (files: FileList | File[]) => {
            const fileArray = Array.from(files ?? []);
            if (fileArray.length === 0) {
                return;
            }

            setUploadedDocuments(prev => {
                const existingSignatures = new Set(prev.map(getDocumentSignature));
                const newDocs = fileArray
                    .filter(file => !existingSignatures.has(getFileSignature(file)))
                    .map(file => createUploadedDocument(file, "uploading"));

                if (newDocs.length === 0) {
                    return prev;
                }

                const updated = [...prev, ...newDocs];

                // Upload each new document
                newDocs.forEach(doc => {
                    uploadFileApi(doc.file)
                        .then(fileId => {
                            const current = uploadedDocumentsRef.current;
                            const updatedDocs = current.map(d => (d.id === doc.id ? { ...d, status: "ready" as const, fileId } : d));
                            setUploadedDocuments(updatedDocs);
                            onDocumentsChange?.(updatedDocs);
                        })
                        .catch(error => {
                            console.error("Failed to upload document:", error);
                            const current = uploadedDocumentsRef.current;
                            const updatedDocs = current.map(d =>
                                d.id === doc.id ? { ...d, status: "error" as const, errorMessage: error.message || "Upload failed" } : d
                            );
                            setUploadedDocuments(updatedDocs);
                            onDocumentsChange?.(updatedDocs);
                        });
                });

                onDocumentsChange?.(updated);
                return updated;
            });
        },
        [onDocumentsChange]
    );

    const handleDocumentsChange = useCallback(
        (documents: UploadedDocument[]) => {
            setUploadedDocuments(documents);
            onDocumentsChange?.(documents);
        },
        [onDocumentsChange]
    );

    const handleRemoveDocument = useCallback(
        (id: string) => {
            setUploadedDocuments(prev => {
                const updated = prev.filter(doc => doc.id !== id);
                onDocumentsChange?.(updated);
                return updated;
            });
        },
        [onDocumentsChange]
    );

    const handleToggleDocument = useCallback(
        (id: string) => {
            setUploadedDocuments(prev => {
                const updated = prev.map(doc => (doc.id === id ? { ...doc, isActive: !(doc.isActive !== false) } : doc));
                onDocumentsChange?.(updated);
                return updated;
            });
        },
        [onDocumentsChange]
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
            appendDocumentsFromFiles(event.dataTransfer.files);
        },
        [disabled, hasFileData, appendDocumentsFromFiles]
    );

    return (
        <>
            <div className={styles.questionInputWrapper}>
                {/* Tool badges at the top - show all tools */}
                <ToolBadges tools={tools} selectedTools={selectedTools} allowToolSelection={allowToolSelection} setSelectedTools={setSelectedTools} />
                <UploadedDocuments documents={uploadedDocuments} onToggle={handleToggleDocument} onRemove={handleRemoveDocument} />

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
                        <Tooltip content={t("components.questioninput.upload_document", "Dokument hochladen")} relationship="label">
                            <Button
                                ref={uploadButtonRef}
                                size="large"
                                appearance={"subtle"}
                                icon={<DocumentAdd24Regular />}
                                aria-label={t("components.questioninput.upload_document", "Dokument hochladen")}
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
            <DocumentUploadDialog
                open={isUploadDialogOpen}
                onOpenChange={handleDialogOpenChange}
                documents={uploadedDocuments}
                onDocumentsChange={handleDocumentsChange}
            />
        </>
    );
};
