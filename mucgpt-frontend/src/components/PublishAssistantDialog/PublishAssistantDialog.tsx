import { Checkbox, InfoLabel } from "@fluentui/react-components";
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger } from "@fluentui/react-dialog";
import { useTranslation } from "react-i18next";
import { Button, Label, Tooltip, Text, Badge, Divider } from "@fluentui/react-components";
import { Checkmark24Filled, Dismiss24Regular, Info16Regular, Link24Regular, Eye24Regular, EyeOff24Regular, People24Regular } from "@fluentui/react-icons";
import styles from "./PublishAssistantDialog.module.css";
import { Assistant } from "../../api";
import DepartmentDropdown from "../DepartmentDropdown/DepartmentDropdown";
import { useCallback, useState } from "react";
import { createCommunityAssistantApi } from "../../api/assistant-client";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";

interface Props {
    open: boolean;
    setOpen: (open: boolean) => void;
    assistant: Assistant;
    invisibleChecked: boolean;
    setInvisibleChecked: (checked: boolean) => void;
    onDeleteAssistant: () => void;
}

export const PublishAssistantDialog = ({ open, setOpen, assistant, invisibleChecked, setInvisibleChecked, onDeleteAssistant }: Props) => {
    const { t } = useTranslation();
    const [publishedAssistantId, setPublishedAssistantId] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const { showSuccess } = useGlobalToastContext();
    const [publishDepartments, setPublishDepartments] = useState<string[]>(assistant.hierarchical_access || []);

    const handlePublishClick = useCallback(async () => {
        setIsPublishing(true);
        try {
            const response = await createCommunityAssistantApi({
                name: assistant.title,
                description: assistant.description,
                system_prompt: assistant.system_message,
                temperature: assistant.temperature,
                max_output_tokens: assistant.max_output_tokens,
                tools: assistant.tools || [],
                owner_ids: assistant.owner_ids ? assistant.owner_ids : ["0"],
                examples: assistant.examples?.map(e => ({ text: e.text, value: e.value })),
                quick_prompts: assistant.quick_prompts?.map(qp => ({ label: qp.label, prompt: qp.prompt, tooltip: qp.tooltip })),
                tags: assistant.tags || [],
                hierarchical_access: invisibleChecked ? [] : publishDepartments || ["*"], // Default to all departments if none selected
                is_visible: !invisibleChecked
            });

            setPublishedAssistantId(response.id);
            showSuccess(
                t("components.publish_assistant_dialog.publish_assistant_success"),
                t("components.publish_assistant_dialog.publish_assistant_success_message", { title: assistant.title })
            );
            // Wenn der Assistant nicht unsichtbar ist, schließe den Dialog sofort
            if (!invisibleChecked) {
                onDeleteAssistant();
                setOpen(false);
            }
        } catch (error) {
            console.error("Error publishing assistant:", error);
        } finally {
            setIsPublishing(false);
        }
    }, [assistant, invisibleChecked, publishDepartments, onDeleteAssistant, setOpen]);

    return (
        <Dialog modalType="alert" open={open} onOpenChange={(_event, data) => setOpen(data.open)}>
            <DialogSurface className={styles.dialog}>
                <DialogBody className={styles.dialogContent}>
                    <DialogTitle className={styles.title}>
                        <div className={styles.titleContainer}>
                            <Text size={600} weight="semibold">
                                Assistant veröffentlichen
                            </Text>
                            <Badge appearance="outline" color="informative" size="small">
                                Version {assistant.version}
                            </Badge>
                        </div>
                    </DialogTitle>

                    <DialogContent className={styles.content}>
                        {/* Assistant Info */}
                        <div className={styles.assistantInfoCard}>
                            <Text size={400} weight="medium">
                                {assistant.title || "Unbenannter Assistant"}
                            </Text>
                            <br />
                            <Text size={300} className={styles.assistantDescription}>
                                {assistant.description || "Keine Beschreibung verfügbar"}
                            </Text>
                        </div>

                        {/* Important Information */}
                        <div className={styles.infoSection}>
                            <div className={styles.infoHeader}>
                                <Info16Regular className={styles.infoIcon} />
                                <Text size={400} weight="medium">
                                    Wichtige Hinweise
                                </Text>
                            </div>
                            <ul className={styles.infoList}>
                                <li>Der Assistant wird entsprechend Ihrer Auswahl verfügbar gemacht</li>
                                <li>Veröffentlichte Assistants können von den berechtigten Nutzern verwendet werden</li>
                                <li>Die Veröffentlichung kann später geändert oder zurückgenommen werden</li>
                            </ul>
                        </div>

                        <Divider className={styles.divider} />

                        {/* Publication Options */}
                        <div className={styles.optionsSection}>
                            <Text size={400} weight="medium" className={styles.sectionTitle}>
                                Veröffentlichungsoptionen
                            </Text>

                            <div className={styles.visibilityOption}>
                                <Checkbox
                                    label={
                                        <div className={styles.checkboxLabel}>
                                            {invisibleChecked ? <EyeOff24Regular /> : <Eye24Regular />}
                                            <span>{invisibleChecked ? "Privat (nur über Link)" : "Öffentlich sichtbar"}</span>
                                        </div>
                                    }
                                    disabled={isPublishing || publishedAssistantId !== null}
                                    checked={invisibleChecked}
                                    onChange={(_, data) => setInvisibleChecked(!!data.checked)}
                                />
                                <Text size={300} className={styles.optionDescription}>
                                    {invisibleChecked
                                        ? "Assistant ist nur über den direkten Link erreichbar"
                                        : "Assistant erscheint in der öffentlichen Assistant-Liste"}
                                </Text>
                            </div>

                            {invisibleChecked && publishedAssistantId && (
                                <div className={styles.linkCard}>
                                    <div className={styles.linkPreview}>
                                        <div className={styles.linkSection}>
                                            <Label className={styles.linkLabel}>
                                                <Link24Regular />
                                                Direkter Assistant-Link:
                                            </Label>
                                            <div className={styles.linkContainer}>
                                                <Text size={300} className={styles.linkText}>
                                                    {`${window.location.origin}/#/communityassistant/${publishedAssistantId}`}
                                                </Text>
                                                <Tooltip content="Link in Zwischenablage kopieren" relationship="description">
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        icon={<Link24Regular />}
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(
                                                                `${window.location.origin}/#/communityassistant/${publishedAssistantId}`
                                                            );
                                                        }}
                                                        aria-label="Link kopieren"
                                                    />
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!invisibleChecked && (
                                <div className={styles.departmentSection}>
                                    <div className={styles.departmentHeader}>
                                        <People24Regular />
                                        <Text size={400} weight="medium">
                                            Veröffentlichen für Abteilungen
                                        </Text>
                                    </div>
                                    <Text size={300} className={styles.departmentDescription}>
                                        Wählen Sie die Abteilungen aus, für die der Assistant verfügbar sein soll:
                                    </Text>
                                    <InfoLabel info={<div>{t("components.edit_assistant_dialog.departments_info")}</div>}>
                                        {t("components.edit_assistant_dialog.departments")}
                                    </InfoLabel>
                                    <div className={styles.departmentDropdown}>
                                        <DepartmentDropdown publishDepartments={publishDepartments} setPublishDepartments={setPublishDepartments} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>

                    <DialogActions className={styles.actions}>
                        {!(publishedAssistantId && invisibleChecked) && (
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" size="medium" onClick={() => setOpen(false)} className={styles.cancelButton}>
                                    <Dismiss24Regular />
                                    {t("components.assistantsettingsdrawer.deleteDialog.cancel")}
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
                                    disabled={isPublishing}
                                >
                                    <Checkmark24Filled />
                                    {isPublishing ? "Veröffentliche..." : t("components.assistantsettingsdrawer.deleteDialog.confirm")}
                                </Button>
                            </DialogTrigger>
                        )}
                        {publishedAssistantId && invisibleChecked && (
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
                                    Fertig
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
