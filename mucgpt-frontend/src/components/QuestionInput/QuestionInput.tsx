import { Button, mergeClasses, Spinner, Tooltip } from "@fluentui/react-components";
import { Add20Regular, ArrowUp20Regular, Dismiss16Regular, Image20Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type Dispatch, type MouseEvent, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import styles from "./QuestionInput.module.css";
import { useAutoGrowTextarea } from "./useAutoGrowTextarea";
import { Button as SubtleButton } from "../../ui/Button";
import { uploadDocumentApi } from "../../api/documents-client";
import { imageContentUrl, uploadImageApi } from "../../api/core-client";
import { ImageAttachment, Model, ToolListResponse } from "../../api/models";
import { useConfigContext } from "../../context/ConfigContext";
import { documentToUploadedData } from "../ContextManagerDialog/DocumentLibrary";
import { ContextManagerDialog, UploadedData, createUploadedData, getDataSignature, getFileSignature } from "../ContextManagerDialog/ContextManagerDialog";
import { ChatDisclaimer } from "../ChatDisclaimer";
import { ChatToolSelector } from "../ChatToolSelector/ChatToolSelector";
import { ChatUsageIndicator, type ChatUsageSummary } from "../ChatUsageIndicator/ChatUsageIndicator";
import { ChatUsageMessageBar } from "../ChatUsageIndicator/ChatUsageMessageBar";
import { LLMSelector } from "../LLMSelector/LLMSelector";
import { getContextUsagePercent, getUsageCriticalThreshold, getUsageWarningThreshold } from "../ChatUsageIndicator/chatUsage";
import { MicrophoneButton } from "../MicrophoneButton/MicrophoneButton";
import { useTranscription } from "../Transcription/TranscriptionContext";
import { classifyFiles, formatMaxBytes, pastedImageFilename, resolveImageInput, type RejectionReason } from "../../utils/imageAttachments";

export type { ChatUsageSummary } from "../ChatUsageIndicator/ChatUsageIndicator";

interface Props {
    onSend: (question: string, data: UploadedData[], images?: ImageAttachment[]) => void;
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
    /** Ready attachments seeded once (e.g. restored from the Home handoff). */
    initialImages?: ImageAttachment[];
}

/** One staged image in the composer; only ready drafts are sendable. */
type ImageDraft = {
    id: string;
    filename: string;
    status: "uploading" | "ready" | "error";
    errorMessage?: string;
    /** Local object URL for preview; revoked on removal, replacement, and unmount. */
    previewUrl: string;
    attachment?: ImageAttachment;
};

type ImageFeedback = { key: string; params?: Record<string, unknown> };

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
    transcriptionDisabled = false,
    usage,
    onStartNewChat,
    usageConversationKey,
    hideDisclaimer = false,
    llmOptions,
    selectedLLM,
    onLLMSelectionChange,
    llmLockedByAssistant,
    initialImages
}: Props) => {
    const { t } = useTranslation();
    const config = useConfigContext();
    const { enabled: transcriptionEnabled, status: transcriptionStatus } = useTranscription();
    const allowFileUpload = allowFileUploadProp ?? config.document_processing_enabled;
    const allowTranscription = transcriptionEnabled;
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
    const isTranscriptionActive = transcriptionStatus === "recording" || transcriptionStatus === "transcribing";

    // Image drafts live entirely in the composer; only ready attachments leave
    // it via onSend. IndexedDB never sees blobs, base64, or object URLs.
    const [imageDrafts, setImageDrafts] = useState<ImageDraft[]>([]);
    const imageDraftsRef = useRef<ImageDraft[]>([]);
    const [imageFeedback, setImageFeedback] = useState<ImageFeedback | null>(null);
    const imageFileInputRef = useRef<HTMLInputElement | null>(null);
    const questionValueRef = useRef(question);

    const draftStorageKey = draftCacheKey ? `question-input-draft:${draftCacheKey}` : undefined;

    const uploadedData = externalUploadedData ?? internalUploadedData;
    const activeDocumentCount = uploadedData.filter(data => data.isActive !== false).length;
    const hasSendableQuestion = question.trim().length > 0;

    const imageInput = resolveImageInput(config);
    const selectedModel = llmOptions?.find(model => model.id === selectedLLM);
    const supportsImages = imageInput.enabled && selectedModel?.supports_vision === true;
    const hasImageDrafts = imageDrafts.length > 0;
    const hasPendingImageUploads = imageDrafts.some(draft => draft.status === "uploading");
    const hasFailedImageUploads = imageDrafts.some(draft => draft.status === "error");
    // Block sending while uploads are in flight/failed or staged images would
    // be silently dropped by a non-vision selection; never strip visual context.
    const isSendBlockedByImages = hasPendingImageUploads || hasFailedImageUploads || (hasImageDrafts && !supportsImages);
    const isSendDisabled = disabled || isTranscriptionActive || !hasSendableQuestion || isSendBlockedByImages;
    const imageAccept = imageInput.allowed_mime_types.join(",");

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

    useEffect(() => {
        imageDraftsRef.current = imageDrafts;
    }, [imageDrafts]);

    useEffect(() => {
        questionValueRef.current = question;
    }, [question]);

    // Seed restored attachments once; consumed as ready drafts so the send
    // flow and staged-image guards treat them like freshly uploaded images.
    const consumedInitialImagesRef = useRef<ImageAttachment[] | undefined>(undefined);
    useEffect(() => {
        if (!initialImages || initialImages.length === 0) {
            return;
        }
        if (consumedInitialImagesRef.current === initialImages) {
            return;
        }
        consumedInitialImagesRef.current = initialImages;
        setImageDrafts(
            initialImages.map(attachment => ({
                id: attachment.id,
                filename: attachment.filename ?? "image",
                status: "ready" as const,
                previewUrl: attachment.displayUrl,
                attachment
            }))
        );
    }, [initialImages]);

    // Revoke local preview object URLs so they never outlive the composer.
    const revokeImagePreviews = useCallback((drafts: ImageDraft[]) => {
        drafts.forEach(draft => {
            if (draft.previewUrl) {
                try {
                    URL.revokeObjectURL(draft.previewUrl);
                } catch {
                    // Ignore revoke errors; the browser cleans up eventually.
                }
            }
        });
    }, []);

    useEffect(() => {
        return () => {
            revokeImagePreviews(imageDraftsRef.current);
        };
    }, [revokeImagePreviews]);

    const removeImageDraft = useCallback(
        (draftId: string) => {
            const draft = imageDraftsRef.current.find(candidate => candidate.id === draftId);
            if (draft) {
                revokeImagePreviews([draft]);
            }
            setImageDrafts(previous => previous.filter(candidate => candidate.id !== draftId));
        },
        [revokeImagePreviews]
    );

    const clearImageDrafts = useCallback(() => {
        revokeImagePreviews(imageDraftsRef.current);
        setImageDrafts([]);
        setImageFeedback(null);
    }, [revokeImagePreviews]);

    const showImageFeedback = useCallback((key: string, params?: Record<string, unknown>) => {
        setImageFeedback({ key, params });
    }, []);

    const showImageRejectionFeedback = useCallback(
        (reason: RejectionReason, filename?: string) => {
            if (reason === "too-large") {
                showImageFeedback("components.questioninput.image_too_large", {
                    limit: formatMaxBytes(imageInput.max_upload_bytes)
                });
            } else if (reason === "image-disabled") {
                showImageFeedback("components.questioninput.image_disabled_hint");
            } else {
                showImageFeedback("components.questioninput.image_unsupported_format", { filename });
            }
        },
        [imageInput.max_upload_bytes, showImageFeedback]
    );

    const appendImagesFromFiles = useCallback(
        (files: File[]) => {
            if (files.length === 0) {
                return;
            }

            const remaining = imageInput.max_images_per_message - imageDraftsRef.current.length;
            if (remaining <= 0) {
                showImageFeedback("components.questioninput.image_too_many", {
                    count: imageInput.max_images_per_message
                });
                return;
            }
            let accepted = files;
            if (files.length > remaining) {
                accepted = files.slice(0, remaining);
                showImageFeedback("components.questioninput.image_too_many", {
                    count: imageInput.max_images_per_message
                });
            }

            const newDrafts: ImageDraft[] = accepted.map(file => ({
                id: crypto.randomUUID(),
                filename: file.name,
                status: "uploading" as const,
                previewUrl: URL.createObjectURL(file)
            }));

            setImageDrafts(previous => [...previous, ...newDrafts]);
            setImageFeedback(null);

            accepted.forEach((file, index) => {
                const draftId = newDrafts[index].id;
                uploadImageApi(file, selectedLLM!)
                    .then(upload => {
                        const attachment: ImageAttachment = {
                            id: upload.id,
                            displayUrl: imageContentUrl(upload.id),
                            filename: upload.filename,
                            mime_type: upload.mime_type,
                            size_bytes: upload.size_bytes,
                            width: upload.width,
                            height: upload.height
                        };
                        setImageDrafts(previous => previous.map(draft => (draft.id === draftId ? { ...draft, status: "ready" as const, attachment } : draft)));
                    })
                    .catch(error => {
                        console.error("Failed to upload image:", error);
                        setImageDrafts(previous =>
                            previous.map(draft =>
                                draft.id === draftId
                                    ? {
                                          ...draft,
                                          status: "error" as const,
                                          errorMessage: error.message || "Upload failed"
                                      }
                                    : draft
                            )
                        );
                    });
            });
        },
        [imageInput.max_images_per_message, selectedLLM, showImageFeedback]
    );

    /** Paste events must be consumed synchronously; uploads continue async. */
    const handlePaste = useCallback(
        (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
            if (disabled) {
                return;
            }
            const clipboard = event.clipboardData;
            const clipboardFiles = Array.from(clipboard?.files ?? []);
            const hasImageFile = clipboardFiles.some(file => file.type.startsWith("image/"));
            if (!hasImageFile) {
                return; // plain text (or no files): native paste
            }
            const text = clipboard?.getData("text/plain") ?? "";

            if (!supportsImages) {
                // Only hint for image-only pastes; a text paste that merely
                // carries a fallback image stays native.
                if (!text.trim()) {
                    event.preventDefault();
                    showImageFeedback("components.questioninput.image_disabled_hint");
                }
                return;
            }

            // Mixed text+image pastes keep both parts: consume the event,
            // insert the text manually, and route images to the upload pipeline.
            event.preventDefault();
            if (text) {
                const current = questionValueRef.current;
                setQuestionRef.current(current ? `${current}\n${text}` : text);
            }

            void (async () => {
                const classification = await classifyFiles(clipboardFiles, imageInput);
                if (classification.images.length > 0) {
                    // Pasted blobs have no usable name; generate unique ones.
                    const extensionByMime: Record<string, "png" | "jpeg" | "webp"> = {
                        "image/png": "png",
                        "image/jpeg": "jpeg",
                        "image/webp": "webp"
                    };
                    const named = classification.images.map(
                        file => new File([file], pastedImageFilename(extensionByMime[file.type] ?? "png"), { type: file.type })
                    );
                    appendImagesFromFiles(named);
                }
                if (classification.rejected.length > 0) {
                    const [first] = classification.rejected;
                    showImageRejectionFeedback(first.reason, first.file.name);
                }
            })();
        },
        [appendImagesFromFiles, disabled, imageInput, showImageFeedback, showImageRejectionFeedback, supportsImages]
    );

    const sendQuestion = useCallback(() => {
        if (disabled || !question.trim() || isSendBlockedByImages) {
            return;
        }

        const activeData = uploadedData.filter(data => data.isActive !== false);
        const readyAttachments = imageDrafts.filter(draft => draft.status === "ready" && draft.attachment).map(draft => draft.attachment!);
        onSend(question, activeData, readyAttachments.length > 0 ? readyAttachments : undefined);

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
        if (imageDrafts.length > 0) {
            clearImageDrafts();
        }
    }, [
        clearImageDrafts,
        clearOnSend,
        disabled,
        draftStorageKey,
        externalUploadedData,
        imageDrafts,
        isSendBlockedByImages,
        onDataChange,
        onSend,
        question,
        setQuestion,
        setUploadedData,
        uploadedData
    ]);

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

    const appendDocumentsFromFiles = useCallback(
        (files: File[]) => {
            if (files.length === 0) {
                return;
            }

            const previousData = uploadedDataRef.current;
            const existingSignatures = new Set(previousData.map(getDataSignature));
            const newData = files.filter(file => !existingSignatures.has(getFileSignature(file))).map(file => createUploadedData(file, "uploading"));

            if (newData.length === 0) {
                return;
            }

            const updatedData = [...previousData, ...newData];

            setUploadedData(updatedData);
            onDataChange?.(updatedData);

            newData.forEach(data => {
                const file = data.file;
                if (!file) return;
                uploadDocumentApi(file)
                    .then(document => {
                        const currentData = uploadedDataRef.current;
                        const nextData = currentData.map(currentItem => (currentItem.id === data.id ? documentToUploadedData(document) : currentItem));

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

    const handleImageButtonClick = useCallback(() => {
        if (!disabled && supportsImages) {
            imageFileInputRef.current?.click();
        }
    }, [disabled, supportsImages]);

    const handleImageSelected = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files ?? []);
            // Reset so selecting the same file again fires a change event.
            event.target.value = "";
            appendImagesFromFiles(files);
        },
        [appendImagesFromFiles]
    );

    const appendDataFromFiles = useCallback(
        async (files: FileList | File[]) => {
            const fileArray = Array.from(files ?? []);
            if (fileArray.length === 0) {
                return;
            }

            // Route by actual file signature: supported images go to the image
            // pipeline, everything else keeps the document pipeline, and
            // image-typed but unsupported files get an explicit rejection.
            const classification = await classifyFiles(fileArray, imageInput);
            if (classification.images.length > 0) {
                appendImagesFromFiles(classification.images);
            }
            if (classification.documents.length > 0) {
                appendDocumentsFromFiles(classification.documents);
            }
            if (classification.rejected.length > 0) {
                const [first] = classification.rejected;
                showImageRejectionFeedback(first.reason, first.file.name);
            }
        },
        [appendDocumentsFromFiles, appendImagesFromFiles, imageInput, showImageRejectionFeedback]
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
                    onDragEnter={allowFileUpload || supportsImages ? handleDragEnter : undefined}
                    onDragOver={allowFileUpload || supportsImages ? handleDragOver : undefined}
                    onDragLeave={allowFileUpload || supportsImages ? handleDragLeave : undefined}
                    onDrop={allowFileUpload || supportsImages ? handleDrop : undefined}
                >
                    {hasImageDrafts ? (
                        <div className={styles.imageStrip} role="list" aria-label={t("components.questioninput.attached_images", "Angehängte Bilder")}>
                            {imageDrafts.map(draft => (
                                <div
                                    key={draft.id}
                                    role="listitem"
                                    className={mergeClasses(styles.imageThumb, draft.status === "error" && styles.imageThumbError)}
                                >
                                    <img className={styles.imageThumbImage} src={draft.previewUrl} alt={draft.filename} />
                                    {draft.status === "uploading" ? (
                                        <span className={styles.imageThumbOverlay}>
                                            <Spinner size="extra-tiny" />
                                        </span>
                                    ) : null}
                                    <Tooltip
                                        positioning="above"
                                        content={
                                            draft.status === "error"
                                                ? t("components.questioninput.image_upload_failed", "Bild konnte nicht hochgeladen werden.")
                                                : draft.filename
                                        }
                                        relationship="label"
                                    >
                                        <Button
                                            className={styles.imageRemove}
                                            appearance="subtle"
                                            size="small"
                                            icon={<Dismiss16Regular />}
                                            aria-label={t("components.questioninput.remove_image", "Bild entfernen")}
                                            disabled={disabled}
                                            onClick={() => removeImageDraft(draft.id)}
                                        />
                                    </Tooltip>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {imageFeedback ? <div className={styles.imageFeedback}>{t(imageFeedback.key, imageFeedback.params ?? {})}</div> : null}
                    {hasImageDrafts && !supportsImages ? (
                        <div className={styles.imageFeedback}>
                            {t(
                                "components.questioninput.images_need_vision_model",
                                "Dieses Modell unterstützt keine Bilder. Wählen Sie ein vision-fähiges Modell aus, um Bilder zu senden."
                            )}
                        </div>
                    ) : null}

                    <textarea
                        ref={textareaRef}
                        className={styles.input}
                        rows={1}
                        placeholder={resolvedPlaceholder}
                        value={question}
                        onChange={onQuestionChange}
                        onKeyDown={onEnterPress}
                        onPaste={handlePaste}
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
                        {supportsImages ? (
                            <div className={styles.uploadAction}>
                                <Tooltip positioning={"below"} content={t("components.questioninput.add_image", "Bild hinzufügen")} relationship="label">
                                    <SubtleButton appearance="subtle" icon={<Image20Regular />} onClick={handleImageButtonClick} disabled={disabled} />
                                </Tooltip>
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
                        {llmOptions && selectedLLM && onLLMSelectionChange && (
                            <LLMSelector
                                onSelectionChange={onLLMSelectionChange}
                                selectedLLM={selectedLLM}
                                options={llmOptions}
                                lockedByAssistant={llmLockedByAssistant}
                            />
                        )}
                        {allowTranscription && !transcriptionDisabled && (
                            <MicrophoneButton
                                onRecordingStart={() => {
                                    recordingBaseRef.current = question;
                                }}
                                onLiveTranscription={text => {
                                    const full = recordingBaseRef.current ? `${recordingBaseRef.current} ${text}` : text;
                                    setQuestion(full);
                                    onTranscription?.(full);
                                }}
                                onTranscription={text => {
                                    const full = recordingBaseRef.current ? `${recordingBaseRef.current} ${text}` : text;
                                    setQuestion(full);
                                    onTranscription?.(full);
                                }}
                                disabled={disabled}
                            />
                        )}
                        <Tooltip positioning={"below"} content={t("components.questioninput.send_question", "Frage senden")} relationship="label">
                            <Button appearance="primary" icon={<ArrowUp20Regular />} disabled={isSendDisabled} onClick={sendQuestion} />
                        </Tooltip>
                    </div>
                </div>

                {supportsImages ? <input ref={imageFileInputRef} type="file" accept={imageAccept} multiple hidden onChange={handleImageSelected} /> : null}

                {hideDisclaimer ? null : <ChatDisclaimer className={styles.disclaimer} />}
            </div>

            {allowFileUpload ? (
                <ContextManagerDialog open={isUploadDialogOpen} onOpenChange={handleDialogOpenChange} data={uploadedData} onDataChange={handleDataChange} />
            ) : null}
        </>
    );
};
