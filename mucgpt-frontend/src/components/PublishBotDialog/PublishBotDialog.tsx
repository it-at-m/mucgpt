import { Checkbox } from "@fluentui/react-components";
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger } from "@fluentui/react-dialog";
import { useTranslation } from "react-i18next";
import { Button, Label, Tooltip, Text, Badge, Divider } from "@fluentui/react-components";
import { Checkmark24Filled, Dismiss24Regular, Info16Regular, Link24Regular, Eye24Regular, EyeOff24Regular, People24Regular } from "@fluentui/react-icons";
import styles from "./PublishBotDialog.module.css";
import { Bot } from "../../api";
import DepartmentDropdown from "../DepartementDropdown/DepartementDropdown";

interface Props {
    open: boolean;
    setOpen: (open: boolean) => void;
    bot: Bot;
    onBotChanged: (bot: Bot) => void;
    invisibleChecked: boolean;
    setInvisibleChecked: (checked: boolean) => void;
}

export const PublishBotDialog = ({ open, setOpen, bot, onBotChanged, invisibleChecked, setInvisibleChecked }: Props) => {
    const { t } = useTranslation();

    const handleDepartmentsChange = (departments: string[]) => {
        const updatedBot = {
            ...bot,
            hierarchical_access: departments
        };
        onBotChanged(updatedBot);
    };

    const handlePublishClick = () => {
        const updatedBot = {
            ...bot,
            publish: true,
            hierarchical_access: invisibleChecked ? [] : bot.hierarchical_access || ["*"]
        };
        onBotChanged(updatedBot);
        setOpen(false);
    };

    return (
        <Dialog modalType="alert" open={open}>
            <DialogSurface className={styles.dialog}>
                <DialogBody className={styles.dialogContent}>
                    <DialogTitle className={styles.title}>
                        <div className={styles.titleContainer}>
                            <Text size={600} weight="semibold">
                                Bot veröffentlichen
                            </Text>
                            <Badge appearance="outline" color="informative" size="small">
                                Version {bot.version}
                            </Badge>
                        </div>
                    </DialogTitle>

                    <DialogContent className={styles.content}>
                        {/* Bot Info */}
                        <div className={styles.botInfoCard}>
                            <Text size={400} weight="medium">
                                {bot.title || "Unbenannter Bot"}
                            </Text>
                            <Text size={300} className={styles.botDescription}>
                                {bot.description || "Keine Beschreibung verfügbar"}
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
                                <li>Der Bot wird entsprechend Ihrer Auswahl verfügbar gemacht</li>
                                <li>Veröffentlichte Bots können von den berechtigten Nutzern verwendet werden</li>
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
                                    checked={invisibleChecked}
                                    onChange={(_, data) => setInvisibleChecked(!!data.checked)}
                                />
                                <Text size={300} className={styles.optionDescription}>
                                    {invisibleChecked ? "Bot ist nur über den direkten Link erreichbar" : "Bot erscheint in der öffentlichen Bot-Liste"}
                                </Text>
                            </div>

                            {invisibleChecked && (
                                <div className={styles.linkCard}>
                                    <div className={styles.linkPreview}>
                                        <div className={styles.linkSection}>
                                            <Label className={styles.linkLabel}>
                                                <Link24Regular />
                                                Direkter Bot-Link:
                                            </Label>
                                            <div className={styles.linkContainer}>
                                                <Text size={300} className={styles.linkText}>
                                                    {`${window.location.origin}/bot/${bot.id}`}
                                                </Text>
                                                <Tooltip content="Link in Zwischenablage kopieren" relationship="description">
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        icon={<Link24Regular />}
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(`${window.location.origin}/bot/${bot.id}`);
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
                                        Wählen Sie die Abteilungen aus, für die der Bot verfügbar sein soll:
                                    </Text>
                                    <div className={styles.departmentDropdown}>
                                        <DepartmentDropdown
                                            publishDepartments={bot.hierarchical_access || []}
                                            setPublishDepartments={handleDepartmentsChange}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>

                    <DialogActions className={styles.actions}>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="secondary" size="medium" onClick={() => setOpen(false)} className={styles.cancelButton}>
                                <Dismiss24Regular />
                                {t("components.botsettingsdrawer.deleteDialog.cancel")}
                            </Button>
                        </DialogTrigger>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="primary" size="medium" onClick={handlePublishClick} className={styles.publishButton}>
                                <Checkmark24Filled />
                                {t("components.botsettingsdrawer.deleteDialog.confirm")}
                            </Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

export default PublishBotDialog;
