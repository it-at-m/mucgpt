import { Field, InfoLabel, RadioGroup, Radio } from "@fluentui/react-components";
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger } from "@fluentui/react-dialog";
import { useTranslation } from "react-i18next";
import { Button, Text, Badge, Divider } from "@fluentui/react-components";
import { Checkmark24Filled, Dismiss24Regular, Info16Regular, Eye24Regular, EyeOff24Regular, People24Regular } from "@fluentui/react-icons";
import styles from "./PublishAssistantDialog.module.css";
import { Assistant } from "../../api";
import DepartmentTreeDropdown from "../DepartmentTreeDropdown/DepartmentTreeDropdown";
import { useCallback, useState, useEffect } from "react";
import { createCommunityAssistantApi } from "../../api/assistant-client";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";

interface Props {
    open: boolean;
    setOpen: (open: boolean) => void;
    assistant: Assistant;
    invisibleChecked: boolean;
    setInvisibleChecked: (invisible: boolean) => void;
    onDeleteAssistant: () => void;
}

export const PublishAssistantDialog = ({ open, setOpen, assistant, invisibleChecked, setInvisibleChecked, onDeleteAssistant }: Props) => {
    const { t } = useTranslation();
    const [publishedAssistantId, setPublishedAssistantId] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const { showSuccess } = useGlobalToastContext();
    const [publishDepartments, setPublishDepartments] = useState<string[]>(assistant.hierarchical_access || []);

    const initialVisibility = invisibleChecked ? "private" : publishDepartments && publishDepartments.length > 0 ? "departments" : "public";
    const [visibilityMode, setVisibilityMode] = useState<"public" | "departments" | "private">(initialVisibility);

    useEffect(() => {
        setVisibilityMode(
            invisibleChecked ? "private" : publishDepartments && publishDepartments.length > 0 && !publishDepartments.includes("*") ? "departments" : "public"
        );
    }, [invisibleChecked, publishDepartments]);

    const departmentsSelected = Array.isArray(publishDepartments) && publishDepartments.length > 0;
    const publishDisabled = isPublishing || publishedAssistantId !== null || (visibilityMode === "departments" && !departmentsSelected);

    const handlePublishClick = useCallback(async () => {
        setIsPublishing(true);
        try {
            let hierarchical_access: string[] | undefined;
            let is_visible: boolean;

            if (visibilityMode === "private") {
                hierarchical_access = [];
                is_visible = false;
            } else if (visibilityMode === "departments") {
                hierarchical_access = publishDepartments;
                is_visible = true;
            } else {
                hierarchical_access = ["*"];
                is_visible = true;
            }

            const response = await createCommunityAssistantApi({
                name: assistant.title,
                description: assistant.description,
                system_prompt: assistant.system_message,
                temperature: assistant.temperature,
                tools: assistant.tools || [],
                owner_ids: assistant.owner_ids ? assistant.owner_ids : ["0"],
                examples: assistant.examples?.map(e => ({ text: e.text, value: e.value })),
                quick_prompts: assistant.quick_prompts?.map(qp => ({ label: qp.label, prompt: qp.prompt, tooltip: qp.tooltip })),
                tags: assistant.tags || [],
                hierarchical_access,
                is_visible
            });

            setPublishedAssistantId(response.id);
            showSuccess(
                t("components.publish_assistant_dialog.publish_assistant_success"),
                t("components.publish_assistant_dialog.publish_assistant_success_message", { title: assistant.title })
            );

            if (is_visible) {
                onDeleteAssistant();
                setOpen(false);
            }
        } catch (error) {
            console.error("Error publishing assistant:", error);
        } finally {
            setIsPublishing(false);
        }
    }, [assistant, visibilityMode, publishDepartments, onDeleteAssistant, setOpen, showSuccess, t]);

    return (
        <Dialog modalType="alert" open={open}>
            <DialogSurface className={styles.dialog}>
                <DialogBody className={styles.dialogContent}>
                    <DialogTitle className={styles.title}>
                        <div className={styles.titleContainer}>
                            <Text size={600} weight="semibold">
                                {t("components.publish_assistant_dialog.title")}
                            </Text>
                            <Badge appearance="outline" color="informative" size="small">
                                {t("components.publish_assistant_dialog.version")} {assistant.version}
                            </Badge>
                        </div>
                    </DialogTitle>

                    <DialogContent className={styles.content}>
                        {/* Assistant Info */}
                        <div className={styles.assistantInfoCard}>
                            <Text size={400} weight="medium">
                                {assistant.title || t("components.publish_assistant_dialog.assistant_info_title")}
                            </Text>
                            <br />
                            <Text size={300} className={styles.assistantDescription}>
                                {assistant.description || t("components.publish_assistant_dialog.assistant_info_description")}
                            </Text>
                        </div>

                        {/* Important Information */}
                        <div className={styles.infoSection}>
                            <div className={styles.infoHeader}>
                                <Info16Regular className={styles.infoIcon} />
                                <Text size={400} weight="medium">
                                    {t("components.publish_assistant_dialog.important_info_title")}
                                </Text>
                            </div>
                            <ul className={styles.infoList}>
                                <li>{t("components.publish_assistant_dialog.important_info_items.item1")}</li>
                                <li>{t("components.publish_assistant_dialog.important_info_items.item2")}</li>
                                <li>{t("components.publish_assistant_dialog.important_info_items.item3")}</li>
                            </ul>
                        </div>

                        <Divider className={styles.divider} />

                        <div className={styles.optionsSection}>
                            <Text size={400} weight="medium">
                                {t("components.publish_assistant_dialog.publication_options_title")}
                            </Text>

                            <div className={styles.visibilityOptions}>
                                <RadioGroup
                                    value={visibilityMode}
                                    onChange={(_, data) => {
                                        const newMode = data.value as "public" | "departments" | "private";
                                        setVisibilityMode(newMode);
                                        setInvisibleChecked(newMode === "private");
                                    }}
                                    layout="vertical"
                                >
                                    <Field>
                                        <Radio
                                            value="public"
                                            disabled={isPublishing || publishedAssistantId !== null}
                                            label={
                                                <div className={styles.radioContent}>
                                                    <div className={styles.radioLabel}>
                                                        <Eye24Regular /> <span>{t("components.publish_assistant_dialog.visibility_public")}</span>
                                                    </div>
                                                    <div className={styles.radioDescription}>
                                                        {t("components.publish_assistant_dialog.visibility_public_description")}
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </Field>

                                    <Field>
                                        <Radio
                                            value="departments"
                                            disabled={isPublishing || publishedAssistantId !== null}
                                            label={
                                                <div className={styles.radioContent}>
                                                    <div className={styles.radioLabel}>
                                                        <People24Regular /> <span>{t("components.publish_assistant_dialog.departments_title")}</span>
                                                    </div>
                                                    <div className={styles.radioDescription}>
                                                        {t("components.publish_assistant_dialog.departments_description")}
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </Field>
                                    {visibilityMode === "departments" && (
                                        <div className={styles.departmentSection}>
                                            <InfoLabel info={<div>{t("components.edit_assistant_dialog.departments_info")}</div>}>
                                                {t("components.edit_assistant_dialog.departments")}
                                            </InfoLabel>
                                            <div className={styles.departmentDropdown}>
                                                <DepartmentTreeDropdown publishDepartments={publishDepartments} setPublishDepartments={setPublishDepartments} />
                                            </div>

                                            {!departmentsSelected && (
                                                <Text size={200} className={styles.noDepartmentsWarning}>
                                                    {t("components.publish_assistant_dialog.no_departments_selected")}
                                                </Text>
                                            )}
                                        </div>
                                    )}
                                    <Field>
                                        <Radio
                                            value="private"
                                            disabled={isPublishing || publishedAssistantId !== null}
                                            label={
                                                <div className={styles.radioContent}>
                                                    <div className={styles.radioLabel}>
                                                        <EyeOff24Regular /> <span>{t("components.publish_assistant_dialog.visibility_private")}</span>
                                                    </div>
                                                    <div className={styles.radioDescription}>
                                                        {t("components.publish_assistant_dialog.visibility_private_description")}
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </Field>
                                </RadioGroup>
                            </div>
                        </div>
                    </DialogContent>

                    <DialogActions className={styles.actions}>
                        {!(publishedAssistantId && visibilityMode === "private") && (
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" size="medium" onClick={() => setOpen(false)} className={styles.cancelButton}>
                                    <Dismiss24Regular />
                                    {t("components.publish_assistant_dialog.cancel")}
                                </Button>
                            </DialogTrigger>
                        )}
                        {!publishedAssistantId && (
                            <DialogTrigger disableButtonEnhancement>
                                <Button
                                    appearance="primary"
                                    size="medium"
                                    onClick={handlePublishClick}
                                    className={styles.publishButton}
                                    disabled={publishDisabled}
                                >
                                    <Checkmark24Filled />
                                    {isPublishing ? t("components.publish_assistant_dialog.publishing") : t("components.publish_assistant_dialog.confirm")}
                                </Button>
                            </DialogTrigger>
                        )}
                        {publishedAssistantId && visibilityMode === "private" && (
                            <DialogTrigger disableButtonEnhancement>
                                <Button
                                    appearance="primary"
                                    size="medium"
                                    onClick={() => {
                                        onDeleteAssistant();
                                        setOpen(false);
                                    }}
                                    className={styles.publishButton}
                                >
                                    <Checkmark24Filled />
                                    {t("components.publish_assistant_dialog.done")}
                                </Button>
                            </DialogTrigger>
                        )}
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

export default PublishAssistantDialog;
