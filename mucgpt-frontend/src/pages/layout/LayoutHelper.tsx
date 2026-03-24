import { BrandVariants, createDarkTheme, createLightTheme } from "@fluentui/react-components";
import { darkThemeTokens, lightThemeTokens } from "./themeTokens";
import type { AppThemeTokens } from "./themeTokens";

// Apply CSS custom properties to document root
export const applyCssVariables = (tokens: AppThemeTokens) => {
    const root = document.documentElement.style;
    root.setProperty("--theme-header-background", tokens.headerBackground);
    root.setProperty("--theme-header-hover", tokens.headerHover);
    root.setProperty("--theme-header-subtle", tokens.headerSubtle);
    root.setProperty("--theme-surface-base", tokens.surfaceBase);
    root.setProperty("--theme-surface-raised", tokens.surfaceRaised);
    root.setProperty("--theme-surface-subtle", tokens.surfaceSubtle);
    root.setProperty("--theme-primary-base", tokens.primaryBase);
    root.setProperty("--theme-primary-hover", tokens.primaryHover);
    root.setProperty("--theme-primary-pressed", tokens.primaryPressed);
    root.setProperty("--theme-primary-subtle", tokens.primarySubtle);
    root.setProperty("--theme-primary-strong", tokens.primaryStrong);
    root.setProperty("--theme-primary-on", tokens.primaryOn);
    root.setProperty("--theme-text-primary", tokens.textPrimary);
    root.setProperty("--theme-text-secondary", tokens.textSecondary);
    root.setProperty("--theme-text-tertiary", tokens.textTertiary);
    root.setProperty("--theme-text-on-header", tokens.textOnHeader);
    root.setProperty("--theme-text-on-primary", tokens.textOnPrimary);
    root.setProperty("--theme-outline-subtle", tokens.outlineSubtle);
    root.setProperty("--theme-outline-base", tokens.outlineBase);
    root.setProperty("--theme-outline-strong", tokens.outlineStrong);
    root.setProperty("--theme-focus-ring", tokens.focusRing);
    root.setProperty("--theme-status-success-background", tokens.statusSuccessBackground);
    root.setProperty("--theme-status-success-border", tokens.statusSuccessBorder);
    root.setProperty("--theme-status-success-foreground", tokens.statusSuccessForeground);
    root.setProperty("--theme-status-warning-background", tokens.statusWarningBackground);
    root.setProperty("--theme-status-warning-border", tokens.statusWarningBorder);
    root.setProperty("--theme-status-warning-foreground", tokens.statusWarningForeground);
    root.setProperty("--theme-status-error-background", tokens.statusErrorBackground);
    root.setProperty("--theme-status-error-border", tokens.statusErrorBorder);
    root.setProperty("--theme-status-error-foreground", tokens.statusErrorForeground);
    root.setProperty("--theme-status-info-background", tokens.statusInfoBackground);
    root.setProperty("--theme-status-info-border", tokens.statusInfoBorder);
    root.setProperty("--theme-status-info-foreground", tokens.statusInfoForeground);

    // Temporary compatibility aliases for existing CSS modules.
    root.setProperty("--surface", tokens.surfaceBase);
    root.setProperty("--onSurface", tokens.textPrimary);
    root.setProperty("--onSurfaceVariant", tokens.textSecondary);
    root.setProperty("--primary", tokens.primaryBase);
    root.setProperty("--onPrimary", tokens.primaryOn);
    root.setProperty("--onPrimaryVariant", tokens.textOnPrimary);
    root.setProperty("--outline", tokens.outlineBase);
    root.setProperty("--primaryContainer", tokens.primarySubtle);
    root.setProperty("--onPrimaryContainer", tokens.primaryStrong);
    root.setProperty("--disabled", tokens.textTertiary);
    root.setProperty("--headerBackground", tokens.headerBackground);
};

export const enum STORAGE_KEYS {
    TERMS_OF_USE_READ = "TERMS_OF_USE_READ",
    SETTINGS_LANGUAGE = "SETTINGS_LANGUAGE",
    SETTINGS_LLM = "SETTINGS_LLM",
    SETTINGS_FONT_SCALING = "SETTINGS_FONT_SCALING",
    SETTINGS_IS_LIGHT_THEME = "SETTINGS_IS_LIGHT_THEME",
    VERSION_UPDATE_SEEN = "VERSION_UPDATE_SEEN",
    SHOW_SIDEBAR = "SHOW_SIDEBAR",
    HOME_ASSISTANT_MODE = "HOME_ASSISTANT_MODE"
}

