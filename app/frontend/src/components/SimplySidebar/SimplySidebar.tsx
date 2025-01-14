import { RadioGroup, Radio, RadioGroupOnChangeData, Tooltip } from "@fluentui/react-components";
import styles from "./SimplySidebar.module.css";
import { useTranslation } from "react-i18next";
interface Props {
    onOutputTypeChanged: (newval: string) => void;
    outputType: string;
}
export const SimplySidebar = ({ onOutputTypeChanged, outputType }: Props) => {
    const { t } = useTranslation();

    const onOutputTypeChangedInternal = (e: any, selection: RadioGroupOnChangeData) => {
        onOutputTypeChanged(selection.value);
    };

    return (
        <div className={styles.sidebar}>
            <RadioGroup layout="vertical" onChange={onOutputTypeChangedInternal} value={outputType}>
                <Tooltip content={t("simply.plain_description")} relationship="description" positioning="below">
                    <Radio value="plain" label={t("simply.plain")} />
                </Tooltip>
                <Tooltip content={t("simply.easy_description")} relationship="description" positioning="below">
                    <Radio value="easy" label={t("simply.easy")} />
                </Tooltip>
            </RadioGroup>
            ;
        </div>
    );
};
