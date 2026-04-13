import { BrandVariants, createDarkTheme, createLightTheme, type Theme } from "@fluentui/react-components";
import { darkThemeTokens, lightThemeTokens } from "./themeTokens";
import type { AppThemeTokens } from "./themeTokens";

type ThemeMode = "light" | "dark";

type AppCssVariableName =
    | "--app-header-background"
    | "--app-header-hover"
    | "--app-header-pressed"
    | "--app-header-foreground"
    | "--app-primary-subtle-foreground"
    | "--app-status-info-background"
    | "--app-status-info-border"
    | "--app-status-info-foreground";

export type AppCssVariables = Record<AppCssVariableName, string>;

export const enum STORAGE_KEYS {
    TERMS_OF_USE_READ = "TERMS_OF_USE_READ",
    SETTINGS_LANGUAGE = "SETTINGS_LANGUAGE",
    SETTINGS_LLM = "SETTINGS_LLM",
    SETTINGS_FONT_SCALING = "SETTINGS_FONT_SCALING",
    SETTINGS_IS_LIGHT_THEME = "SETTINGS_IS_LIGHT_THEME",
    VERSION_UPDATE_SEEN = "VERSION_UPDATE_SEEN",
    SHOW_SIDEBAR = "SHOW_SIDEBAR"
}

const fontSizeTokenKeys = [
    "fontSizeBase100",
    "fontSizeBase200",
    "fontSizeBase300",
    "fontSizeBase400",
    "fontSizeBase500",
    "fontSizeBase600",
    "fontSizeHero700",
    "fontSizeHero800",
    "fontSizeHero900",
    "fontSizeHero1000"
] as const satisfies readonly (keyof Theme)[];

const lineHeightTokenKeys = [
    "lineHeightBase100",
    "lineHeightBase200",
    "lineHeightBase300",
    "lineHeightBase400",
    "lineHeightBase500",
    "lineHeightBase600",
    "lineHeightHero700",
    "lineHeightHero800",
    "lineHeightHero900",
    "lineHeightHero1000"
] as const satisfies readonly (keyof Theme)[];

const scalePixelToken = (value: string, scaling: number) => `${parseFloat(value.replace("px", "")) * scaling}px`;

const getThemeMode = (isLight: boolean): ThemeMode => (isLight ? "light" : "dark");

const manualBrandRamp: BrandVariants = {
    10: "#172554",
    20: "#1E3A8A",
    30: "#1E40AF",
    40: "#1A4DBB",
    50: "#1D4ED8",
    60: "#2563EB",
    70: "#3B82F6",
    80: "#60A5FA",
    90: "#93C5FD",
    100: "#A0B8ED",
    110: "#BFDBFE",
    120: "#C7D9F6",
    130: "#DBEAFE",
    140: "#E8F1FB",
    150: "#F0F7FF",
    160: "#F8FBFF"
};

