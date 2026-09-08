import { Button, Tooltip } from "@fluentui/react-components";
import styles from "./StarterPrompt.module.css";

interface Props {
    text: string;
    value: string;
    system?: string;
    onClick: (value: string, system?: string) => void;
}

export const StarterPrompt = ({ text, value, system, onClick }: Props) => {
    return (
        <Tooltip content={value} relationship="description" positioning="above">
            <Button type="button" appearance="subtle" className={styles.starterPrompt} onClick={() => onClick(value, system)}>
                <span className={styles.starterPromptText}>{text}</span>
            </Button>
        </Tooltip>
    );
};
