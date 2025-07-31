import {
    Delete24Regular,
    Dismiss24Regular,
    Edit24Regular,
    Save24Regular,
    ChatSettings24Regular,
    Checkmark24Filled,
    CloudArrowUp24Filled
} from "@fluentui/react-icons";
import {
    Button,
    Slider,
    Label,
    useId,
    SliderProps,
    Field,
    InfoLabel,
    Tooltip,
    Textarea,
    TextareaOnChangeData,
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
import { ReactNode, SetStateAction, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Sidebar } from "../Sidebar/Sidebar";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { Bot, createCommunityAssistantApi } from "../../api";
import DepartmentDropdown from "../DepartementDropdown/DepartementDropdown";
import { EditBotDialog } from "../EditBotDialog/EditBotDialog";

interface Props {
    bot: Bot;
    onBotChange: (bot: Bot) => void;
    onDeleteBot: () => void;
    actions: ReactNode;
    before_content: ReactNode;
    onEditChange: (isEditable: boolean) => void;
    minimized: boolean;
    isOwned?: boolean;
}

export const BotsettingsDrawer = ({ bot, onBotChange, onDeleteBot, actions, before_content, onEditChange, minimized, isOwned }: Props) => {
    const { t } = useTranslation();

    const [description, setDescription] = useState<string>(bot.description);
    const [publish, setPublish] = useState<boolean>(bot.publish);
    const [isOwner, setIsOwner] = useState<boolean>(isOwned || !publish);
    const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
    const [showPublishDialog, setShowPublishDialog] = useState<boolean>(false);
    const [publishDepartments, setPublishDepartments] = useState<string[]>([]);
    const [invisibleChecked, setInvisibleChecked] = useState<boolean>(false);
    const [showEditDialog, setShowEditDialog] = useState<boolean>(false);

    useEffect(() => {
        setDescription(bot.description);
        setPublish(bot.publish);
        setIsOwner(isOwned || !bot.publish);
    }, [bot, isOwned]);

    // Toggle read-only mode
    const toggleReadOnly = useCallback(() => {
        setShowEditDialog(!showEditDialog);
    }, [showEditDialog]);

    // Delete bot confirmation dialog
    const deleteDialog = useMemo(
        () => (
            <Dialog modalType="alert" open={showDeleteDialog}>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle>{t("components.botsettingsdrawer.deleteDialog.title")}</DialogTitle>
                        <DialogContent>{t("components.botsettingsdrawer.deleteDialog.content")}</DialogContent>
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
                                    onClick={() => {
                                        setShowDeleteDialog(false);
                                        onDeleteBot();
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
        [showDeleteDialog, onDeleteBot]
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
                            icon={
                                isOwner ? (
                                    <Edit24Regular className={styles.iconRightMargin} />
                                ) : (
                                    <ChatSettings24Regular className={styles.iconRightMargin} />
                                )
                            }
                            onClick={toggleReadOnly}
                        >
                            {isOwner
                                ?
                                t("components.botsettingsdrawer.edit")
                                :
                                t("components.botsettingsdrawer.show_configutations")}
                        </Button>
                        <Tooltip content={t("components.botsettingsdrawer.delete")} relationship="description" positioning="below">
                            <Button
                                appearance="secondary"
                                onClick={() => setShowDeleteDialog(true)}
                                icon={<Delete24Regular className={styles.iconRightMargin} />}
                            >
                                {t("components.botsettingsdrawer.delete")}
                            </Button>
                        </Tooltip>
                    </div>
                )}
            </div >
        ),
        [actions, isOwner, toggleReadOnly, t, deleteDialog, minimized]
    );

    // publish
    const onPublishClick = useCallback(() => {
        createCommunityAssistantApi({
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

    const publishDialog = useMemo(
        () => (
            <Dialog modalType="alert" open={showPublishDialog}>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle>Bot veröffentlichen</DialogTitle>
                        <DialogContent>
                            Hinweise für das Veröffentlichen eines Bots:
                            <ul>
                                <li>Der Bot wird für alle Nutzer:innen im System sichtbar.</li>
                                <li>Der Bot kann von allen Nutzer:innen verwendet werden.</li>
                                <li>Die Veröffentlichung kann nicht rückgängig gemacht werden.</li>
                            </ul>
                            <Checkbox
                                label="unsichtbar veröffentlichen"
                                checked={invisibleChecked}
                                onChange={(_, data) => setInvisibleChecked(!!data.checked)}
                            />
                            <br />
                            {invisibleChecked && (
                                <>
                                    <Label htmlFor="publish-link" style={{ marginRight: 8 }}>
                                        Link zum Kopieren:
                                    </Label>
                                    <Tooltip content="In Zwischenablage kopieren" relationship="description" positioning="below">
                                        <Button
                                            id="publish-link"
                                            appearance="secondary"
                                            size="small"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/bot/${bot.id}`);
                                            }}
                                        >
                                            {`${window.location.origin}/bot/${bot.id}`}
                                        </Button>
                                    </Tooltip>
                                </>
                            )}
                            {!invisibleChecked && (
                                <>
                                    Veröffentlichen für
                                    <DepartmentDropdown publishDepartments={publishDepartments} setPublishDepartments={setPublishDepartments} />
                                </>
                            )}
                            <br />
                            Version: {bot.version}
                        </DialogContent>
                        <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" size="small" onClick={() => setShowPublishDialog(false)}>
                                    <Dismiss24Regular /> {t("components.botsettingsdrawer.deleteDialog.cancel")}
                                </Button>
                            </DialogTrigger>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" size="small" onClick={onPublishClick}>
                                    <Checkmark24Filled /> {t("components.botsettingsdrawer.deleteDialog.confirm")}
                                </Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        ),
        [showPublishDialog, publishDepartments, invisibleChecked]
    );

    const editDialog = useMemo(
        () => (
            <EditBotDialog
                showDialog={showEditDialog}
                setShowDialog={setShowEditDialog}
                bot={bot}
                onBotChanged={onBotChange}
                isOwner={isOwner}
            />
        ),
        [showEditDialog, bot, onBotChange, isOwner]
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
                <Tooltip content={"veröffentlichen"} relationship="description" positioning="below">
                    <Button icon={<CloudArrowUp24Filled />} onClick={() => setShowPublishDialog(true)}>
                        veröffentlichen
                    </Button>
                </Tooltip>
            )}
            {publishDialog}
            {editDialog}
        </>
    );
    return <Sidebar actions={actions_component} content={content}></Sidebar>;
};
