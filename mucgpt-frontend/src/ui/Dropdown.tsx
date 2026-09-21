import { forwardRef } from "react";
import { Dropdown as FluentDropdown, type DropdownProps as FluentDropdownProps, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
    subtle: {
        backgroundColor: tokens.colorNeutralBackground2
    }
});

export type DropdownProps = Omit<FluentDropdownProps, "appearance"> & {
    appearance?: FluentDropdownProps["appearance"] | "subtle";
};

/** A Fluent dropdown with an additional "subtle" appearance on the product's Background2 surface. */
export const Dropdown = forwardRef<HTMLButtonElement, DropdownProps>(({ appearance, className, ...props }, ref) => {
    const styles = useStyles();
    const isSubtle = appearance === "subtle";

    // Fluent has no Background2 appearance; "filled-lighter" supplies the matching transparent border.
    return (
        <FluentDropdown
            {...props}
            ref={ref}
            appearance={isSubtle ? "filled-lighter" : appearance}
            className={mergeClasses(isSubtle && styles.subtle, className)}
        />
    );
});

Dropdown.displayName = "Dropdown";