const createFluentThemeOverrides = (tokens: AppThemeTokens): Partial<Theme> => ({
    colorNeutralBackground1: tokens.surfaceBase,
    colorNeutralBackground1Hover: tokens.surfaceRaised,
    colorNeutralBackground1Pressed: tokens.surfaceSubtle,
    colorNeutralBackground1Selected: tokens.surfaceRaised,
    colorNeutralBackground2: tokens.surfaceRaised,
    colorNeutralBackground2Hover: tokens.surfaceSubtle,
    colorNeutralBackground2Pressed: tokens.surfaceBase,
    colorNeutralBackground2Selected: tokens.surfaceSubtle,
    colorNeutralBackground3: tokens.surfaceSubtle,
    colorNeutralBackground3Hover: tokens.surfaceRaised,
    colorNeutralBackground3Pressed: tokens.surfaceRaised,
    colorNeutralBackground3Selected: tokens.surfaceRaised,
    colorNeutralBackgroundDisabled: tokens.disabledBackground,
    colorNeutralBackgroundDisabled2: tokens.disabledBackground,
    colorNeutralCardBackground: tokens.surfaceRaised,
    colorNeutralCardBackgroundHover: tokens.surfaceSubtle,
    colorNeutralCardBackgroundPressed: tokens.surfaceBase,
    colorNeutralCardBackgroundSelected: tokens.surfaceSubtle,
    colorNeutralCardBackgroundDisabled: tokens.disabledBackground,
    colorNeutralForeground1: tokens.textDefault,
    colorNeutralForeground1Hover: tokens.textDefault,
    colorNeutralForeground1Pressed: tokens.textDefault,
    colorNeutralForeground1Selected: tokens.textDefault,
    colorNeutralForeground1Static: tokens.textDefault,
    colorNeutralForeground2: tokens.textSecondary,
    colorNeutralForeground2Hover: tokens.textDefault,
    colorNeutralForeground2Pressed: tokens.textDefault,
    colorNeutralForeground2Selected: tokens.textDefault,
    colorNeutralForeground2Link: tokens.textSecondary,
    colorNeutralForeground2LinkHover: tokens.textDefault,
    colorNeutralForeground2LinkPressed: tokens.textDefault,
    colorNeutralForeground2LinkSelected: tokens.textDefault,
    colorNeutralForeground3: tokens.textTertiary,
    colorNeutralForeground3Hover: tokens.textSecondary,
    colorNeutralForeground3Pressed: tokens.textSecondary,
    colorNeutralForeground3Selected: tokens.textSecondary,
    colorNeutralForeground4: tokens.textTertiary,
    colorNeutralForeground5: tokens.textTertiary,
    colorNeutralForegroundDisabled: tokens.disabledForeground,
    colorNeutralForegroundInvertedDisabled: tokens.disabledForeground,
    colorNeutralForegroundOnBrand: tokens.textOnPrimary,
    colorBrandForegroundLink: tokens.primaryStrong,
    colorBrandForegroundLinkHover: tokens.primaryBase,
    colorBrandForegroundLinkPressed: tokens.primaryPressed,
    colorBrandForegroundLinkSelected: tokens.primaryBase,
    colorCompoundBrandForeground1: tokens.primaryStrong,
    colorCompoundBrandForeground1Hover: tokens.primaryBase,
    colorCompoundBrandForeground1Pressed: tokens.primaryPressed,
    colorBrandForeground1: tokens.primaryStrong,
    colorBrandForeground2: tokens.primarySubtleOn,
    colorBrandForeground2Hover: tokens.primarySubtleOn,
    colorBrandForeground2Pressed: tokens.primarySubtleOn,
    colorBrandForegroundOnLight: tokens.primaryStrong,
    colorBrandForegroundOnLightHover: tokens.primaryBase,
    colorBrandForegroundOnLightPressed: tokens.primaryPressed,
    colorBrandForegroundOnLightSelected: tokens.primaryBase,
    colorBrandBackground: tokens.primaryBase,
    colorBrandBackgroundHover: tokens.primaryHover,
    colorBrandBackgroundPressed: tokens.primaryPressed,
    colorBrandBackgroundSelected: tokens.primaryBase,
    colorBrandBackgroundStatic: tokens.primaryBase,
    colorBrandBackground2: tokens.primarySubtle,
    colorBrandBackground2Hover: tokens.primarySubtle,
    colorBrandBackground2Pressed: tokens.primarySubtle,
    colorBrandBackground3Static: tokens.primaryStrong,
    colorBrandBackground4Static: tokens.primaryPressed,
    colorCompoundBrandBackground: tokens.primaryBase,
    colorCompoundBrandBackgroundHover: tokens.primaryHover,
    colorCompoundBrandBackgroundPressed: tokens.primaryPressed,
    colorNeutralStrokeAccessible: tokens.outlineHover,
    colorNeutralStrokeAccessibleHover: tokens.outlineHover,
    colorNeutralStrokeAccessiblePressed: tokens.outlineHover,
    colorNeutralStrokeAccessibleSelected: tokens.primaryStrong,
    colorNeutralStroke1: tokens.outlineBase,
    colorNeutralStroke1Hover: tokens.outlineHover,
    colorNeutralStroke1Pressed: tokens.outlineHover,
    colorNeutralStroke1Selected: tokens.outlineHover,
    colorNeutralStroke2: tokens.outlineSubtle,
    colorNeutralStroke3: tokens.outlineSubtle,
    colorNeutralStroke4: tokens.outlineSubtle,
    colorNeutralStrokeSubtle: tokens.outlineSubtle,
    colorNeutralStrokeDisabled: tokens.disabledBorder,
    colorNeutralStrokeDisabled2: tokens.disabledBorder,
    colorNeutralStrokeOnBrand2: tokens.textOnPrimary,
    colorNeutralStrokeOnBrand2Hover: tokens.textOnPrimary,
    colorNeutralStrokeOnBrand2Pressed: tokens.textOnPrimary,
    colorNeutralStrokeOnBrand2Selected: tokens.textOnPrimary,
    colorBrandStroke1: tokens.primaryStrong,
    colorBrandStroke2: tokens.primaryBase,
    colorBrandStroke2Hover: tokens.primaryHover,
    colorBrandStroke2Pressed: tokens.primaryPressed,
    colorBrandStroke2Contrast: tokens.primaryBase,
    colorCompoundBrandStroke: tokens.primaryBase,
    colorCompoundBrandStrokeHover: tokens.primaryHover,
    colorCompoundBrandStrokePressed: tokens.primaryPressed,
    colorStrokeFocus1: tokens.surfaceBase,
    colorStrokeFocus2: tokens.focusRing,
    colorStatusSuccessBackground1: tokens.statusSuccessBackground,
    colorStatusSuccessBackground2: tokens.statusSuccessBackground,
    colorStatusSuccessBackground3: tokens.statusSuccessBorder,
    colorStatusSuccessForeground1: tokens.statusSuccessForeground,
    colorStatusSuccessForeground2: tokens.statusSuccessForeground,
    colorStatusSuccessForeground3: tokens.statusSuccessForeground,
    colorStatusSuccessForegroundInverted: tokens.statusSuccessForeground,
    colorStatusSuccessBorderActive: tokens.statusSuccessBorder,
    colorStatusSuccessBorder1: tokens.statusSuccessBorder,
    colorStatusSuccessBorder2: tokens.statusSuccessBorder,
    colorStatusWarningBackground1: tokens.statusWarningBackground,
    colorStatusWarningBackground2: tokens.statusWarningBackground,
    colorStatusWarningBackground3: tokens.statusWarningBorder,
    colorStatusWarningForeground1: tokens.statusWarningForeground,
    colorStatusWarningForeground2: tokens.statusWarningForeground,
    colorStatusWarningForeground3: tokens.statusWarningForeground,
    colorStatusWarningForegroundInverted: tokens.statusWarningForeground,
    colorStatusWarningBorderActive: tokens.statusWarningBorder,
    colorStatusWarningBorder1: tokens.statusWarningBorder,
    colorStatusWarningBorder2: tokens.statusWarningBorder,
    colorStatusDangerBackground1: tokens.statusErrorBackground,
    colorStatusDangerBackground2: tokens.statusErrorBackground,
    colorStatusDangerBackground3: tokens.statusErrorBorder,
    colorStatusDangerBackground3Hover: tokens.statusErrorBorder,
    colorStatusDangerBackground3Pressed: tokens.statusErrorBorder,
    colorStatusDangerForeground1: tokens.statusErrorForeground,
    colorStatusDangerForeground2: tokens.statusErrorForeground,
    colorStatusDangerForeground3: tokens.statusErrorForeground,
    colorStatusDangerForegroundInverted: tokens.statusErrorForeground,
    colorStatusDangerBorderActive: tokens.statusErrorBorder,
    colorStatusDangerBorder1: tokens.statusErrorBorder,
    colorStatusDangerBorder2: tokens.statusErrorBorder
});

