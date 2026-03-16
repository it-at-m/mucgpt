import React, { forwardRef, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardPreview, mergeClasses, CardProps } from "@fluentui/react-components";
import styles from "./DiscoveryCard.module.css";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";

export interface DiscoveryCardProps extends CardProps {
    id?: string;
    title?: string;
    description?: string;
    linkTo?: string;

    header?: ReactNode;
    titleClassName?: string;
    isSelected?: boolean;
}

export const DiscoveryCard = forwardRef<HTMLDivElement, DiscoveryCardProps>((props, ref) => {
    const {
        id,
        title,
        description,
        linkTo,

        header,
        className,
        onClick,
        titleClassName,
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
            return <CardHeader header={<div className={mergeClasses(styles.headerText, titleClassName)}>{title}</div>} />;
        }

        return null;
    };

    const cardContent = (
        <Card id={id} ref={ref} className={mergeClasses(styles.card, isSelected && styles.cardSelected, className)} onClick={handleClick} {...rest}>
            {renderHeader()}
            {description && (
                <CardPreview className={styles.description}>
                    <MarkdownRenderer>{description}</MarkdownRenderer>
                </CardPreview>
            )}
        </Card>
    );

    return cardContent;
});

DiscoveryCard.displayName = "DiscoveryCard";