const customBrandRamp: BrandVariants = {
    10: "#f4faf8",
    20: "#e6f2ef",
    30: "#d8eae5",
    40: "#cae1db",
    50: "#bad7cf",
    60: "#abcdc3",
    70: "#9bc3b7",
    80: "#94b9af",
    90: "#85ada2",
    100: "#769f95",
    110: "#678e85",
    120: "#597d76",
    130: "#4b6c66",
    140: "#3d5c57",
    150: "#304c48",
    160: "#223d39"
};
const applyThemeColors = (theme: any, tokens: AppThemeTokens) => {
    // Surface Colors
    theme.colorNeutralBackground1 = tokens.surfaceBase;
    theme.colorNeutralBackground2 = tokens.surfaceSubtle;
    theme.colorNeutralBackground3 = tokens.surfaceRaised;
    theme.colorNeutralBackground4 = tokens.surfaceSubtle;

    // Brand/Primary Colors
    theme.colorBrandBackground = tokens.primaryBase;
    theme.colorBrandBackgroundHover = tokens.primaryHover;
    theme.colorBrandBackgroundPressed = tokens.primaryPressed;
    theme.colorBrandBackground2 = tokens.primarySubtle;

    // Text Colors
    theme.colorNeutralForeground1 = tokens.textPrimary;
    theme.colorNeutralForeground2 = tokens.textSecondary;
    theme.colorNeutralForeground3 = tokens.textTertiary;
    theme.colorNeutralForeground4 = tokens.textSecondary;

    // Text on Primary
    theme.colorNeutralForegroundOnBrand = tokens.textOnPrimary;
    theme.colorNeutralForegroundInverted = tokens.textOnHeader;

    // Brand foreground colors
    theme.colorBrandForeground1 = tokens.primaryStrong;
    theme.colorBrandForeground2 = tokens.primaryBase;

    // Surface Variants
    theme.colorNeutralBackground1Hover = tokens.surfaceSubtle;
    theme.colorNeutralBackground1Pressed = tokens.headerSubtle;

    // Borders/Strokes
    theme.colorNeutralStroke1 = tokens.outlineBase;
    theme.colorNeutralStroke2 = tokens.outlineSubtle;
    theme.colorBrandStroke1 = tokens.primaryStrong;
    theme.colorBrandStroke2 = tokens.outlineStrong;

    // Overlay for hero section background
    theme.colorBackgroundOverlay = tokens.surfaceSubtle;

    // Focus and subtle header-friendly actions
    theme.colorStrokeFocus2 = tokens.focusRing;
    theme.colorSubtleForeground = tokens.textOnHeader;
    theme.colorSubtleForegroundHover = tokens.textOnHeader;
    theme.colorSubtleForegroundPressed = tokens.textOnHeader;
    theme.colorSubtleBackgroundHover = tokens.headerHover;
    theme.colorSubtleBackgroundPressed = tokens.headerSubtle;

    theme.colorStatusSuccessBackground1 = tokens.statusSuccessBackground;
    theme.colorStatusSuccessForeground1 = tokens.statusSuccessForeground;
    theme.colorStatusWarningBackground1 = tokens.statusWarningBackground;
    theme.colorStatusWarningForeground1 = tokens.statusWarningForeground;
    theme.colorStatusDangerBackground1 = tokens.statusErrorBackground;
    theme.colorStatusDangerForeground1 = tokens.statusErrorForeground;
};

export const adjustTheme = (isLight: boolean, scaling: number) => {
    const theme = isLight ? createLightTheme(customBrandRamp) : createDarkTheme(customBrandRamp);

    const tokens = isLight ? lightThemeTokens : darkThemeTokens;
    applyThemeColors(theme, tokens);

    theme.fontSizeBase100 = (parseFloat(theme.fontSizeBase100.replace("px", "")) * scaling).toString() + "px";
    theme.fontSizeBase200 = (parseFloat(theme.fontSizeBase200.replace("px", "")) * scaling).toString() + "px";
    theme.fontSizeBase300 = (parseFloat(theme.fontSizeBase300.replace("px", "")) * scaling).toString() + "px";
    theme.fontSizeBase400 = (parseFloat(theme.fontSizeBase400.replace("px", "")) * scaling).toString() + "px";
    theme.fontSizeBase500 = (parseFloat(theme.fontSizeBase500.replace("px", "")) * scaling).toString() + "px";
    theme.fontSizeBase600 = (parseFloat(theme.fontSizeBase600.replace("px", "")) * scaling).toString() + "px";
    theme.fontSizeHero700 = (parseFloat(theme.fontSizeHero700.replace("px", "")) * scaling).toString() + "px";
    theme.fontSizeHero800 = (parseFloat(theme.fontSizeHero800.replace("px", "")) * scaling).toString() + "px";
    theme.fontSizeHero900 = (parseFloat(theme.fontSizeHero900.replace("px", "")) * scaling).toString() + "px";
    theme.fontSizeHero1000 = (parseFloat(theme.fontSizeHero1000.replace("px", "")) * scaling).toString() + "px";

    theme.lineHeightBase100 = (parseFloat(theme.lineHeightBase100.replace("px", "")) * scaling).toString() + "px";
    theme.lineHeightBase200 = (parseFloat(theme.lineHeightBase200.replace("px", "")) * scaling).toString() + "px";
    theme.lineHeightBase300 = (parseFloat(theme.lineHeightBase300.replace("px", "")) * scaling).toString() + "px";
    theme.lineHeightBase400 = (parseFloat(theme.lineHeightBase400.replace("px", "")) * scaling).toString() + "px";
    theme.lineHeightBase500 = (parseFloat(theme.lineHeightBase500.replace("px", "")) * scaling).toString() + "px";
    theme.lineHeightBase600 = (parseFloat(theme.lineHeightBase600.replace("px", "")) * scaling).toString() + "px";
    theme.lineHeightHero700 = (parseFloat(theme.lineHeightHero700.replace("px", "")) * scaling).toString() + "px";
    theme.lineHeightHero800 = (parseFloat(theme.lineHeightHero800.replace("px", "")) * scaling).toString() + "px";
    theme.lineHeightHero900 = (parseFloat(theme.lineHeightHero900.replace("px", "")) * scaling).toString() + "px";
    theme.lineHeightHero1000 = (parseFloat(theme.lineHeightHero1000.replace("px", "")) * scaling).toString() + "px";
    return theme;
};
