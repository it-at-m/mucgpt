import { Button } from "@fluentui/react-components";
import { ArrowRight16Regular } from "@fluentui/react-icons";
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
        <Button type="button" appearance="transparent" className={styles.starterPrompt} aria-label={ariaLabel} onClick={() => onClick(value, system)}>
            <ArrowRight16Regular className={styles.starterPromptIcon} aria-hidden="true" />
            <span className={styles.starterPromptText}>{text}</span>
        </Button>
    );
};
