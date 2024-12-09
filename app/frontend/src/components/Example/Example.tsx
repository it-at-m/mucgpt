import styles from "./Example.module.css";

interface Props {
    text: string;
    value: string;
    system?: string;
    onClick: (value: string, system?: string) => void;
    ariaLabel: string;
}

export const Example = ({ text, value, system, onClick, ariaLabel }: Props) => {
    return (
        <div className={styles.example} aria-description={ariaLabel} onClick={() => onClick(value, system)}>
            <p className={styles.exampleText}>{text}</p>
        </div>
    );
};
