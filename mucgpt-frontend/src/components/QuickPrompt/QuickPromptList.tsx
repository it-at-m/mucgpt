import { Stack } from "@fluentui/react";
import { Button, Divider, Tooltip } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import styles from "./QuickPromptList.module.css";
import { QuickPromptContext } from "./QuickPromptProvider";
import { useContext } from "react";

interface Props {
    setQuestion: (question: string) => void;
}

export const QuickPromptList = ({ setQuestion }: Props) => {
    const { t } = useTranslation();
    const { quickPrompts } = useContext(QuickPromptContext);
    return quickPrompts.length > 0 ? (
        <Stack>
            <Divider className={styles.divider}>
                <b>{t("components.quickprompt.name")}</b>
            </Divider>
            <div className={styles.buttons}>
                {quickPrompts.map(quickPrompt => (
                    <Tooltip content={quickPrompt.tooltip} relationship="description" positioning="above" key={quickPrompt.label}>
                        <Button onClick={() => setQuestion(quickPrompt.prompt)} appearance="secondary" aria-label={quickPrompt.prompt} className={styles.item}>
                            {quickPrompt.label}
                        </Button>
                    </Tooltip>
                ))}
            </div>
        </Stack>
    ) : (
        <></>
    );
};
