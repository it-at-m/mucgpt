import { Menu, MenuDivider, MenuList, MenuPopover, MenuTrigger, Tooltip, makeStyles, typographyStyles, type MenuProps } from "@fluentui/react-components";
import { Add20Regular, ArrowUpload20Regular, DocumentMultiple20Regular, Settings20Regular } from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { listDocumentsApi } from "../../api/documents-client";
import type { DocumentLibraryEntry } from "../../api/models";
import { getStoredParsedDocuments } from "../../service/parsedDocumentStorage";
import { Button } from "../../ui/Button";
import { MenuItem, MenuItemCheckbox, MenuItemLink } from "../../ui/MenuItem";
import styles from "./DocumentAttachMenu.module.css";
import { DocumentTypeIcon } from "./DocumentTypeIcon";
import { DOCUMENT_LIBRARY_LIMIT, getLibraryStatusKey, isLibraryDocument, type ChatDocument } from "./documentSelection";
import { useFilePicker } from "./useFilePicker";

interface Props {
    /** Documents currently attached to the chat. */
    documents: ChatDocument[];
    onToggleDocument: (document: DocumentLibraryEntry, attach: boolean) => void;
    onUploadFiles: (files: File[]) => void;
    disabled?: boolean;
}

const DOCUMENTS_GROUP = "documents";

// Fluent renders sub text at 10px and lets the item content grow past the capped popover width;
// Griffel styles are needed to win over Fluent's own rules.
const useStyles = makeStyles({
    documentContent: {
        minWidth: 0
    },
    subText: typographyStyles.caption1
});

type LibraryState = { status: "loading" } | { status: "error" } | { status: "ready"; documents: DocumentLibraryEntry[] };

const getStatusNoteKey = (library: LibraryState, hasBrowserDocuments: boolean) => {
    if (library.status === "loading") return "document_library.menu_loading";
    if (library.status === "error") return "document_library.menu_load_failed";
    if (library.documents.length === 0 && !hasBrowserDocuments) return "document_library.menu_empty";
    return undefined;
};

