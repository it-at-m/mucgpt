import { DialogContent, Field, InfoLabel, Text, RadioGroup, Radio } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback, useState } from "react";
import { Eye24Regular, EyeOff24Regular, People24Regular } from "@fluentui/react-icons";
import sharedStyles from "../AssistantDialog.module.css";
import DepartmentTreeDropdown from "../../../DepartmentTreeDropdown/DepartmentTreeDropdown";

interface VisibilityStepProps {
    isOwner: boolean;
    publishDepartments: string[];
    invisibleChecked: boolean;
    setPublishDepartments: (departments: string[]) => void;
    onHasChanged: (hasChanged: boolean) => void;
    setInvisibleChecked: (invisible: boolean) => void;
}

export const VisibilityStep = ({
    isOwner,
    publishDepartments,
    invisibleChecked,
    setPublishDepartments,
    onHasChanged,
    setInvisibleChecked
}: VisibilityStepProps) => {
    const { t } = useTranslation();

    const initialVisibility: "public" | "departments" | "private" = invisibleChecked
        ? "private"
        : Array.isArray(publishDepartments) && publishDepartments.length > 0
          ? "departments"
          : "public";

    const [visibilityMode, setVisibilityMode] = useState<"public" | "departments" | "private">(initialVisibility);

    const onVisibilityChange = useCallback(
        (_: React.FormEvent<HTMLDivElement>, data: { value: string }) => {
            const newMode = data.value as "public" | "departments" | "private";
            setVisibilityMode(newMode);
            onHasChanged(true);
            setInvisibleChecked(newMode === "private");
            if (newMode !== "departments") {
                setPublishDepartments([]);
            }
        },
        [onHasChanged, setInvisibleChecked, setPublishDepartments]
    );

    const handleSetPublishDepartments = useCallback(
        (deps: string[]) => {
            setPublishDepartments(deps);
            onHasChanged(true);
        },
        [setPublishDepartments, onHasChanged]
    );

    const departmentsSelected = Array.isArray(publishDepartments) && publishDepartments.length > 0;

    return (
        <DialogContent>
            <div className={sharedStyles.visibilityTitle}>
                <span className={sharedStyles.formLabel}>{t("components.publish_assistant_dialog.publication_options_title")}</span>
            </div>

            <div className={sharedStyles.visibilityWrapper}>
                <Field size="large" className={sharedStyles.rangeField}>
                    <RadioGroup value={visibilityMode} onChange={onVisibilityChange} layout="vertical" disabled={!isOwner}>
                        <Radio
                            value="public"
                            disabled={!isOwner}
                            label={
                                <div className={sharedStyles.radioContent}>
                                    <div className={sharedStyles.radioLabel}>
                                        <Eye24Regular /> <span>{t("components.publish_assistant_dialog.visibility_public")}</span>
                                    </div>
                                    <div className={sharedStyles.radioDescription}>
                                        {t("components.publish_assistant_dialog.visibility_public_description")}
                                    </div>
                                </div>
                            }
                        />
                        <Radio
                            value="departments"
                            disabled={!isOwner}
                            label={
                                <div className={sharedStyles.radioContent}>
                                    <div className={sharedStyles.radioLabel}>
                                        <People24Regular /> <span>{t("components.publish_assistant_dialog.departments_title")}</span>
                                    </div>
                                    <div className={sharedStyles.radioDescription}>{t("components.publish_assistant_dialog.departments_description")}</div>
                                </div>
                            }
                        />
                        {visibilityMode === "departments" && (
                            <div className={sharedStyles.departmentSection}>
                                <InfoLabel info={<div>{t("components.edit_assistant_dialog.departments_info")}</div>}>
                                    {t("components.edit_assistant_dialog.departments")}
                                </InfoLabel>
                                <div className={sharedStyles.departmentDropdown}>
                                    <DepartmentTreeDropdown
                                        publishDepartments={publishDepartments}
                                        setPublishDepartments={handleSetPublishDepartments}
                                        disabled={!isOwner}
                                    />
                                </div>
                                {!departmentsSelected && (
                                    <Text size={200} className={sharedStyles.noDepartmentsWarning}>
                                        {t("components.publish_assistant_dialog.no_departments_selected")}
                                    </Text>
                                )}
                            </div>
                        )}
                        <Radio
                            value="private"
                            disabled={!isOwner}
                            label={
                                <div className={sharedStyles.radioContent}>
                                    <div className={sharedStyles.radioLabel}>
                                        <EyeOff24Regular /> <span>{t("components.publish_assistant_dialog.visibility_private")}</span>
                                    </div>
                                    <div className={sharedStyles.radioDescription}>
                                        {t("components.publish_assistant_dialog.visibility_private_description")}
                                    </div>
                                </div>
                            }
                        />
                    </RadioGroup>
                </Field>
            </div>
        </DialogContent>
    );
};

export default VisibilityStep;
