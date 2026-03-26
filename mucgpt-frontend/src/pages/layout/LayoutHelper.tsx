import { BrandVariants, createDarkTheme, createLightTheme } from "@fluentui/react-components";
import { darkThemeTokens, lightThemeTokens } from "./themeTokens";
import type { AppThemeTokens } from "./themeTokens";

// Apply CSS custom properties to document root
export const applyCssVariables = (tokens: AppThemeTokens) => {
    const root = document.documentElement.style;
    root.setProperty("--theme-header-background", tokens.headerBackground);
    root.setProperty("--theme-header-hover", tokens.headerHover);
    root.setProperty("--theme-header-pressed", tokens.headerPressed);
    root.setProperty("--theme-header-subtle", tokens.headerSubtle);
    root.setProperty("--theme-surface-base", tokens.surfaceBase);
    root.setProperty("--theme-surface-raised", tokens.surfaceRaised);
    root.setProperty("--theme-surface-subtle", tokens.surfaceSubtle);
    root.setProperty("--theme-primary-base", tokens.primaryBase);
    root.setProperty("--theme-primary-hover", tokens.primaryHover);
    root.setProperty("--theme-primary-pressed", tokens.primaryPressed);
    root.setProperty("--theme-primary-subtle", tokens.primarySubtle);
    root.setProperty("--theme-primary-subtle-on", tokens.primarySubtleOn);
    root.setProperty("--theme-primary-strong", tokens.primaryStrong);
    root.setProperty("--theme-text-default", tokens.textDefault);
    root.setProperty("--theme-text-secondary", tokens.textSecondary);
    root.setProperty("--theme-text-tertiary", tokens.textTertiary);
    root.setProperty("--theme-text-on-header", tokens.textOnHeader);
    root.setProperty("--theme-text-on-primary", tokens.textOnPrimary);
    root.setProperty("--theme-outline-subtle", tokens.outlineSubtle);
    root.setProperty("--theme-outline-base", tokens.outlineBase);
    root.setProperty("--theme-outline-hover", tokens.outlineHover);
    root.setProperty("--theme-focus-ring", tokens.focusRing);
    root.setProperty("--theme-disabled-background", tokens.disabledBackground);
    root.setProperty("--theme-disabled-foreground", tokens.disabledForeground);
    root.setProperty("--theme-disabled-border", tokens.disabledBorder);
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
    root.setProperty("--onSurface", tokens.textDefault);
    root.setProperty("--onSurfaceVariant", tokens.textSecondary);
    root.setProperty("--primary", tokens.primaryBase);
    root.setProperty("--onPrimary", tokens.textOnPrimary);
    root.setProperty("--onPrimaryVariant", tokens.textOnPrimary);
    root.setProperty("--outline", tokens.outlineBase);
    root.setProperty("--primaryContainer", tokens.primarySubtle);
    root.setProperty("--onPrimaryContainer", tokens.primaryStrong);
    root.setProperty("--disabled", tokens.disabledForeground);
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

// Fluent requires a brand ramp to create a base theme object, but MUCGPT does not
// use that ramp as the design source of truth anymore. All relevant brand tokens
// are explicitly mapped from our semantic tokens below.
const fallbackBrandRamp: BrandVariants = {
    10: "#f2f6ff",
    20: "#e4edff",
    30: "#d4e2ff",
    40: "#c2d6ff",
    50: "#aec9ff",
    60: "#98bbff",
    70: "#7faaff",
    80: "#6297ff",
    90: "#3f7fff",
    100: "#1e6cff",
    110: "#0d59fb",
    120: "#003ceb",
    130: "#0034cf",
    140: "#002eb3",
    150: "#002796",
    160: "#001f78"
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
    theme.colorBrandBackgroundSelected = tokens.primaryPressed;
    theme.colorBrandBackground2 = tokens.primarySubtle;
    theme.colorBrandBackground2Hover = tokens.primarySubtle;
    theme.colorBrandBackground2Pressed = tokens.primarySubtle;
    theme.colorBrandBackgroundStatic = tokens.primaryBase;
    theme.colorBrandBackgroundInverted = tokens.textOnPrimary;
    theme.colorBrandBackgroundInvertedHover = tokens.primaryHover;
    theme.colorBrandBackgroundInvertedPressed = tokens.primaryPressed;
    theme.colorCompoundBrandBackground = tokens.primaryBase;
    theme.colorCompoundBrandBackgroundHover = tokens.primaryHover;
    theme.colorCompoundBrandBackgroundPressed = tokens.primaryPressed;

    // Text Colors
    theme.colorNeutralForeground1 = tokens.textDefault;
    theme.colorNeutralForeground2 = tokens.textSecondary;
    theme.colorNeutralForeground3 = tokens.textTertiary;
    theme.colorNeutralForeground4 = tokens.textSecondary;
    theme.colorNeutralForegroundDisabled = tokens.disabledForeground;

    // Text on Primary
    theme.colorNeutralForegroundOnBrand = tokens.textOnPrimary;
    theme.colorNeutralForegroundInverted = tokens.textOnHeader;

    // Brand foreground colors
    theme.colorBrandForeground1 = tokens.primaryStrong;
    theme.colorBrandForeground2 = tokens.primarySubtleOn;
    theme.colorBrandForeground2Hover = tokens.primarySubtleOn;
    theme.colorBrandForeground2Pressed = tokens.primarySubtleOn;
    theme.colorBrandForegroundLink = tokens.primaryStrong;
    theme.colorBrandForegroundLinkHover = tokens.primaryHover;
    theme.colorBrandForegroundLinkPressed = tokens.primaryPressed;
    theme.colorBrandForegroundLinkSelected = tokens.primaryStrong;
    theme.colorBrandForegroundOnLight = tokens.primaryStrong;
    theme.colorBrandForegroundOnLightHover = tokens.primaryHover;
    theme.colorBrandForegroundOnLightPressed = tokens.primaryPressed;
    theme.colorBrandForegroundOnLightSelected = tokens.primaryStrong;
    theme.colorBrandForegroundInverted = tokens.textOnPrimary;
    theme.colorBrandForegroundInvertedHover = tokens.textOnPrimary;
    theme.colorBrandForegroundInvertedPressed = tokens.textOnPrimary;
    theme.colorCompoundBrandForeground1 = tokens.primaryStrong;
    theme.colorCompoundBrandForeground1Hover = tokens.primaryHover;
    theme.colorCompoundBrandForeground1Pressed = tokens.primaryPressed;

    // Surface Variants
    theme.colorNeutralBackground1Hover = tokens.surfaceSubtle;
    theme.colorNeutralBackground1Pressed = tokens.headerSubtle;
    theme.colorNeutralBackgroundDisabled = tokens.disabledBackground;

    // Borders/Strokes
    theme.colorNeutralStroke1 = tokens.outlineBase;
    theme.colorNeutralStroke2 = tokens.outlineSubtle;
    theme.colorBrandStroke1 = tokens.primaryStrong;
    theme.colorBrandStroke2 = tokens.outlineHover;
    theme.colorBrandStroke2Hover = tokens.outlineHover;
    theme.colorBrandStroke2Pressed = tokens.outlineHover;
    theme.colorBrandStroke2Contrast = tokens.outlineHover;
    theme.colorNeutralStrokeAccessible = tokens.outlineHover;
    theme.colorNeutralStrokeDisabled = tokens.disabledBorder;
    theme.colorCompoundBrandStroke = tokens.primaryStrong;
    theme.colorCompoundBrandStrokeHover = tokens.primaryHover;
    theme.colorCompoundBrandStrokePressed = tokens.primaryPressed;

    // Overlay for hero section background
    theme.colorBackgroundOverlay = tokens.surfaceSubtle;

    // Focus and subtle header-friendly actions
    theme.colorStrokeFocus2 = tokens.focusRing;
    theme.colorSubtleForeground = tokens.textOnHeader;
    theme.colorSubtleForegroundHover = tokens.textOnHeader;
    theme.colorSubtleForegroundPressed = tokens.textOnHeader;
    theme.colorSubtleBackgroundHover = tokens.headerHover;
    theme.colorSubtleBackgroundPressed = tokens.headerPressed;

    theme.colorStatusSuccessBackground1 = tokens.statusSuccessBackground;
    theme.colorStatusSuccessForeground1 = tokens.statusSuccessForeground;
    theme.colorStatusWarningBackground1 = tokens.statusWarningBackground;
    theme.colorStatusWarningForeground1 = tokens.statusWarningForeground;
    theme.colorStatusDangerBackground1 = tokens.statusErrorBackground;
    theme.colorStatusDangerForeground1 = tokens.statusErrorForeground;
};

export const adjustTheme = (isLight: boolean, scaling: number) => {
    const theme = isLight ? createLightTheme(fallbackBrandRamp) : createDarkTheme(fallbackBrandRamp);

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
