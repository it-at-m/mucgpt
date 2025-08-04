import { Delete24Regular, Dismiss24Regular, Edit24Regular, ChatSettings24Regular, Checkmark24Filled, CloudArrowUp24Filled } from "@fluentui/react-icons";
import {
    Button,
    Label,
    Field,
    Tooltip,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Checkbox
} from "@fluentui/react-components";

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

interface Props {
    bot: Bot;
    onBotChange: (bot: Bot) => void;
    onDeleteBot: () => void;
    actions: ReactNode;
    before_content: ReactNode;
    minimized: boolean;
    isOwned?: boolean;
}

export const BotsettingsDrawer = ({ bot, onBotChange, onDeleteBot, actions, before_content, minimized, isOwned }: Props) => {
    const { t } = useTranslation();

    const [description, setDescription] = useState<string>(bot.description);
    const [publish, setPublish] = useState<boolean>(bot.publish);
    const [isOwner, setIsOwner] = useState<boolean>(isOwned || !publish);
    const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
    const [showPublishDialog, setShowPublishDialog] = useState<boolean>(false);
    const [publishDepartments, setPublishDepartments] = useState<string[]>([]);
    const [invisibleChecked, setInvisibleChecked] = useState<boolean>(false);
    const [showEditDialog, setShowEditDialog] = useState<boolean>(false);

    const storageService: BotStorageService = new BotStorageService(BOT_STORE);

    useEffect(() => {
        setDescription(bot.description);
        setPublish(bot.publish);
        setIsOwner(isOwned || !bot.publish);
    }, [bot, isOwned]);

    // Toggle read-only mode
    const toggleReadOnly = useCallback(() => {
        setShowEditDialog(!showEditDialog);
    }, [showEditDialog]);

    const saveLocal = useCallback(async () => {
        if (!bot.id) return;
        const updatedBot: Bot = {
            ...bot,
            publish: false,
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
                        <DialogTitle>{publish ? t("components.botsettingsdrawer.unpublish-button") : t("components.botsettingsdrawer.deleteDialog.title")}</DialogTitle>
                        <DialogContent>{publish ? t("components.botsettingsdrawer.deleteDialog.unpublish") : t("components.botsettingsdrawer.deleteDialog.content")}</DialogContent>
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
            <div>
                <div className={styles.actionRow}> {actions}</div>
                {!minimized && (
                    <div className={styles.actionRow}>
                        {deleteDialog}
                        <Button
                            appearance="secondary"
                            icon={isOwner ? <Edit24Regular className={styles.iconRightMargin} /> : <ChatSettings24Regular className={styles.iconRightMargin} />}
                            onClick={toggleReadOnly}
                        >
                            {isOwner ? t("components.botsettingsdrawer.edit") : t("components.botsettingsdrawer.show_configutations")}
                        </Button>
                        <Tooltip content={t("components.botsettingsdrawer.delete")} relationship="description" positioning="below">
                            <Button
                                appearance="secondary"
                                onClick={() => setShowDeleteDialog(true)}
                                icon={<Delete24Regular className={styles.iconRightMargin} />}
                            >
                                {publish ? t("components.botsettingsdrawer.unpublish-button") : t("components.botsettingsdrawer.delete")}
                            </Button>
                        </Tooltip>
                    </div>
                )}
            </div>
        ),
        [actions, isOwner, toggleReadOnly, t, deleteDialog, minimized, publish, setShowDeleteDialog]
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
        () => <EditBotDialog showDialog={showEditDialog} setShowDialog={setShowEditDialog} bot={bot} onBotChanged={onBotChange} isOwner={isOwner} publishDepartments={publishDepartments} setPublishDepartments={setPublishDepartments} />,
        [showEditDialog, bot, onBotChange, isOwner, publishDepartments, setPublishDepartments]
    );

    // sidebar content
    const content = (
        <>
            <>{before_content}</>{" "}
            <div className={styles.bodyContainer}>
                <div>
                    <Field size="large">
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
                    </Field>
                </div>
            </div>
            {!publish && (
                <Tooltip content={t("components.botsettingsdrawer.publish")} relationship="description" positioning="below">
                    <Button icon={<CloudArrowUp24Filled />} onClick={() => setShowPublishDialog(true)}>
                        {t("components.botsettingsdrawer.publish")}
                    </Button>
                </Tooltip>
            )}
            {publishDialog}
            {editDialog}
        </>
    );
    return <Sidebar actions={actions_component} content={content}></Sidebar>;
};
