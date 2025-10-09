import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tooltip } from "@fluentui/react-components";
import styles from "./AssistantCard.module.css";

export interface AssistantCardProps {
    id: string;
    title: string;
    description: string;
    linkTo: string;
    linkAriaLabel?: string;
    linkText?: string;
    additionalButtons?: ReactNode;
    showTooltip?: boolean;
    style?: React.CSSProperties;
    titleStyle?: React.CSSProperties;
    onMouseEnter?: (id: string, event: React.MouseEvent) => void;
    onMouseLeave?: () => void;
    onFocus?: (id: string, event: React.FocusEvent) => void;
    onBlur?: () => void;
}

export const AssistantCard = ({
    id,
    title,
    description,
    linkTo,
    linkAriaLabel,
    linkText = "Auswählen",
    additionalButtons,
    showTooltip = true,
    style,
    titleStyle,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur
}: AssistantCardProps) => {
    const navigate = useNavigate();

    const handleNavigate = () => {
        navigate(linkTo);
    };

    const card = (
        <div
            className={styles.box}
            role="listitem"
            tabIndex={0}
            style={style}
            onMouseEnter={onMouseEnter ? e => onMouseEnter(id, e) : undefined}
            onMouseLeave={onMouseLeave}
            onFocus={onFocus ? e => onFocus(id, e) : undefined}
            onBlur={onBlur}
        >
            <div className={styles.boxHeader} style={titleStyle}>
                {title}
            </div>
            <div className={styles.boxDescription}>{description}</div>
            {additionalButtons ? (
                <div className={styles.boxButtons}>
                    {additionalButtons}
                    <Button onClick={handleNavigate} className={styles.boxChoose} appearance="primary" aria-label={linkAriaLabel}>
                        {linkText}
                    </Button>
                </div>
            ) : (
                <Button onClick={handleNavigate} className={styles.boxChoose} appearance="primary" aria-label={linkAriaLabel}>
                    {linkText}
                </Button>
            )}
        </div>
    );

    if (showTooltip) {
        return (
            <Tooltip content={title} relationship="description" positioning="below">
                {card}
            </Tooltip>
        );
    }

    return card;
};
