import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tooltip, Card, CardHeader, CardFooter, CardPreview } from "@fluentui/react-components";
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
    role?: string;
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
    role,
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
        <Card
            className={styles.box}
            role={role}
            tabIndex={0}
            style={style}
            onMouseEnter={onMouseEnter ? e => onMouseEnter(id, e) : undefined}
            onMouseLeave={onMouseLeave}
            onFocus={onFocus ? e => onFocus(id, e) : undefined}
            onBlur={onBlur}
        >
            <CardHeader
                header={
                    <div className={styles.boxHeader} style={titleStyle}>
                        {title}
                    </div>
                }
            />
            <CardPreview className={styles.boxDescription}>{description}</CardPreview>
            <CardFooter className={styles.boxFooter}>
                <div className={styles.boxButtons}>
                    {additionalButtons}
                    <Button onClick={handleNavigate} appearance="primary" aria-label={linkAriaLabel}>
                        {linkText}
                    </Button>
                </div>
            </CardFooter>
        </Card>
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
