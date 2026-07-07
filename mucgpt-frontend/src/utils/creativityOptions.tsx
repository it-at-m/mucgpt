import { Color24Regular, Scales24Regular, TargetArrow24Regular } from "@fluentui/react-icons";
import type { TFunction } from "i18next";
import { CREATIVITY_HIGH, CREATIVITY_LOW, CREATIVITY_MEDIUM } from "../constants";

export const getCreativityOptions = (t: TFunction) => [
    {
        value: CREATIVITY_LOW,
        label: t("components.assistant_editor.creativity_low"),
        description: t("components.assistant_editor.creativity_low_description"),
        icon: <TargetArrow24Regular />
    },
    {
        value: CREATIVITY_MEDIUM,
        label: t("components.assistant_editor.creativity_medium"),
        description: t("components.assistant_editor.creativity_medium_description"),
        icon: <Scales24Regular />
    },
    {
        value: CREATIVITY_HIGH,
        label: t("components.assistant_editor.creativity_high"),
        description: t("components.assistant_editor.creativity_high_description"),
        icon: <Color24Regular />
    }
];

export const getCreativityOption = (t: TFunction, creativity: string) => {
    const options = getCreativityOptions(t);
    return options.find(option => option.value === creativity.toLowerCase()) ?? options.find(option => option.value === CREATIVITY_MEDIUM) ?? options[0];
};
