import React, { forwardRef, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
    Card,
    CardHeader,
    CardPreview,
    mergeClasses,
    CardProps
} from "@fluentui/react-components";
import styles from "./DiscoveryCard.module.css";

export interface DiscoveryCardProps extends CardProps {
    id?: string;
    title?: string;
    description?: string;
    linkTo?: string;
    linkAriaLabel?: string;
    linkText?: string;
    additionalButtons?: ReactNode;

    header?: ReactNode;
    titleStyle?: React.CSSProperties;
    descriptionLines?: number;
    isSelected?: boolean;
}

export const DiscoveryCard = forwardRef<HTMLDivElement, DiscoveryCardProps>((props, ref) => {
    const {
        id,
        title,
        description,
        linkTo,
        linkAriaLabel,
        linkText = "Auswählen",
        additionalButtons,

        header,
        className,
        onClick,
        titleStyle,
        descriptionLines = 10,
        isSelected,
        ...rest
    } = props;

    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (onClick) {
            onClick(e);
        } else if (linkTo) {
            navigate(linkTo);
        }
    };

    const renderHeader = () => {
        if (header !== undefined) {
            return header;
        }

        if (title) {
            return (
                <CardHeader
                    header={
                        <div className={styles.headerText} style={titleStyle} data-card-title>
                            {title}
                        </div>
                    }
                />
            );
        }

        return null;
    };

    const cardContent = (
        <Card
            id={id}
            ref={ref}
            className={mergeClasses(styles.card, isSelected && styles.cardSelected, className)}
            onClick={handleClick}
            {...rest}
        >
            {renderHeader()}
            {description && (
                <CardPreview
                    className={styles.description}
                    style={{ WebkitLineClamp: descriptionLines } as React.CSSProperties}
                >
                    {description}
                </CardPreview>
            )}
        </Card>
    );

    return cardContent;
});
