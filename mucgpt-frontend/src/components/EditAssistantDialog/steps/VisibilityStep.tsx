import { DialogContent, Field, InfoLabel, Text, RadioGroup, Radio } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye24Regular, EyeOff24Regular, People24Regular } from "@fluentui/react-icons";
import styles from "../EditAssistantDialog.module.css";
import DepartmentDropdown from "../../DepartmentDropdown/DepartmentDropdown";

interface VisibilityStepProps {
    isOwner: boolean;
    publishDepartments: string[];
    invisibleChecked: boolean;
    setPublishDepartments: (departments: string[]) => void;
    setInvisibleChecked: (checked: boolean) => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const VisibilityStep = ({
    isOwner,
    publishDepartments,
    invisibleChecked,
    setPublishDepartments,
    setInvisibleChecked,
    onHasChanged
}: VisibilityStepProps) => {
    const { t } = useTranslation();
    const mountedRef = useRef(false);

    const initialVisibility: 'public' | 'departments' | 'private' = invisibleChecked
        ? "private"
        : (Array.isArray(publishDepartments) && publishDepartments.length > 0 ? "departments" : "public");

    const [visibilityMode, setVisibilityMode] = useState<'public' | 'departments' | 'private'>(initialVisibility);

    useEffect(() => {
        const derivedVisibility = invisibleChecked
            ? "private"
            : (Array.isArray(publishDepartments) && publishDepartments.length > 0 ? "departments" : "public");
        setVisibilityMode(derivedVisibility as 'public' | 'departments' | 'private');
    }, [invisibleChecked, publishDepartments]);

    useEffect(() => {
        setInvisibleChecked(visibilityMode === "private");
    }, [visibilityMode, setInvisibleChecked]);

    useEffect(() => {
        if (!mountedRef.current) {
            mountedRef.current = true;
            return;
        }
        onHasChanged(true);
    }, [visibilityMode, publishDepartments, onHasChanged]);

    const onVisibilityChange = useCallback((_: React.FormEvent<HTMLDivElement>, data: { value: string }) => {
        setVisibilityMode(data.value as 'public' | 'departments' | 'private');
    }, []);

    const handleSetPublishDepartments = useCallback(
        (deps: string[]) => {
            setPublishDepartments(deps);
        },
        [setPublishDepartments]
    );

    const departmentsSelected = Array.isArray(publishDepartments) && publishDepartments.length > 0;

    return (
        <DialogContent>
            <div className={styles.visibilityTitle}>
                <span className={styles.formLabel}>
                    {t("components.publish_assistant_dialog.publication_options_title")}
                </span>
            </div>

            <div className={styles.visibilityWrapper}>
                <Field size="large" className={styles.rangeField}>
                    <RadioGroup
                        value={visibilityMode}
                        onChange={onVisibilityChange}
                        layout="vertical"
                        disabled={!isOwner}
                    >
                        <Radio
                            value="public"
                            disabled={!isOwner}
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
                        <Radio
                            value="departments"
                            disabled={!isOwner}
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
                        {visibilityMode === "departments" && (
                            <div className={styles.departmentSection}>
                                <InfoLabel info={<div>{t("components.edit_assistant_dialog.departments_info")}</div>}>
                                    {t("components.edit_assistant_dialog.departments")}
                                </InfoLabel>
                                <div className={styles.departmentDropdown}>
                                    <DepartmentDropdown
                                        publishDepartments={publishDepartments}
                                        setPublishDepartments={handleSetPublishDepartments}
                                        disabled={!isOwner}
                                    />
                                </div>
                                {!departmentsSelected && (
                                    <Text size={200} className={styles.noDepartmentsWarning}>
                                        {t("components.publish_assistant_dialog.no_departments_selected")}
                                    </Text>
                                )}
                            </div>
                        )}
                        <Radio
                            value="private"
                            disabled={!isOwner}
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
                    </RadioGroup>
                </Field>
            </div>
        </DialogContent>
    );
};

export default VisibilityStep;
