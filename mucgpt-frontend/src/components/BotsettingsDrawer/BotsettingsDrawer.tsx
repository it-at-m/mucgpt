import {
    Delete24Regular,
    Dismiss24Regular,
    Edit24Regular,
    ChatSettings24Regular,
    Checkmark24Filled,
    CloudArrowUp24Filled,
    ChevronDown20Regular,
    ChevronRight20Regular,
    Settings24Regular,
    ChatAdd24Regular,
    ChevronDoubleRight20Regular,
    ChevronDoubleLeft20Regular
} from "@fluentui/react-icons";
import { Button, Tooltip, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger } from "@fluentui/react-components";

import styles from "./BotsettingsDrawer.module.css";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Sidebar } from "../Sidebar/Sidebar";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { Bot, deleteCommunityAssistantApi } from "../../api";
import { EditBotDialog } from "../EditBotDialog/EditBotDialog";
import PublishBotDialog from "../PublishBotDialog/PublishBotDialog";
import { BotStorageService } from "../../service/botstorage";
import { BOT_STORE } from "../../constants";
import { Collapse } from "@fluentui/react-motion-components-preview";

interface Props {
    bot: Bot;
    onBotChange: (bot: Bot) => void;
    onDeleteBot: () => void;
    history: ReactNode;
    minimized: boolean;
    clearChat: () => void;
    clearChatDisabled: boolean;
    isOwned?: boolean;
    onToggleMinimized?: () => void;
}