export const DocumentAttachMenu = ({ documents: attachedDocuments, onToggleDocument, onUploadFiles, disabled = false }: Props) => {
    const { t } = useTranslation();
    const classes = useStyles();
    const { openFilePicker, inputProps } = useFilePicker(onUploadFiles);
    const [open, setOpen] = useState(false);
    const [isLibraryMenuOpen, setIsLibraryMenuOpen] = useState(false);
    const [library, setLibrary] = useState<LibraryState>({ status: "loading" });
    const libraryListRef = useRef<HTMLDivElement>(null);

    // The library changes through uploads and the documents page, so every opening reloads it.
    useEffect(() => {
        if (!open) return;
        let isCurrent = true;
        setLibrary({ status: "loading" });
        listDocumentsApi()
            .then(documents => {
                if (isCurrent) setLibrary({ status: "ready", documents });
            })
            .catch(error => {
                console.error("Failed to load the document library:", error);
                if (isCurrent) setLibrary({ status: "error" });
            });
        return () => {
            isCurrent = false;
        };
    }, [open]);

    // The focused loading item is replaced once the library arrives, which would drop keyboard focus to the page.
    useEffect(() => {
        if (library.status === "loading" || !isLibraryMenuOpen || document.activeElement !== document.body) return;
        libraryListRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    }, [library.status, isLibraryMenuOpen]);

    const documents = library.status === "ready" ? library.documents : [];
    const attachedIds = attachedDocuments.filter(isLibraryDocument).map(document => document.id);
    const isLibraryFull = library.status === "ready" && documents.length >= DOCUMENT_LIBRARY_LIMIT;
    const usage = { used: documents.length, limit: DOCUMENT_LIBRARY_LIMIT };
    // Documents from the old browser-only storage cannot be attached directly; they must be moved on the documents page first.
    const hasBrowserDocuments = open && getStoredParsedDocuments().length > 0;
    const statusNoteKey = getStatusNoteKey(library, hasBrowserDocuments);

    const handleCheckedValueChange: MenuProps["onCheckedValueChange"] = (_, { checkedItems }) => {
        for (const document of documents) {
            const wasAttached = attachedIds.includes(document.id);
            const isAttached = checkedItems.includes(document.id);
            if (wasAttached !== isAttached) onToggleDocument(document, isAttached);
        }
    };

    const handleMenuOpenChange: MenuProps["onOpenChange"] = (_, { open: isOpen }) => {
        setOpen(isOpen);
        if (!isOpen) setIsLibraryMenuOpen(false);
    };

    // Hovering already opens the submenu, so a click on its trigger must not toggle it closed again.
    const handleLibraryMenuOpenChange: MenuProps["onOpenChange"] = (_, menuData) => {
        if (!menuData.open && menuData.type === "menuTriggerClick") return;
        setIsLibraryMenuOpen(menuData.open);
    };

    const title = t("document_library.menu_trigger");

    return (
        <>
            <Menu open={open} onOpenChange={handleMenuOpenChange} positioning={{ position: "above", align: "start", offset: 8 }}>
                <MenuTrigger disableButtonEnhancement>
                    <Tooltip content={title} relationship="label" positioning="below">
                        <Button appearance="subtle" icon={<Add20Regular />} disabled={disabled} />
                    </Tooltip>
                </MenuTrigger>
                <MenuPopover>
                    <MenuList>
                        <MenuItem
                            icon={<ArrowUpload20Regular />}
                            disabled={isLibraryFull}
                            secondaryContent={isLibraryFull ? t("document_library.limit_reached") : undefined}
                            onClick={openFilePicker}
                        >
                            {t("document_library.upload_file")}
                        </MenuItem>
                        <Menu
                            open={isLibraryMenuOpen}
                            onOpenChange={handleLibraryMenuOpenChange}
                            checkedValues={{ [DOCUMENTS_GROUP]: attachedIds }}
                            onCheckedValueChange={handleCheckedValueChange}
                            positioning={{ position: "after", align: "top", offset: { mainAxis: 4, crossAxis: -4 } }}
                        >
                            <MenuTrigger disableButtonEnhancement>
                                <MenuItem icon={<DocumentMultiple20Regular />}>{t("document_library.select_from_library")}</MenuItem>
                            </MenuTrigger>
                            <MenuPopover>
                                <MenuList ref={libraryListRef}>
                                    {documents.map(document => {
                                        const statusKey = getLibraryStatusKey(document.status);
                                        return (
                                            <MenuItemCheckbox
                                                key={document.id}
                                                name={DOCUMENTS_GROUP}
                                                icon={<DocumentTypeIcon filename={document.filename} size={20} />}
                                                value={document.id}
                                                disabled={document.status !== "ready" && !attachedIds.includes(document.id)}
                                                content={{ className: classes.documentContent }}
                                                subText={statusKey ? { children: t(statusKey), className: classes.subText } : undefined}
                                            >
                                                <span className={styles.documentName}>{document.filename}</span>
                                            </MenuItemCheckbox>
                                        );
                                    })}
                                    {/* Notes are disabled menu items because a menu may only contain items, and only items are reachable and announced. */}
                                    {statusNoteKey && <MenuItem disabled>{t(statusNoteKey)}</MenuItem>}
                                    {hasBrowserDocuments && <MenuItem disabled>{t("document_library.menu_browser_documents_hint")}</MenuItem>}
                                    <MenuDivider />
                                    <MenuItemLink
                                        href="#/documents"
                                        icon={<Settings20Regular />}
                                        secondaryContent={library.status === "ready" ? t("document_library.usage", usage) : undefined}
                                    >
                                        {t("document_library.manage")}
                                    </MenuItemLink>
                                </MenuList>
                            </MenuPopover>
                        </Menu>
                    </MenuList>
                </MenuPopover>
            </Menu>
            <input {...inputProps} aria-label={t("document_library.upload_file")} />
        </>
    );
};
