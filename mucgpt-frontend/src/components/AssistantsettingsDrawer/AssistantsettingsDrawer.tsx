import {
    Delete24Regular,
    Dismiss24Regular,
    Edit24Regular,
    ChatSettings24Regular,
    Checkmark24Filled,
    CloudArrowUp24Filled,
    ChevronDown20Regular,
    ChevronRight20Regular,
    Settings24Regular
} from "@fluentui/react-icons";
import { Button, Tooltip, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger } from "@fluentui/react-components";

import styles from "./AssistantsettingsDrawer.module.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { Assistant } from "../../api";
import { EditAssistantDialog } from "../EditAssistantDialog/EditAssistantDialog";
import PublishAssistantDialog from "../PublishAssistantDialog/PublishAssistantDialog";
import { AssistantStorageService } from "../../service/assistantstorage";
import { ASSISTANT_STORE } from "../../constants";
import { Collapse } from "@fluentui/react-motion-components-preview";
import { deleteCommunityAssistantApi } from "../../api/assistant-client";
import { AssistantStrategy, DeletedCommunityAssistantStrategy } from "../../pages/assistant/AssistantStrategy";
import rehypeKatex from "rehype-katex";
import rehypeExternalLinks from "rehype-external-links";

interface Props {
    assistant: Assistant;
    onAssistantChange: (assistant: Assistant) => void;
    onDeleteAssistant: () => void;
    isOwned?: boolean;
    strategy: AssistantStrategy;
}

