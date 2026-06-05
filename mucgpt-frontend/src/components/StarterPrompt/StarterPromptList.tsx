import { useTranslation } from "react-i18next";
import { StarterPrompt } from "./StarterPrompt";

import styles from "./StarterPrompt.module.css";

export type StarterPromptModel = {
    id?: string;
    text: string;
    value: string;
    system?: string;
};

interface Props {
    starterPrompts: StarterPromptModel[];
    onStarterPromptClicked: (value: string, system?: string) => void;
}

export const StarterPromptList = ({ starterPrompts, onStarterPromptClicked }: Props) => {
    const { t } = useTranslation();
    return (
        <ul className={styles.starterPromptNavList} aria-description={t("common.starter_prompts")}>
            {starterPrompts.map((starterPrompt, index) => (
                <li key={starterPrompt.id ?? `${starterPrompt.value}-${index}`} tabIndex={0}>
                    <StarterPrompt
                        text={starterPrompt.text}
                        system={starterPrompt.system}
                        value={starterPrompt.value}
                        onClick={onStarterPromptClicked}
                        ariaLabel={t("components.starter_prompt.label") + " " + (index + 1).toString()}
                    />
                </li>
            ))}
        </ul>
    );
};
