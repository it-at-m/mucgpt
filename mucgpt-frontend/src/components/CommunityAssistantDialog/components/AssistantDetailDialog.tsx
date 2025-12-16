import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Tooltip,
    Badge,
    Divider,
    Body1,
    Text
} from "@fluentui/react-components";
import { Dismiss24Regular, Save24Filled } from "@fluentui/react-icons";
import { Assistant } from "../../../api";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlockRenderer from "../../CodeBlockRenderer/CodeBlockRenderer";
import styles from "../CommunityAssistantDialog.module.css";

interface AssistantDetailDialogProps {
    isOpen: boolean;
    assistant: Assistant;
    ownedAssistants: string[];
    subscribedAssistants: string[];
    onClose: () => void;
    onBack: () => void;
    onSave: (assistant: Assistant) => Promise<void>;
}

export const AssistantDetailDialog = ({ isOpen, assistant, ownedAssistants, subscribedAssistants, onClose, onBack, onSave }: AssistantDetailDialogProps) => {
    const { t } = useTranslation();

    const isAlreadySaved = subscribedAssistants.includes(assistant.id ?? "");
    const isOwned = ownedAssistants.includes(assistant.id ?? "");

    const handleSave = async () => {
        await onSave(assistant);
    };

    return (
        <Dialog
            modalType="modal"
            open={isOpen}
            onOpenChange={(_event, data) => {
                if (!data.open) {
                    onClose();
                }
            }}
        >
            <DialogSurface className={styles.detailDialog}>
                <DialogBody className={styles.dialogContent}>
                    <DialogTitle
                        action={
                            <DialogTrigger action="close">
                                <Button appearance="subtle" aria-label="close" icon={<Dismiss24Regular />} onClick={onClose} />
                            </DialogTrigger>
                        }
                    >
                        <div className={styles.titleSection}>
                            <Body1 className={styles.assistantDetailTitle}>{assistant.title}</Body1>

                            {assistant.hierarchical_access && assistant.hierarchical_access.length > 0 ? (
                                <>
                                    <Text size={200} className={styles.sectionDescription}>
                                        {t("components.community_assistants.departments_description")}
                                    </Text>
                                    <div className={styles.departmentsList}>
                                        {assistant.hierarchical_access.map((department, index) => (
                                            <Badge key={index} size="medium" color="warning" className={styles.departmentBadge}>
                                                {department}
                                            </Badge>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className={styles.publicAccess}>
                                    <Badge size="medium" color="success" className={styles.publicAccessBadge}>
                                        🌐 {t("components.community_assistants.public_access")}
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </DialogTitle>

                    <DialogContent className={styles.detailContent}>
                        {/* Tags Section */}
                        {assistant.tags && assistant.tags.length > 0 && (
                            <div className={styles.detailTags}>
                                {assistant.tags.map((tag: string) => (
                                    <Badge key={tag} size="medium" color="brand">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        <Divider />

                        {/* Description Section */}
                        <div className={styles.descriptionSection}>
                            <Text size={300} weight="semibold" className={styles.sectionTitle}>
                                {t("components.community_assistants.description")}
                            </Text>
                            <div className={styles.markdownContent}>
                                <Markdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlockRenderer }}>
                                    {assistant.description}
                                </Markdown>
                            </div>
                        </div>

                        <Divider />

                        {/* Tools Section */}
                        {assistant.tools && assistant.tools.length > 0 && (
                            <div className={styles.toolsSection}>
                                <Text size={300} weight="semibold" className={styles.sectionTitle}>
                                    {t("components.community_assistants.tools")}
                                </Text>
                                <div className={styles.toolsList}>
                                    {assistant.tools.map(tool => (
                                        <Badge key={tool.id} size="medium" className={styles.toolBadge}>
                                            {tool.id}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {assistant.tools && assistant.tools.length > 0 && <Divider />}

                        {/* System Message Section */}
                        <div className={styles.systemMessageSection}>
                            <Text size={300} weight="semibold" className={styles.sectionTitle}>
                                {t("components.community_assistants.system_message")}
                            </Text>
                            <div className={styles.systemMessageContent}>
                                <Markdown remarkPlugins={[remarkGfm]}>{assistant.system_message}</Markdown>
                            </div>
                        </div>
                    </DialogContent>

                    <DialogActions className={styles.detailActions}>
                        <Button appearance="subtle" onClick={onBack}>
                            {t("components.community_assistants.back_to_search")}
                        </Button>
                        <DialogTrigger disableButtonEnhancement>
                            <Tooltip
                                content={
                                    isOwned
                                        ? t("components.community_assistants.owned_assistant")
                                        : isAlreadySaved
                                          ? t("components.community_assistants.assistant_already_saved")
                                          : t("components.community_assistants.save")
                                }
                                relationship="description"
                                positioning="above"
                            >
                                <Button appearance="primary" onClick={handleSave} disabled={isAlreadySaved || isOwned} icon={<Save24Filled />}>
                                    {t("components.community_assistants.save")}
                                </Button>
                            </Tooltip>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
