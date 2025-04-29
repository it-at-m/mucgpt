import { RadioGroup, Radio, RadioGroupOnChangeData, Field } from "@fluentui/react-components";
import styles from "./SummarizeSidebar.module.css";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
interface Props {
    onDetaillevelChanged: (newval: string) => void;
    detaillevel_pref: string;
}
export const SummarizeSidebar = ({ onDetaillevelChanged, detaillevel_pref }: Props) => {
    const { t } = useTranslation();

    // change detail level
    const onDetaillevelChangedInternal = useCallback(
        (_: any, selection: RadioGroupOnChangeData) => {
            onDetaillevelChanged(selection.value);
        },
        [onDetaillevelChanged]
    );

    return (
        <div className={styles.sidebar}>
            <Field label={t("sum.levelofdetail")}>
                <RadioGroup layout="vertical" onChange={onDetaillevelChangedInternal} value={detaillevel_pref}>
                    <Radio value="short" label={t("sum.short")} />
                    <Radio value="medium" label={t("sum.medium")} />
                    <Radio value="long" label={t("sum.long")} />
                </RadioGroup>
            </Field>
        </div>
    );
};