export const getAppTokens = (isLight: boolean): AppThemeTokens => (isLight ? lightThemeTokens : darkThemeTokens);

export const createFluentTheme = (tokens: AppThemeTokens, isLight: boolean): Theme => {
    const baseTheme = getThemeMode(isLight) === "light" ? createLightTheme(manualBrandRamp) : createDarkTheme(manualBrandRamp);

    return {
        ...baseTheme,
        ...createFluentThemeOverrides(tokens)
    };
};

export const createScaledTypographyTheme = (theme: Theme, scaling: number): Theme => {
    if (scaling === 1) {
        return theme;
    }

    const scaledTheme = { ...theme };

    for (const key of fontSizeTokenKeys) {
        scaledTheme[key] = scalePixelToken(theme[key], scaling);
    }

    for (const key of lineHeightTokenKeys) {
        scaledTheme[key] = scalePixelToken(theme[key], scaling);
    }

    return scaledTheme;
};

export const createAppCssVars = (tokens: AppThemeTokens): AppCssVariables => ({
    "--app-header-background": tokens.headerBackground,
    "--app-header-hover": tokens.headerHover,
    "--app-header-pressed": tokens.headerPressed,
    "--app-header-foreground": tokens.textOnHeader,
    "--app-primary-subtle-foreground": tokens.primarySubtleOn,
    "--app-status-info-background": tokens.statusInfoBackground,
    "--app-status-info-border": tokens.statusInfoBorder,
    "--app-status-info-foreground": tokens.statusInfoForeground
});
