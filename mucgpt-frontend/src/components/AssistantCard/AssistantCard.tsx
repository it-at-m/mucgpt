import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tooltip, Card, CardHeader, CardFooter, CardPreview } from "@fluentui/react-components";
import styles from "./AssistantCard.module.css";

export interface AssistantCardProps {
    id?: string;
    title?: string;
    description?: string;
    linkTo?: string;
    linkAriaLabel?: string;
    linkText?: string;
    additionalButtons?: ReactNode;
    showTooltip?: boolean;
    role?: string;
    style?: React.CSSProperties;
    titleStyle?: React.CSSProperties;
    className?: string;
    onClick?: () => void;
    onMouseEnter?: (id: string, event: React.MouseEvent) => void;
    onMouseLeave?: () => void;
    onFocus?: (id: string, event: React.FocusEvent) => void;
    onBlur?: () => void;
    // New props for customization
    header?: ReactNode;
    footer?: ReactNode;
    showDivider?: boolean;
    tabIndex?: number;
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
    className,
    onClick,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    header,
    footer,
    showDivider = false,
    tabIndex = 0
}: AssistantCardProps) => {
    const navigate = useNavigate();

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else if (linkTo) {
            navigate(linkTo);
        }
    };

    // Render custom header or default header
    const renderHeader = () => {
        if (header !== undefined) {
            return header;
        }

        if (title) {
            return (
                <CardHeader
                    header={
                        <div className={styles.boxHeader} style={titleStyle}>
                            {title}
                        </div>
                    }
                />
            );
        }

        return null;
    };

    // Render custom footer or default footer
    const renderFooter = () => {
        if (footer !== undefined) {
            return footer;
        }

        if (linkTo || additionalButtons) {
            return (
                <CardFooter className={styles.boxFooter}>
                    <div className={styles.boxButtons}>
                        {additionalButtons}
                        {linkTo && (
                            <Button onClick={handleClick} appearance="primary" aria-label={linkAriaLabel}>
                                {linkText}
                            </Button>
                        )}
                    </div>
                </CardFooter>
            );
        }

        return null;
    };

    const card = (
        <Card
            className={className ? className : styles.box}
            role={role}
            tabIndex={tabIndex}
            style={style}
            onClick={onClick}
            onMouseEnter={onMouseEnter && id ? e => onMouseEnter(id, e) : undefined}
            onMouseLeave={onMouseLeave}
            onFocus={onFocus && id ? e => onFocus(id, e) : undefined}
            onBlur={onBlur}
        >
            {renderHeader()}
            {description && <CardPreview className={styles.boxDescription}>{description}</CardPreview>}
            {showDivider && <div className={styles.cardDivider}></div>}
            {renderFooter()}
        </Card>
    );

    if (showTooltip && title) {
        return (
            <Tooltip content={title} relationship="description" positioning="below">
                {card}
            </Tooltip>
        );
    }

    return card;
};
