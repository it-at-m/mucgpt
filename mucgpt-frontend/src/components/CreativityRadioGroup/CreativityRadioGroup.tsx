import { Button } from "@fluentui/react-components";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getCreativityOptions } from "../../utils/creativityOptions";
import styles from "./CreativityRadioGroup.module.css";

interface CreativityRadioGroupProps {
    value: string;
    onChange: (creativity: string) => void;
    disabled?: boolean;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    className?: string;
}

export const CreativityRadioGroup = ({ value, onChange, disabled = false, ariaLabel, ariaLabelledBy, className }: CreativityRadioGroupProps) => {
    const { t } = useTranslation();
    const creativityOptions = useMemo(() => getCreativityOptions(t), [t]);

    return (
        <div className={`${styles.responseStyleCards} ${className ?? ""}`} role="radiogroup" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
            {creativityOptions.map(option => {
                const isSelected = option.value === value;
                return (
                    <Button
                        key={option.value}
                        type="button"
                        appearance="transparent"
                        role="radio"
                        aria-checked={isSelected}
                        className={styles.responseStyleCard}
                        data-selected={isSelected ? "true" : undefined}
                        disabled={disabled}
                        onClick={() => {
                            if (isSelected) return;
                            onChange(option.value);
                        }}
                    >
                        <span className={styles.styleCardHeader}>
                            <span className={styles.styleCardTitleGroup}>
                                <span className={styles.styleCardIcon} aria-hidden="true">
                                    {option.icon}
                                </span>
                                <span className={styles.styleCardTitle}>{option.label}</span>
                            </span>
                        </span>
                        <span className={styles.styleCardDescription}>{option.description}</span>
                    </Button>
                );
            })}
        </div>
    );
};
