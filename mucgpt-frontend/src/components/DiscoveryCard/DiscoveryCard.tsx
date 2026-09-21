import React, { forwardRef, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, CardFooter, makeStyles, mergeClasses, shorthands, CardProps, BadgeProps, Text, tokens } from "@fluentui/react-components";
import { LockClosed16Regular, People16Regular, Person16Regular } from "@fluentui/react-icons";
import styles from "./DiscoveryCard.module.css";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";

export interface DiscoveryCardBadge {
    label: string;
    icon?: BadgeProps["icon"];
    tone?: "neutral" | "brand" | "success" | "warning" | "danger";
}

interface DiscoveryCardBaseProps extends Omit<CardProps, "onClick" | "appearance"> {
    id?: string;
    title?: string;
    description?: string;

    badges?: DiscoveryCardBadge[];
    isSelected?: boolean;
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

// Colored tones map straight onto Fluent's tint badge colors, which the theme aliases
// onto the app's brand and --colorStatus* ramps. "neutral" has no Fluent equivalent.
const toTintBadgeColor = (tone: DiscoveryCardBadge["tone"]): Extract<BadgeProps["color"], "brand" | "success" | "warning" | "danger"> | undefined =>
    tone === "neutral" ? undefined : tone;

const useStyles = makeStyles({
    card: {
        padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM} ${tokens.spacingVerticalMNudge}`,
        rowGap: 0
    },
    // Fluent has no neutral badge color that matches this palette.
    badgeNeutral: {
        color: tokens.colorNeutralForeground2,
        backgroundColor: tokens.colorNeutralBackground2,
        ...shorthands.borderColor(tokens.colorNeutralStroke1)
    },
    // Colors come from Fluent's tint appearance; colored badges only read heavier.
    badgeTinted: {
        fontWeight: tokens.fontWeightSemibold
    }
});

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

        badges,
        className,
        style,
        isSelected,
        metadataStartNode,
        subscriberCount,
        isPrivate,
        privateLabel = "Private",
        ...rest
    } = props;
    const classes = useStyles();

    const renderTitle = () => {
        if (!title) {
            return null;
        }

        const actionClass = mergeClasses(styles.headerText, styles.primaryAction);

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
            <span className={styles.headerText}>{title}</span>
        );

        return (
            <Text as="h3" size={300} weight="semibold" className={styles.headerTextWrapper}>
                {titleElement}
            </Text>
        );
    };

    const renderHeader = () => {
        if (title) {
            return (
                <div className={styles.headerRow}>
                    {renderTitle()}
                    {badges && badges.length > 0 && (
                        <div className={styles.badgeGroup}>
                            {badges.map(renderedBadge => {
                                const tintColor = toTintBadgeColor(renderedBadge.tone);
                                return (
                                    <Badge
                                        key={renderedBadge.label}
                                        className={mergeClasses(styles.headerBadge, tintColor ? classes.badgeTinted : classes.badgeNeutral)}
                                        appearance="tint"
                                        color={tintColor}
                                        size="small"
                                        icon={renderedBadge.icon}
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
        const hasMetadata = Boolean(metadataStartNode) || isPrivate || hasSubscriberCount;

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
                {metadataStartNode && (
                    <span className={styles.metadataStart}>
                        <Person16Regular aria-hidden="true" />
                        <span>{metadataStartNode}</span>
                    </span>
                )}
            </CardFooter>
        );
    };

    return (
        <Card
            id={id}
            ref={ref}
            size="large"
            appearance="subtle"
            data-selected={isSelected || undefined}
            className={mergeClasses(styles.card, classes.card, className)}
            style={{ backgroundColor: tokens.colorNeutralCardBackground, ...style }}
            {...rest}
        >
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
