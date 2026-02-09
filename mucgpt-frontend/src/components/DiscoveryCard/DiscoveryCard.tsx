import React, { forwardRef, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
    Card,
    CardHeader,
    CardPreview,
    makeStyles,
    tokens,
    mergeClasses,
    CardProps
} from "@fluentui/react-components";

const useStyles = makeStyles({
    card: {
        borderRadius: "16px",
        padding: "16px",
        minHeight: "140px",
        border: "1px solid " + tokens.colorBrandBackground,
        ":hover": {
            transform: "translateY(-2px)",
            boxShadow: tokens.shadow8,
            "& [data-card-title]": {
                color: tokens.colorBrandBackground,
            },
            backgroundColor: tokens.colorNeutralBackground1,
        },
    },
    headerText: {
        fontWeight: tokens.fontWeightSemibold,
        fontSize: tokens.fontSizeBase400,
        color: tokens.colorNeutralForeground1,
        transitionProperty: "color",
        transitionDuration: "0.2s",
        paddingTop: "12px",
    },
    description: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        wordBreak: "break-word",
        padding: "0 12px 0",
    }
});

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

    const styles = useStyles();
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
        if (onClick) {
            onClick(e as any);
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
            ref={ref}
            className={mergeClasses(styles.card, className)}
            onClick={handleClick}
            style={isSelected ? { border: `2px solid ${tokens.colorBrandBackground}` } : undefined}
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
