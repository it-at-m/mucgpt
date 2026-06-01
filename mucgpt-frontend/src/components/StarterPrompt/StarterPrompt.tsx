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
        <div className={styles.starterPrompt} aria-description={ariaLabel} onClick={() => onClick(value, system)}>
            <p className={styles.starterPromptText}>{text}</p>
        </div>
    );
};
