import { Button } from "@fluentui/react-components";
import styles from "./StarterPrompt.module.css";

interface Props {
    text: string;
    value: string;
    system?: string;
    onClick: (value: string, system?: string) => void;
    ariaLabel: string;
}

export const StarterPrompt = ({ text, value, system, onClick, ariaLabel }: Props) => {
    return (
        <Button type="button" appearance="secondary" className={styles.starterPrompt} aria-label={ariaLabel} onClick={() => onClick(value, system)}>
            <span className={styles.starterPromptText}>{text}</span>
        </Button>
    );
};
