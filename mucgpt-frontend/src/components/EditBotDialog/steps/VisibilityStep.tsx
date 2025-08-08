import { DialogContent, Field, InfoLabel, Checkbox, Text, CheckboxOnChangeData } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import { Eye24Regular, EyeOff24Regular, People24Regular } from "@fluentui/react-icons";
import styles from "../EditBotDialog.module.css";
import DepartmentDropdown from "../../DepartmentDropdown/DepartmentDropdown";

interface VisibilityStepProps {
    isOwner: boolean;
    publish: boolean;
    publishDepartments: string[];
    invisibleChecked: boolean;
    setPublishDepartments: (departments: string[]) => void;
    setInvisibleChecked: (checked: boolean) => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const VisibilityStep = ({
    isOwner,
    publish,
    publishDepartments,
    invisibleChecked,
    setPublishDepartments,
    setInvisibleChecked,
    onHasChanged
}: VisibilityStepProps) => {
    const { t } = useTranslation();

    // Invisible checkbox change
    const onInvisibleChangeHandler = useCallback(
        (_: React.ChangeEvent<HTMLInputElement>, data: CheckboxOnChangeData) => {
            setInvisibleChecked(data.checked === true);
            onHasChanged(true);
        },
        [setInvisibleChecked, onHasChanged]
    );

    return (
        <DialogContent>
            {/* Visibility Settings - only show when publishing */}
            <Field
                size="large"
                className={styles.rangeField}
                hidden={!publish}
                label={
                    <Text size={400} weight="medium">
                        Sichtbarkeit
                    </Text>
                }
            >
                <Checkbox
                    label={
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {invisibleChecked ? <EyeOff24Regular /> : <Eye24Regular />}
                            <span>{invisibleChecked ? "Privat (nur über Link)" : "Öffentlich sichtbar"}</span>
                        </div>
                    }
                    disabled={!isOwner}
                    checked={invisibleChecked}
                    onChange={onInvisibleChangeHandler}
                />
                <Text size={300} style={{ marginTop: "4px", color: "var(--colorNeutralForeground3)" }}>
                    {invisibleChecked ? "Assistent ist nur über den direkten Link erreichbar" : "Assistent erscheint in der öffentlichen Assistenten-Liste"}
                </Text>
            </Field>

            {/* Department Selection - only show when publishing and not invisible */}
            {publish && !invisibleChecked && (
                <Field size="large" className={styles.rangeField}>
                    <label className={styles.formLabel}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                            <People24Regular />
                            <Text size={400} weight="medium">
                                <InfoLabel info={<div>{t("components.edit_bot_dialog.departments_info")}</div>}>Veröffentlichen für Abteilungen</InfoLabel>
                            </Text>
                        </div>
                        <Text size={300} style={{ marginBottom: "8px", color: "var(--colorNeutralForeground3)" }}>
                            Wählen Sie die Abteilungen aus, für die der Bot verfügbar sein soll:
                        </Text>
                    </label>
                    <DepartmentDropdown publishDepartments={publishDepartments} setPublishDepartments={setPublishDepartments} disabled={!isOwner} />
                </Field>
            )}
        </DialogContent>
    );
};
