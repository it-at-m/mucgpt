import styles from "./Example.module.css";

interface Props {
    text: string;
    value: string;
    onClick: (value: string) => void;
    ariaLabel: string;
}

export const Example = ({ text, value, onClick, ariaLabel }: Props) => {
    return (
        <div className={styles.example} aria-description={ariaLabel} onClick={() => onClick(value)}>
            <p className={styles.exampleText} >{text}</p>
        </div>
    );
};