export const AssistantsettingsDrawer = ({ assistant, onAssistantChange, onDeleteAssistant, isOwned, strategy }: Props) => {
    const { t } = useTranslation();

    const [description, setDescription] = useState<string>(assistant.description);
    const [publish, setPublish] = useState<boolean>(assistant.publish);
    const [isOwner, setIsOwner] = useState<boolean>(isOwned || !publish);
    const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
    const [showPublishDialog, setShowPublishDialog] = useState<boolean>(false);
    const [invisibleChecked, setInvisibleChecked] = useState<boolean>(!assistant.is_visible);
    const [showEditDialog, setShowEditDialog] = useState<boolean>(false);
    const [isActionsExpanded, setIsActionsExpanded] = useState<boolean>(false);

    const storageService: AssistantStorageService = new AssistantStorageService(ASSISTANT_STORE);

    useEffect(() => {
        setDescription(assistant.description);
        setPublish(assistant.publish);
        setIsOwner(isOwned || !assistant.publish);
        setInvisibleChecked(!assistant.is_visible);
    }, [assistant, isOwned]);

    // Toggle read-only mode
    const toggleEditDialog = useCallback(() => {
        setShowEditDialog(!showEditDialog);
    }, [showEditDialog]);

    // Toggle actions section visibility
    const toggleActionsVisibility = useCallback(() => {
        setIsActionsExpanded(!isActionsExpanded);
    }, [isActionsExpanded]);

    const saveLocal = useCallback(async () => {
        if (!assistant.id) return;
        const updatedAssistant: Assistant = {
            ...assistant,
            publish: false
        };
        await deleteCommunityAssistantApi(assistant.id);
        await storageService.createAssistantConfig(updatedAssistant, assistant.id);
        window.location.href = "/#/";
        window.location.reload();
    }, [assistant, storageService, assistant.id]);

    // Delete assistant confirmation dialog
    const deleteDialog = useMemo(
        () => (
            <Dialog modalType="alert" open={showDeleteDialog}>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle>
                            {publish
                                ? isOwner
                                    ? t("components.assistantsettingsdrawer.unpublish-button")
                                    : t("components.assistantsettingsdrawer.remove-assistant")
                                : t("components.assistantsettingsdrawer.deleteDialog.title")}
                        </DialogTitle>
                        <DialogContent>
                            {publish
                                ? isOwner
                                    ? t("components.assistantsettingsdrawer.deleteDialog.unpublish")
                                    : t("components.assistantsettingsdrawer.deleteDialog.remove")
                                : t("components.assistantsettingsdrawer.deleteDialog.content")}
                        </DialogContent>
                        <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" size="small" onClick={() => setShowDeleteDialog(false)}>
                                    <Dismiss24Regular /> {t("components.assistantsettingsdrawer.deleteDialog.cancel")}
                                </Button>
                            </DialogTrigger>
                            <DialogTrigger disableButtonEnhancement>
                                <Button
                                    appearance="secondary"
                                    size="small"
                                    onClick={async () => {
                                        setShowDeleteDialog(false);
                                        if (publish && isOwner) {
                                            await saveLocal();
                                        } else {
                                            onDeleteAssistant();
                                        }
                                    }}
                                >
                                    <Checkmark24Filled /> {t("components.assistantsettingsdrawer.deleteDialog.confirm")}
                                </Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        ),
        [showDeleteDialog, onDeleteAssistant, publish, t, saveLocal]
    );

    // Publish dialog
    const publishDialog = useMemo(
        () => (
            <PublishAssistantDialog
                open={showPublishDialog}
                setOpen={setShowPublishDialog}
                assistant={assistant}
                invisibleChecked={invisibleChecked}
                setInvisibleChecked={setInvisibleChecked}
                onDeleteAssistant={onDeleteAssistant}
            />
        ),
        [showPublishDialog, setShowPublishDialog, assistant, invisibleChecked, setInvisibleChecked, onDeleteAssistant]
    );

    // Edit assistant dialog
    const editDialog = useMemo(
        () => (
            <EditAssistantDialog
                showDialog={showEditDialog}
                setShowDialog={setShowEditDialog}
                assistant={assistant}
                onAssistantChanged={onAssistantChange}
                isOwner={isOwner}
                strategy={strategy}
            />
        ),
        [showEditDialog, assistant, onAssistantChange, isOwner, strategy]
    );
    const rehypeKatexOptions = {
        output: "mathml"
    };
    const rehypeExternalLinksOptions = {
        target: "_blank",
        rel: ["nofollow", "noopener", "noreferrer"]
    };
    // sidebar content
    return (
        <>
            {publishDialog}
            {editDialog}
            {deleteDialog}
            <div className={styles.titleSection}>
                <h3 className={styles.assistantTitle}>{assistant.title}</h3>
            </div>
            {strategy instanceof DeletedCommunityAssistantStrategy && (
                <div className={styles.deletedWarning}>{t("components.assistantsettingsdrawer.deleted_warning")}</div>
            )}

            <div className={styles.descriptionSection}>
                <div className={styles.markdownDescription}>
                    <Markdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[
                            [rehypeKatex, rehypeKatexOptions],
                            [rehypeExternalLinks, rehypeExternalLinksOptions]
                        ]}
                        components={{
                            code: CodeBlockRenderer
                        }}
                    >
                        {description}
                    </Markdown>
                </div>
            </div>

            <div className={styles.actionsSection}>
                <div
                    className={styles.actionsHeader}
                    role="heading"
                    aria-level={4}
                    onClick={toggleActionsVisibility}
                    tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && toggleActionsVisibility()}
                    aria-expanded={isActionsExpanded}
                >
                    <div className={styles.actionsHeaderContent}>
                        <Settings24Regular className={styles.actionsIcon} aria-hidden="true" />
                        <span>{t("components.assistant_chat.actions")}</span>
                        <div className={styles.expandCollapseIcon}>{isActionsExpanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}</div>
                    </div>
                </div>

                <Collapse visible={isActionsExpanded}>
                    <div className={styles.actionsContent}>
                        <Button
                            appearance="primary"
                            icon={isOwner ? <Edit24Regular /> : <ChatSettings24Regular />}
                            onClick={toggleEditDialog}
                            className={styles.actionButton}
                            disabled={strategy instanceof DeletedCommunityAssistantStrategy}
                        >
                            {isOwner ? t("components.assistantsettingsdrawer.edit") : t("components.assistantsettingsdrawer.show_configutations")}
                        </Button>
                        <Tooltip content={t("components.assistantsettingsdrawer.delete")} relationship="description" positioning="below">
                            <Button
                                appearance="secondary"
                                onClick={() => setShowDeleteDialog(true)}
                                icon={<Delete24Regular />}
                                className={`${styles.actionButton} ${styles.deleteButton}`}
                            >
                                {publish
                                    ? isOwner
                                        ? t("components.assistantsettingsdrawer.unpublish-button")
                                        : t("components.assistantsettingsdrawer.remove-assistant")
                                    : t("components.assistantsettingsdrawer.delete")}
                            </Button>
                        </Tooltip>

                        {!publish && (
                            <Button
                                icon={<CloudArrowUp24Filled />}
                                onClick={() => setShowPublishDialog(true)}
                                appearance="outline"
                                className={`${styles.actionButton} ${styles.publishButton}`}
                            >
                                {t("components.assistantsettingsdrawer.publish")}
                            </Button>
                        )}
                    </div>
                </Collapse>
            </div>
        </>
    );
};
