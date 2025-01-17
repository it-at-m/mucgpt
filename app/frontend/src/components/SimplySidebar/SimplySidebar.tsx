import { RadioGroup, Radio, RadioGroupOnChangeData, Tooltip } from "@fluentui/react-components";
import styles from "./SimplySidebar.module.css";
import { useTranslation } from "react-i18next";
import { FormEvent } from "react";
interface Props {
    onOutputTypeChanged: (newval: string) => void;
    outputType: string;
}
export const SimplySidebar = ({ onOutputTypeChanged, outputType }: Props) => {
    const { t } = useTranslation();

    const onOutputTypeChangedInternal = (e: FormEvent<HTMLDivElement>, selection: RadioGroupOnChangeData) => {
        onOutputTypeChanged(selection.value);
    };

    return (
        <div className={styles.sidebar}>
            <RadioGroup layout="vertical" onChange={onOutputTypeChangedInternal} value={outputType}>
                <Radio value="plain" label={t("simply.plain")} />
                <Radio value="easy" label={t("simply.easy")} />
            </RadioGroup>
            ;
            {outputType === "easy" ? (
                <div className={styles.description}>{t("simply.easy_description")}</div>
            ) :
                (
                    <div className={styles.description}>{t("simply.plain_description")}</div>
                )}

        </div>
    );
};
