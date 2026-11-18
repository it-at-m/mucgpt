import { Overflow, OverflowItem, Tooltip, mergeClasses, useOverflowMenu } from "@fluentui/react-components";
import { ArrowClockwise16Regular, Dismiss16Regular, ErrorCircle16Regular, Warning16Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { Button } from "../../ui/Button";
import { EdelweissSpinner } from "../EdelweissSpinner";
import styles from "./DocumentChips.module.css";
import { DocumentTypeIcon } from "./DocumentTypeIcon";
import type { ChatDocument } from "./documentSelection";

interface Props {
    documents: ChatDocument[];
    onRemove: (id: string) => void;
    onRetry: (id: string) => void;
    /** Receives focus when a chip action removes the focused button and no other chip can take it. */
    onFocusLeave: () => void;
    disabled?: boolean;
}

const StatusIcon = ({ document }: { document: ChatDocument }) => {
    switch (document.status) {
        case "uploading":
            return <EdelweissSpinner size="extra-small" labelPosition="after" />;
        case "failed":
            return <ErrorCircle16Regular />;
        case "unavailable":
            return <Warning16Regular />;
        case "ready":
            return <DocumentTypeIcon filename={document.name} />;
    }
};

const getStatusText = (document: ChatDocument, t: TFunction) => {
    switch (document.status) {
        case "uploading":
            return t("document_library.chip_processing");
        case "failed":
            return document.errorMessage;
        case "unavailable":
            return t("document_library.chip_unavailable");
        case "ready":
            return undefined;
    }
};

const ShowMoreChip = ({ onClick, buttonRef }: { onClick: () => void; buttonRef: Ref<HTMLButtonElement> }) => {
    const { t } = useTranslation();
    const { ref, isOverflowing, overflowCount } = useOverflowMenu<HTMLLIElement>();

    if (!isOverflowing) return null;

    return (
        <li ref={ref} className={styles.toggleItem}>
            <button
                ref={buttonRef}
                type="button"
                className={styles.toggle}
                aria-label={t("document_library.chips_show_more", { count: overflowCount })}
                onClick={onClick}
            >
                +{overflowCount}
            </button>
        </li>
    );
};

export const DocumentChips = ({ documents, onRemove, onRetry, onFocusLeave, disabled = false }: Props) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const listRef = useRef<HTMLUListElement>(null);
    const focusCandidatesRef = useRef<string[] | null>(null);
    const shouldFocusToggleRef = useRef(false);

    // Removing or retrying a document unmounts the focused button, so focus moves to the nearest chip that still has one.
    useEffect(() => {
        const candidates = focusCandidatesRef.current;
        if (!candidates) return;
        focusCandidatesRef.current = null;

        const slots = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-document-id]") ?? []);
        for (const id of candidates) {
            const button = slots.find(slot => slot.dataset.documentId === id)?.querySelector("button");
            button?.focus();
            if (button && button === document.activeElement) return;
        }
        onFocusLeave();
    }, [documents, onFocusLeave]);

    const focusToggleOnMount = useCallback((button: HTMLButtonElement | null) => {
        if (!button || !shouldFocusToggleRef.current) return;
        shouldFocusToggleRef.current = false;
        button.focus();
    }, []);

    // A new set of documents (e.g. after a fresh chat) starts collapsed again.
    if (documents.length === 0 && isExpanded) setIsExpanded(false);
    if (documents.length === 0) return null;

    const runChipAction = (id: string, action: (id: string) => void) => {
        const index = documents.findIndex(document => document.id === id);
        focusCandidatesRef.current = [...documents.slice(index), ...documents.slice(0, index).reverse()].map(document => document.id);
        action(id);
    };

    const toggleExpanded = (expanded: boolean) => {
        shouldFocusToggleRef.current = true;
        setIsExpanded(expanded);
    };

    const renderChip = (document: ChatDocument) => {
        const statusText = getStatusText(document, t);
        // Removing a document the agent may already have read only stops future reads.
        const stopsFutureUse = document.status === "ready" && document.usedInChat;
        const removeLabel = t(stopsFutureUse ? "document_library.chip_stop_using" : "document_library.remove", { name: document.name });

        return (
            <li key={document.id} className={styles.chipSlot} data-document-id={document.id}>
                <div className={styles.chip} data-status={document.status}>
                    <span className={styles.icon} aria-hidden="true">
                        <StatusIcon document={document} />
                    </span>
                    <span className={styles.name} title={document.name}>
                        {document.name}
                    </span>
                    {statusText && (
                        <span className={styles.status} title={statusText}>
                            {statusText}
                        </span>
                    )}
                    {document.status === "failed" && (
                        <Tooltip content={t("document_library.retry_upload", { name: document.name })} relationship="label" positioning="above">
                            <Button
                                appearance="transparent"
                                size="small"
                                icon={<ArrowClockwise16Regular />}
                                disabled={disabled}
                                onClick={() => runChipAction(document.id, onRetry)}
                            />
                        </Tooltip>
                    )}
                    {document.status !== "uploading" && (
                        <Tooltip
                            content={stopsFutureUse ? t("document_library.chip_stop_using_hint") : removeLabel}
                            relationship={stopsFutureUse ? "description" : "label"}
                            positioning="above"
                        >
                            <Button
                                appearance="transparent"
                                size="small"
                                icon={<Dismiss16Regular />}
                                aria-label={removeLabel}
                                disabled={disabled}
                                onClick={() => runChipAction(document.id, onRemove)}
                            />
                        </Tooltip>
                    )}
                </div>
            </li>
        );
    };

    if (isExpanded) {
        return (
            <ul ref={listRef} className={mergeClasses(styles.chips, styles.expanded)} aria-label={t("document_library.chips_label")}>
                {documents.map(renderChip)}
                <li className={styles.toggleItem}>
                    <button ref={focusToggleOnMount} type="button" className={styles.toggle} onClick={() => toggleExpanded(false)}>
                        {t("document_library.chips_show_less")}
                    </button>
                </li>
            </ul>
        );
    }

    return (
        <Overflow>
            <ul ref={listRef} className={styles.chips} aria-label={t("document_library.chips_label")}>
                {documents.map(document => (
                    // Chips that need attention stay visible when the row overflows.
                    <OverflowItem key={document.id} id={document.id} priority={document.status === "ready" ? 0 : 1}>
                        {renderChip(document)}
                    </OverflowItem>
                ))}
                <ShowMoreChip onClick={() => toggleExpanded(true)} buttonRef={focusToggleOnMount} />
            </ul>
        </Overflow>
    );
};