export const BotsettingsDrawer = ({ bot, onBotChange, onDeleteBot, history, minimized, isOwned, clearChat, clearChatDisabled, onToggleMinimized }: Props) => {
    const { t } = useTranslation();

    const [description, setDescription] = useState<string>(bot.description);
    const [publish, setPublish] = useState<boolean>(bot.publish);
    const [isOwner, setIsOwner] = useState<boolean>(isOwned || !publish);
    const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
    const [showPublishDialog, setShowPublishDialog] = useState<boolean>(false);
    const [publishDepartments, setPublishDepartments] = useState<string[]>([]);
    const [invisibleChecked, setInvisibleChecked] = useState<boolean>(false);
    const [showEditDialog, setShowEditDialog] = useState<boolean>(false);
    const [isActionsExpanded, setIsActionsExpanded] = useState<boolean>(false);

    const storageService: BotStorageService = new BotStorageService(BOT_STORE);

    useEffect(() => {
        setDescription(bot.description);
        setPublish(bot.publish);
        setIsOwner(isOwned || !bot.publish);
    }, [bot, isOwned]);

    // Toggle read-only mode
    const toggleEditDialog = useCallback(() => {
        setShowEditDialog(!showEditDialog);
    }, [showEditDialog]);

    // Toggle actions section visibility
    const toggleActionsVisibility = useCallback(() => {
        setIsActionsExpanded(!isActionsExpanded);
    }, [isActionsExpanded]);

    const saveLocal = useCallback(async () => {
        if (!bot.id) return;
        const updatedBot: Bot = {
            ...bot,
            publish: false
        };
        await deleteCommunityAssistantApi(bot.id);
        await storageService.createBotConfig(updatedBot);
        window.location.href = "/#/";
        window.location.reload();
    }, [bot, storageService, bot.id]);

    // Delete bot confirmation dialog
    const deleteDialog = useMemo(
        () => (
            <Dialog modalType="alert" open={showDeleteDialog}>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle>
                            {publish ? t("components.botsettingsdrawer.unpublish-button") : t("components.botsettingsdrawer.deleteDialog.title")}
                        </DialogTitle>
                        <DialogContent>
                            {publish ? t("components.botsettingsdrawer.deleteDialog.unpublish") : t("components.botsettingsdrawer.deleteDialog.content")}
                        </DialogContent>
                        <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" size="small" onClick={() => setShowDeleteDialog(false)}>
                                    <Dismiss24Regular /> {t("components.botsettingsdrawer.deleteDialog.cancel")}
                                </Button>
                            </DialogTrigger>
                            <DialogTrigger disableButtonEnhancement>
                                <Button
                                    appearance="secondary"
                                    size="small"
                                    onClick={async () => {
                                        setShowDeleteDialog(false);
                                        if (publish) {
                                            await saveLocal();
                                        } else {
                                            onDeleteBot();
                                        }
                                    }}
                                >
                                    <Checkmark24Filled /> {t("components.botsettingsdrawer.deleteDialog.confirm")}
                                </Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        ),
        [showDeleteDialog, onDeleteBot, publish, t, saveLocal]
    );

    // actions component
    const actions_component = useMemo(
        () => (
            <Tooltip
                content={minimized ? t("components.botsettingsdrawer.expand") : t("components.botsettingsdrawer.collapse")}
                relationship="description"
                positioning="below"
            >
                <Button
                    appearance="subtle"
                    icon={minimized ? <ChevronDoubleRight20Regular /> : <ChevronDoubleLeft20Regular />}
                    onClick={onToggleMinimized}
                    className={styles.collapseButton}
                    aria-label={minimized ? t("components.botsettingsdrawer.expand") : t("components.botsettingsdrawer.collapse")}
                />
            </Tooltip>
        ),
        [minimized, t, onToggleMinimized]
    );

    // Publish dialog
    const publishDialog = useMemo(
        () => (
            <PublishBotDialog
                open={showPublishDialog}
                setOpen={setShowPublishDialog}
                bot={bot}
                invisibleChecked={invisibleChecked}
                setInvisibleChecked={setInvisibleChecked}
                onDeleteBot={onDeleteBot}
                publishDepartments={publishDepartments}
                setPublishDepartments={setPublishDepartments}
            />
        ),
        [showPublishDialog, setShowPublishDialog, bot, invisibleChecked, setInvisibleChecked, onDeleteBot, publishDepartments, setPublishDepartments]
    );

    // Edit bot dialog
    const editDialog = useMemo(
        () => (
            <EditBotDialog
                showDialog={showEditDialog}
                setShowDialog={setShowEditDialog}
                bot={bot}
                onBotChanged={onBotChange}
                isOwner={isOwner}
                publishDepartments={publishDepartments}
                setPublishDepartments={setPublishDepartments}
            />
        ),
        [showEditDialog, bot, onBotChange, isOwner, publishDepartments, setPublishDepartments]
    );

    // sidebar content
    const content = (
        <>
            <div className={styles.titleSection}>
                <h3 className={styles.botTitle}>{bot.title}</h3>
            </div>
            <div
                className={styles.actionsHeader}
                role="heading"
                aria-level={4}
                onClick={clearChat}
                aria-disabled={clearChatDisabled}
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && clearChat()}
            >
                <div className={styles.newChatHeaderContent}>
                    <ChatAdd24Regular className={styles.actionsIcon} aria-hidden="true" />
                    <span>New Chat</span>
                </div>
            </div>

            <div className={styles.descriptionSection}>
                <Markdown
                    className={styles.markdownDescription}
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        code: CodeBlockRenderer
                    }}
                >
                    {description}
                </Markdown>
            </div>

            <div className={styles.buttonSection}>
                <Button
                    appearance="primary"
                    icon={isOwner ? <Edit24Regular /> : <ChatSettings24Regular />}
                    onClick={toggleEditDialog}
                    className={styles.actionButton}
                >
                    {isOwner ? t("components.botsettingsdrawer.edit") : t("components.botsettingsdrawer.show_configutations")}
                </Button>
            </div>

            <div className={styles.historySection}>{history}</div>

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
                        <span>Aktionen</span>
                        <div className={styles.expandCollapseIcon}>{isActionsExpanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}</div>
                    </div>
                </div>

                <Collapse visible={isActionsExpanded}>
                    <div className={styles.actionsContent}>
                        <Tooltip content={t("components.botsettingsdrawer.delete")} relationship="description" positioning="below">
                            <Button
                                appearance="secondary"
                                onClick={() => setShowDeleteDialog(true)}
                                icon={<Delete24Regular />}
                                className={`${styles.actionButton} ${styles.deleteButton}`}
                            >
                                {publish ? t("components.botsettingsdrawer.unpublish-button") : t("components.botsettingsdrawer.delete")}
                            </Button>
                        </Tooltip>

                        {!publish && (
                            <Button
                                icon={<CloudArrowUp24Filled />}
                                onClick={() => setShowPublishDialog(true)}
                                appearance="outline"
                                className={styles.actionButton}
                            >
                                {t("components.botsettingsdrawer.publish")}
                            </Button>
                        )}
                    </div>
                </Collapse>
            </div>
            {publishDialog}
            {editDialog}
            {deleteDialog}
        </>
    );
    return <Sidebar actions={actions_component} content={content}></Sidebar>;
};
