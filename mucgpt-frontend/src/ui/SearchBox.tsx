import { forwardRef } from "react";
import { SearchBox as FluentSearchBox, type SearchBoxProps as FluentSearchBoxProps, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
    subtle: {
        backgroundColor: tokens.colorNeutralBackground2
    }
});

export type SearchBoxProps = Omit<FluentSearchBoxProps, "appearance"> & {
    appearance?: FluentSearchBoxProps["appearance"] | "subtle";
};

/** A Fluent search box with an additional "subtle" appearance on the product's Background2 surface. */
export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(({ appearance, className, ...props }, ref) => {
    const styles = useStyles();
    const isSubtle = appearance === "subtle";

    // Fluent has no Background2 appearance; "filled-lighter" supplies the matching transparent border.
    return (
        <FluentSearchBox
            {...props}
            ref={ref}
            appearance={isSubtle ? "filled-lighter" : appearance}
            className={mergeClasses(isSubtle && styles.subtle, className)}
        />
    );
});

SearchBox.displayName = "SearchBox";
