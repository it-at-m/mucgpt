import type { ReactNode } from "react";
import { MessageBar, MessageBarBody, MessageBarTitle, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { CheckmarkCircleFilled, DiamondDismissFilled, InfoFilled, WarningFilled } from "@fluentui/react-icons";

type CalloutIntent = "info" | "warning" | "error" | "success";
type CalloutActionsLayout = "stack" | "inline";

interface CalloutProps {
    intent: CalloutIntent;
    title: string;
    primaryAction?: ReactNode;
    secondaryActions?: ReactNode[];
    /** "stack" gives the primary action its own row and splits the secondary row evenly; "inline" keeps all actions in one row. */
    actionsLayout?: CalloutActionsLayout;
    children: ReactNode;
}

const intentIcons: Record<CalloutIntent, ReactNode> = {
    info: <InfoFilled />,
    warning: <WarningFilled />,
    error: <DiamondDismissFilled />,
    success: <CheckmarkCircleFilled />
};

const useStyles = makeStyles({
    root: {
        width: "100%",
        boxSizing: "border-box"
    },
    titleRow: {
        display: "flex",
        alignItems: "flex-start",
        gap: tokens.spacingHorizontalS
    },
    // The icon sits in the title row instead of Fluent's icon column so content and actions use the full width.
    icon: {
        display: "flex",
        flexShrink: 0,
        fontSize: tokens.fontSizeBase500,
        lineHeight: tokens.lineHeightBase300
    },
    info: {
        color: tokens.colorNeutralForeground3
    },
    warning: {
        color: tokens.colorStatusWarningForeground3
    },
    error: {
        color: tokens.colorStatusDangerForeground1
    },
    success: {
        color: tokens.colorStatusSuccessForeground1
    },
    description: {
        marginTop: tokens.spacingVerticalXS
    },
    actions: {
        display: "flex",
        gap: tokens.spacingVerticalS,
        marginTop: tokens.spacingVerticalM
    },
    stack: {
        flexDirection: "column"
    },
    inline: {
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: tokens.spacingHorizontalS
    },
    fullWidthAction: {
        display: "flex",
        "& > *": {
            flexGrow: 1,
            maxWidth: "none"
        }
    },
    secondaryRow: {
        display: "flex",
        gap: tokens.spacingHorizontalS,
        "& > *": {
            flexGrow: 1,
            flexBasis: 0,
            minWidth: 0,
            maxWidth: "none"
        }
    }
});

export const Callout = ({ intent, title, primaryAction, secondaryActions = [], actionsLayout = "stack", children }: CalloutProps) => {
    const styles = useStyles();
    const hasActions = Boolean(primaryAction) || secondaryActions.length > 0;
    const isStack = actionsLayout === "stack";

    return (
        <MessageBar intent={intent} layout="multiline" icon={null} className={styles.root}>
            <MessageBarBody>
                <div className={styles.titleRow}>
                    <span className={mergeClasses(styles.icon, styles[intent])} aria-hidden="true">
                        {intentIcons[intent]}
                    </span>
                    <MessageBarTitle>{title}</MessageBarTitle>
                </div>
                <div className={styles.description}>{children}</div>
                {hasActions && (
                    <div className={mergeClasses(styles.actions, styles[actionsLayout])}>
                        {primaryAction && (isStack ? <div className={styles.fullWidthAction}>{primaryAction}</div> : primaryAction)}
                        {secondaryActions.length > 0 && (isStack ? <div className={styles.secondaryRow}>{secondaryActions}</div> : secondaryActions)}
                    </div>
                )}
            </MessageBarBody>
        </MessageBar>
    );
};
