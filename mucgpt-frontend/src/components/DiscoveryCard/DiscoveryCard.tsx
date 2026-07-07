import React, { forwardRef, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Card, CardPreview, mergeClasses, CardProps, BadgeProps } from "@fluentui/react-components";
import { LockClosed16Regular, People16Regular } from "@fluentui/react-icons";
import styles from "./DiscoveryCard.module.css";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";

export interface DiscoveryCardBadge {
    label: string;
    className?: string;
    appearance?: BadgeProps["appearance"];
    color?: BadgeProps["color"];
    size?: BadgeProps["size"];
    tone?: "neutral" | "warning" | "danger";
}

export interface DiscoveryCardProps extends CardProps {
    id?: string;
    title?: string;
    description?: string;
    linkTo?: string;

    header?: ReactNode;
    badge?: string;
    badges?: DiscoveryCardBadge[];
    badgeClassName?: string;
    badgeAppearance?: BadgeProps["appearance"];
    badgeColor?: BadgeProps["color"];
    badgeSize?: BadgeProps["size"];
    titleClassName?: string;
    isSelected?: boolean;
    metadataStartLabel?: string;
    subscriberCount?: number;
    isPrivate?: boolean;
    privateLabel?: string;
}

const formatSubscriberCount = (count: number): string => {
    if (count >= 1000) {
        return (count / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return count.toString();
};

export const DiscoveryCard = forwardRef<HTMLDivElement, DiscoveryCardProps>((props, ref) => {
    const {
        id,
        title,
        description,
        linkTo,

        header,
        badge,
        badges,
        badgeClassName,
        badgeAppearance = "tint",
        badgeColor = "danger",
        badgeSize = "small",
        className,
        onClick,
        titleClassName,
        isSelected,
        metadataStartLabel,
        subscriberCount,
        isPrivate,
        privateLabel = "Private",
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if ((e.key === "Enter" || e.key === " ") && (onClick || linkTo)) {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
    };

    const renderHeader = () => {
        if (header !== undefined) {
            return header;
        }

        const renderedBadges: DiscoveryCardBadge[] =
            badges && badges.length > 0
                ? badges
                : badge
                  ? [
                        {
                            label: badge,
                            className: badgeClassName,
                            appearance: badgeAppearance,
                            color: badgeColor,
                            size: badgeSize
                        }
                    ]
                  : [];

        if (title) {
            return (
                <div className={styles.headerRow}>
                    <div className={mergeClasses(styles.headerText, titleClassName)}>{title}</div>
                    {renderedBadges.length > 0 && (
                        <div className={styles.badgeGroup}>
                            {renderedBadges.map(renderedBadge => (
                                <Badge
                                    key={renderedBadge.label}
                                    className={mergeClasses(
                                        styles.headerBadge,
                                        renderedBadge.tone === "warning" && styles.headerBadgeWarning,
                                        renderedBadge.tone === "danger" && styles.headerBadgeDanger,
                                        renderedBadge.className
                                    )}
                                    appearance={renderedBadge.appearance ?? badgeAppearance}
                                    color={renderedBadge.color ?? badgeColor}
                                    size={renderedBadge.size ?? badgeSize}
                                >
                                    {renderedBadge.label}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };

    const renderMetadata = () => {
        const hasSubscriberCount = typeof subscriberCount === "number";
        const hasMetadata = Boolean(metadataStartLabel) || isPrivate || hasSubscriberCount;

        if (!hasMetadata) {
            return null;
        }

        return (
            <div className={styles.metadataBlock}>
                <div className={styles.metadataDivider} aria-hidden="true" />
                <div className={styles.metadataRow}>
                    <span className={styles.metadataStart}>{metadataStartLabel}</span>
                    {isPrivate ? (
                        <span className={styles.metadataEnd}>
                            <LockClosed16Regular aria-hidden="true" />
                            <span>{privateLabel}</span>
                        </span>
                    ) : (
                        hasSubscriberCount && (
                            <span className={styles.metadataEnd}>
                                <People16Regular aria-hidden="true" />
                                <span>{formatSubscriberCount(subscriberCount)}</span>
                            </span>
                        )
                    )}
                </div>
            </div>
        );
    };

    const cardContent = (
        <Card
            id={id}
            ref={ref}
            className={mergeClasses(styles.card, isSelected && styles.cardSelected, className)}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={onClick || linkTo ? 0 : rest.tabIndex}
            {...rest}
        >
            {renderHeader()}
            {description && (
                <CardPreview className={styles.description}>
                    <MarkdownRenderer>{description}</MarkdownRenderer>
                </CardPreview>
            )}
            {renderMetadata()}
        </Card>
    );

    return cardContent;
});

DiscoveryCard.displayName = "DiscoveryCard";
