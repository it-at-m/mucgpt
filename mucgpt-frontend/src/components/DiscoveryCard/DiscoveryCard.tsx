import React, { forwardRef, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, CardFooter, mergeClasses, CardProps, BadgeProps } from "@fluentui/react-components";
import { LockClosed16Regular, People16Regular, Person16Regular } from "@fluentui/react-icons";
import styles from "./DiscoveryCard.module.css";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";

export interface DiscoveryCardBadge {
    label: string;
    className?: string;
    appearance?: BadgeProps["appearance"];
    color?: BadgeProps["color"];
    size?: BadgeProps["size"];
    tone?: "neutral" | "success" | "warning" | "danger";
}

interface DiscoveryCardBaseProps extends Omit<CardProps, "onClick"> {
    id?: string;
    title?: string;
    description?: string;

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
    metadataStartNode?: ReactNode;
    subscriberCount?: number;
    isPrivate?: boolean;
    privateLabel?: string;
    /** id of the element the primary action expands/reveals (e.g. a details drawer). */
    ariaControls?: string;
    /** Visually hidden text appended to the title of the primary action button, e.g. "Show details". */
    activateHintLabel?: string;
}

// `linkTo` navigates, `onActivate` triggers in-page behavior (e.g. opening a drawer) - a card
// can't sensibly be both a navigation link and a disclosure button at once.
export type DiscoveryCardProps =
    | (DiscoveryCardBaseProps & { linkTo: string; onActivate?: never })
    | (DiscoveryCardBaseProps & { linkTo?: never; onActivate: () => void })
    | (DiscoveryCardBaseProps & { linkTo?: never; onActivate?: never });

// The status tones map straight onto Fluent's tint badge colors, which the theme
// aliases onto the app's --colorStatus* ramps. "neutral" has no Fluent equivalent.
const toStatusBadgeColor = (tone: DiscoveryCardBadge["tone"]): Extract<BadgeProps["color"], "success" | "warning" | "danger"> | undefined =>
    tone === "success" || tone === "warning" || tone === "danger" ? tone : undefined;

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
        onActivate,
        ariaControls,
        activateHintLabel,

        header,
        badge,
        badges,
        badgeClassName,
        badgeAppearance = "tint",
        badgeColor = "danger",
        badgeSize = "small",
        className,
        titleClassName,
        isSelected,
        metadataStartLabel,
        metadataStartNode,
        subscriberCount,
        isPrivate,
        privateLabel = "Private",
        ...rest
    } = props;

    const renderTitle = () => {
        if (!title) {
            return null;
        }

        const staticClass = mergeClasses(styles.headerText, titleClassName);
        const actionClass = mergeClasses(staticClass, styles.primaryAction);

        const titleElement = linkTo ? (
            <Link to={linkTo} className={actionClass}>
                {title}
            </Link>
        ) : onActivate ? (
            <button type="button" className={actionClass} onClick={onActivate} aria-expanded={isSelected} aria-controls={ariaControls}>
                {title}
                {activateHintLabel && <span className={styles.visuallyHidden}> {activateHintLabel}</span>}
            </button>
        ) : (
            <span className={staticClass}>{title}</span>
        );

        return <h3 className={styles.headerTextWrapper}>{titleElement}</h3>;
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
                    {renderTitle()}
                    {renderedBadges.length > 0 && (
                        <div className={styles.badgeGroup}>
                            {renderedBadges.map(renderedBadge => {
                                const statusColor = toStatusBadgeColor(renderedBadge.tone);
                                return (
                                    <Badge
                                        key={renderedBadge.label}
                                        className={mergeClasses(
                                            styles.headerBadge,
                                            statusColor ? styles.headerBadgeStatus : styles.headerBadgeNeutral,
                                            renderedBadge.className
                                        )}
                                        appearance={statusColor ? "tint" : (renderedBadge.appearance ?? badgeAppearance)}
                                        color={statusColor ?? renderedBadge.color ?? badgeColor}
                                        size={renderedBadge.size ?? badgeSize}
                                    >
                                        {renderedBadge.label}
                                    </Badge>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };

    const renderMetadata = () => {
        const hasSubscriberCount = typeof subscriberCount === "number";
        const hasMetadata = Boolean(metadataStartNode) || Boolean(metadataStartLabel) || isPrivate || hasSubscriberCount;

        if (!hasMetadata) {
            return null;
        }

        const endContent = isPrivate ? (
            <>
                <LockClosed16Regular aria-hidden="true" />
                <span>{privateLabel}</span>
            </>
        ) : hasSubscriberCount ? (
            <>
                <People16Regular aria-hidden="true" />
                <span>{formatSubscriberCount(subscriberCount)}</span>
            </>
        ) : undefined;

        return (
            <CardFooter className={styles.metadata} action={endContent && { className: styles.metadataEnd, children: endContent }}>
                {(metadataStartNode || metadataStartLabel) && (
                    <span className={styles.metadataStart}>
                        <Person16Regular aria-hidden="true" />
                        <span>{metadataStartNode || metadataStartLabel}</span>
                    </span>
                )}
            </CardFooter>
        );
    };

    return (
        <Card id={id} ref={ref} size="large" className={mergeClasses(styles.card, isSelected && styles.cardSelected, className)} {...rest}>
            {renderHeader()}
            {description && (
                <div className={styles.description}>
                    <MarkdownRenderer>{description}</MarkdownRenderer>
                </div>
            )}
            {renderMetadata()}
        </Card>
    );
});

DiscoveryCard.displayName = "DiscoveryCard";
