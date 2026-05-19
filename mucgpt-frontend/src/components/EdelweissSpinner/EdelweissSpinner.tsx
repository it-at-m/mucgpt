import type { CSSProperties } from "react";
import { useContext } from "react";

import edelweissBlack from "../../assets/edelweiss.svg";
import edelweissWhite from "../../assets/edelweiss_white.svg";
import { LightContext } from "../../pages/layout/LightContext";
import styles from "./EdelweissSpinner.module.css";

type EdelweissSpinnerSize = "extra-small" | "tiny" | "small" | "medium" | "large" | "extra-large" | number;
type EdelweissSpinnerVariant = "auto" | "black" | "white";
type EdelweissSpinnerLabelPosition = "after" | "below";

interface EdelweissSpinnerProps {
    size?: EdelweissSpinnerSize;
    variant?: EdelweissSpinnerVariant;
    label?: string;
    labelPosition?: EdelweissSpinnerLabelPosition;
    className?: string;
}

const SIZE_MAP: Record<Exclude<EdelweissSpinnerSize, number>, number> = {
    "extra-small": 16,
    tiny: 18,
    small: 24,
    medium: 32,
    large: 48,
    "extra-large": 64
};

const getSizeValue = (size: EdelweissSpinnerSize) => (typeof size === "number" ? size : SIZE_MAP[size]);

export const EdelweissSpinner = ({ size = "medium", variant = "auto", label, labelPosition = "below", className }: EdelweissSpinnerProps) => {
    const isLight = useContext(LightContext);
    const resolvedVariant = variant === "auto" ? (isLight ? "black" : "white") : variant;
    const mark = resolvedVariant === "white" ? edelweissWhite : edelweissBlack;
    const spinnerSize = getSizeValue(size);
    const classes = [styles.root, labelPosition === "after" ? styles.inline : styles.stacked, className].filter(Boolean).join(" ");
    const style = {
        "--edelweiss-spinner-size": `${spinnerSize}px`
    } as CSSProperties;

    return (
        <span className={classes} style={style}>
            <img className={styles.mark} src={mark} alt="" aria-hidden="true" />
            {label && <span className={styles.label}>{label}</span>}
        </span>
    );
};
