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
import { Bot, createCommunityAssistantApi, deleteCommunityAssistantApi } from "../../api";
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

    // publish
    const onPublishClick = useCallback(async () => {
        await createCommunityAssistantApi({
            name: bot.title,
            description: bot.description,
            system_prompt: bot.system_message,
            temperature: bot.temperature,
            max_output_tokens: bot.max_output_tokens,
            tools: [],
            owner_ids: bot.owner_ids ? bot.owner_ids : ["0"],
            examples: bot.examples?.map(e => ({ text: e.text, value: e.value })),
            quick_prompts: bot.quick_prompts?.map(qp => ({ label: qp.label, prompt: qp.prompt, tooltip: qp.tooltip })),
            tags: bot.tags || [],
            hierarchical_access: invisibleChecked ? [] : publishDepartments || ["*"] // Default to all departments if none selected
        }).then(response => {
            const updatedBot: Bot = {
                title: response.latest_version.name,
                description: response.latest_version.description || "",
                system_message: response.latest_version.system_prompt,
                publish: true,
                id: response.id,
                temperature: response.latest_version.temperature,
                max_output_tokens: response.latest_version.max_output_tokens,
                examples: response.latest_version.examples || [],
                quick_prompts: response.latest_version.quick_prompts || [],
                version: response.latest_version.version.toString(),
                owner_ids: response.latest_version.owner_ids ? response.latest_version.owner_ids : undefined,
                tags: response.latest_version.tags || []
            };
            onBotChange(updatedBot);
            onDeleteBot(); // Remove the old bot
        });
        setShowPublishDialog(false);
    }, [bot, onBotChange, onDeleteBot, invisibleChecked, publishDepartments, createCommunityAssistantApi]);

    // Publish dialog
    const publishDialog = useMemo(
        () => (
            <PublishBotDialog
                open={showPublishDialog}
                setOpen={setShowPublishDialog}
                bot={bot}
                onPublishClick={onPublishClick}
                invisibleChecked={invisibleChecked}
                setInvisibleChecked={setInvisibleChecked}
                publishDepartments={publishDepartments}
                setPublishDepartments={setPublishDepartments}
            />
        ),
        [showPublishDialog, setShowPublishDialog, onPublishClick, bot, invisibleChecked, setInvisibleChecked, publishDepartments, setPublishDepartments]
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
