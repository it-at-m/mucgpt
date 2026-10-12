import { forwardRef } from "react";
import { Badge as FluentBadge, type BadgeProps, makeStyles, mergeClasses, shorthands, tokens } from "@fluentui/react-components";

type BadgeTone = "neutral";
type MucgptBadgeProps = BadgeProps & { tone?: BadgeTone };

const useStyles = makeStyles({
    // Fluent's informative tint uses a pure gray and semibold text, which reads too loud against the MUCGPT neutrals.
    neutral: {
        color: tokens.colorNeutralForeground2,
        backgroundColor: tokens.colorNeutralBackground2,
        fontWeight: tokens.fontWeightRegular,
        ...shorthands.borderColor(tokens.colorNeutralStroke2)
    }
});

export const Badge = forwardRef<HTMLDivElement, MucgptBadgeProps>(({ appearance, className, tone, ...props }, ref) => {
    const styles = useStyles();
    const isNeutral = tone === "neutral";

    return <FluentBadge {...props} ref={ref} appearance={isNeutral ? "tint" : appearance} className={mergeClasses(isNeutral && styles.neutral, className)} />;
});

Badge.displayName = "Badge";
