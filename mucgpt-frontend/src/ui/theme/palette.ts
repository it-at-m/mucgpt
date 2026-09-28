import type { BrandVariants } from "@fluentui/react-components";

export const mucgptBrandRamp: BrandVariants = {
    10: "#0B1535",
    20: "#102451",
    30: "#17336D",
    40: "#1E3A8A",
    50: "#1E40AF",
    60: "#1A4DBB",
    70: "#1D4ED8",
    80: "#2563EB",
    90: "#6F90D8",
    100: "#86A4E5",
    110: "#A0B8ED",
    120: "#B4C7F0",
    130: "#BFDBFE",
    140: "#CFE2FF",
    150: "#DBEAFE",
    160: "#EFF6FF"
};

export const neutralRamp = {
    10: "#050A16",
    20: "#0A1224",
    30: "#111C34",
    40: "#14213D",
    50: "#182842",
    60: "#20314E",
    70: "#334766",
    80: "#52617A",
    90: "#74839A",
    100: "#94A3B8",
    110: "#AAB6C8",
    120: "#C0CAD8",
    130: "#D2DAE5",
    140: "#E2E8F0",
    150: "#F1F5F9",
    160: "#F8FAFC"
} as const;

/**
 * Status ramps, darkest to lightest. Every step is placed so the token mapping in
 * fluentTheme.ts meets WCAG AA: `primary` carries white text as a solid light-theme
 * surface and reads as text on a light card (>= 4.5:1), `tint20` clears the 3:1
 * non-text bar as a border in both themes, `tint30` upward stay light enough to be
 * dark-theme text. Verify with the contrast audit before changing a value.
 */
export const successRamp = {
    shade40: "#16382B",
    shade30: "#14532D",
    primary: "#3B7152",
    tint20: "#638F76",
    tint30: "#8CC9A6",
    tint40: "#BEE7CC",
    tint60: "#E7F6EE"
} as const;

export const warningRamp = {
    shade40: "#3A2C12",
    shade30: "#744904",
    primary: "#82601E",
    tint20: "#AB7E2A",
    tint30: "#E0A63A",
    tint40: "#F4D58D",
    tint60: "#FFF4DB"
} as const;

export const dangerRamp = {
    shade40: "#3B1E22",
    shade30: "#8A1C1C",
    primary: "#93545C",
    tint20: "#C56C6C",
    tint30: "#E37D7D",
    tint40: "#F2C0C7",
    tint60: "#FDECEC"
} as const;

export const infoRamp = {
    darkest: "#1E4E8C",
    dark: "#182D42",
    medium: "#5D88B8",
    light: "#7BA7D9",
    lighter: "#BDD8F5",
    lightest: "#E8F1FB"
} as const;
