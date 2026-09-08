import { createDarkTheme, createLightTheme, type Theme } from "@fluentui/react-components";

import { dangerRamp, mucgptBrandRamp, neutralRamp, successRamp, warningRamp } from "./palette";

// Derives a translucent tint from a palette primitive. Subtle/transparent Buttons and
// MenuItems render on every neutral surface tier (Background1/2/3), so their hover/pressed
// fill can't be a fixed opaque ramp step without risking an exact match with the surface it
// sits on. A translucent tint instead darkens/lightens whatever is underneath, staying
// visible and on-brand on any surface.
const withAlpha = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const shapeOverrides = {
    borderRadiusSmall: "6px",
    borderRadiusMedium: "10px",
    borderRadiusLarge: "12px",
    borderRadiusXLarge: "16px"
} satisfies Partial<Theme>;

const lightNeutralOverrides = {
    // Surfaces
    colorNeutralBackground1: neutralRamp[160],
    colorNeutralBackground1Hover: neutralRamp[150],
    colorNeutralBackground1Pressed: neutralRamp[140],
    colorNeutralBackground1Selected: neutralRamp[150],

    colorNeutralBackground2: neutralRamp[150],
    colorNeutralBackground2Hover: neutralRamp[160],
    colorNeutralBackground2Pressed: neutralRamp[140],
    colorNeutralBackground2Selected: neutralRamp[160],

    colorNeutralBackground3: neutralRamp[140],
    colorNeutralBackground3Hover: neutralRamp[150],
    colorNeutralBackground3Pressed: neutralRamp[130],
    colorNeutralBackground3Selected: neutralRamp[150],

    // Cards
    colorNeutralCardBackground: neutralRamp[160],
    colorNeutralCardBackgroundHover: neutralRamp[150],
    colorNeutralCardBackgroundPressed: neutralRamp[140],
    colorNeutralCardBackgroundSelected: neutralRamp[150],
    colorNeutralCardBackgroundDisabled: neutralRamp[150],

    // Text
    colorNeutralForeground1: neutralRamp[40],
    colorNeutralForeground1Hover: neutralRamp[30],
    colorNeutralForeground1Pressed: neutralRamp[30],
    colorNeutralForeground1Selected: neutralRamp[30],

    colorNeutralForeground2: neutralRamp[60],
    colorNeutralForeground2Hover: neutralRamp[50],
    colorNeutralForeground2Pressed: neutralRamp[50],
    colorNeutralForeground2Selected: neutralRamp[50],

    // Fluent's subtle/transparent Button tints its icon with these "Brand" hover/pressed
    // tokens while the label uses the plain Foreground2 tokens above. Aliasing them to the
    // same value keeps icon and label color in sync instead of the icon jumping to brand blue.
    colorNeutralForeground2BrandHover: neutralRamp[50],
    colorNeutralForeground2BrandPressed: neutralRamp[50],

    colorNeutralForeground3: neutralRamp[70],
    colorNeutralForeground3Hover: neutralRamp[60],
    colorNeutralForeground3Pressed: neutralRamp[60],
    colorNeutralForeground3Selected: neutralRamp[60],

    colorNeutralForeground4: neutralRamp[80],

    // Disabled
    colorNeutralBackgroundDisabled: neutralRamp[140],
    colorNeutralForegroundDisabled: neutralRamp[90],
    colorNeutralStrokeDisabled: neutralRamp[120],

    // Borders
    colorNeutralStroke1: neutralRamp[100],
    colorNeutralStroke1Hover: neutralRamp[90],
    colorNeutralStroke1Pressed: neutralRamp[80],
    colorNeutralStroke1Selected: neutralRamp[90],

    colorNeutralStroke2: neutralRamp[110],
    colorNeutralStroke3: neutralRamp[120],
    colorNeutralStrokeSubtle: neutralRamp[120],
    colorNeutralStrokeAccessible: neutralRamp[70],

    // Subtle/transparent Button and MenuItem hover/pressed backgrounds. Left unset, these
    // fall back to Fluent's stock neutral ramp instead of this app's cooler-tinted one, so the
    // hover reads as an unrelated flat gray. See `withAlpha` above for why this is a tint
    // rather than a fixed ramp step.
    colorSubtleBackgroundHover: withAlpha(neutralRamp[40], 0.06),
    colorSubtleBackgroundPressed: withAlpha(neutralRamp[40], 0.1),

    // Text on brand surfaces
    colorNeutralForegroundOnBrand: neutralRamp[160],

    // Focus
    colorStrokeFocus2: mucgptBrandRamp[80]
} satisfies Partial<Theme>;

const darkNeutralOverrides = {
    // Surfaces
    colorNeutralBackground1: neutralRamp[40],
    colorNeutralBackground1Hover: neutralRamp[50],
    colorNeutralBackground1Pressed: neutralRamp[30],
    colorNeutralBackground1Selected: neutralRamp[50],

    colorNeutralBackground2: neutralRamp[30],
    colorNeutralBackground2Hover: neutralRamp[40],
    colorNeutralBackground2Pressed: neutralRamp[20],
    colorNeutralBackground2Selected: neutralRamp[40],

    colorNeutralBackground3: neutralRamp[20],
    colorNeutralBackground3Hover: neutralRamp[30],
    colorNeutralBackground3Pressed: neutralRamp[10],
    colorNeutralBackground3Selected: neutralRamp[30],

    // Cards
    colorNeutralCardBackground: neutralRamp[40],
    colorNeutralCardBackgroundHover: neutralRamp[50],
    colorNeutralCardBackgroundPressed: neutralRamp[30],
    colorNeutralCardBackgroundSelected: neutralRamp[50],
    colorNeutralCardBackgroundDisabled: neutralRamp[30],

    // Text
    colorNeutralForeground1: neutralRamp[150],
    colorNeutralForeground1Hover: neutralRamp[160],
    colorNeutralForeground1Pressed: neutralRamp[160],
    colorNeutralForeground1Selected: neutralRamp[160],

    colorNeutralForeground2: neutralRamp[110],
    colorNeutralForeground2Hover: neutralRamp[120],
    colorNeutralForeground2Pressed: neutralRamp[120],
    colorNeutralForeground2Selected: neutralRamp[120],

    // Keep the subtle/transparent Button icon color in sync with its label (see light theme).
    colorNeutralForeground2BrandHover: neutralRamp[120],
    colorNeutralForeground2BrandPressed: neutralRamp[120],

    colorNeutralForeground3: neutralRamp[100],
    colorNeutralForeground3Hover: neutralRamp[110],
    colorNeutralForeground3Pressed: neutralRamp[110],
    colorNeutralForeground3Selected: neutralRamp[110],

    colorNeutralForeground4: neutralRamp[100],

    // Disabled
    colorNeutralBackgroundDisabled: neutralRamp[30],
    colorNeutralForegroundDisabled: neutralRamp[70],
    colorNeutralStrokeDisabled: neutralRamp[30],

    // Borders
    colorNeutralStroke1: neutralRamp[90],
    colorNeutralStroke1Hover: neutralRamp[100],
    colorNeutralStroke1Pressed: neutralRamp[80],
    colorNeutralStroke1Selected: neutralRamp[100],

    colorNeutralStroke2: neutralRamp[70],
    colorNeutralStroke3: neutralRamp[50],
    colorNeutralStrokeSubtle: neutralRamp[50],
    colorNeutralStrokeAccessible: neutralRamp[100],

    // See withAlpha and the light theme override above.
    colorSubtleBackgroundHover: withAlpha(neutralRamp[150], 0.08),
    colorSubtleBackgroundPressed: withAlpha(neutralRamp[150], 0.14),

    // Dark primary surfaces use a light brand color,
    // therefore foreground-on-brand needs to be dark.
    colorNeutralForegroundOnBrand: neutralRamp[10],

    // Focus
    colorStrokeFocus2: mucgptBrandRamp[100]
} satisfies Partial<Theme>;

const darkBrandOverrides = {
    // Primary action
    colorBrandBackground: mucgptBrandRamp[100],
    colorBrandBackgroundHover: mucgptBrandRamp[110],
    colorBrandBackgroundPressed: mucgptBrandRamp[90],
    colorBrandBackgroundSelected: mucgptBrandRamp[100]
} satisfies Partial<Theme>;

const lightStatusOverrides = {
    // Success
    colorStatusSuccessBackground1: successRamp.tint60,
    colorStatusSuccessBackground2: successRamp.tint40,
    colorStatusSuccessBackground3: successRamp.primary,

    colorStatusSuccessForeground1: successRamp.shade30,
    colorStatusSuccessForeground2: successRamp.shade40,
    colorStatusSuccessForeground3: successRamp.primary,
    colorStatusSuccessForegroundInverted: successRamp.tint30,

    colorStatusSuccessBorder1: successRamp.tint20,
    colorStatusSuccessBorder2: successRamp.primary,
    colorStatusSuccessBorderActive: successRamp.shade30,

    // Warning
    colorStatusWarningBackground1: warningRamp.tint60,
    colorStatusWarningBackground2: warningRamp.tint40,
    colorStatusWarningBackground3: warningRamp.primary,

    colorStatusWarningForeground1: warningRamp.shade30,
    colorStatusWarningForeground2: warningRamp.shade40,
    colorStatusWarningForeground3: warningRamp.primary,
    colorStatusWarningForegroundInverted: warningRamp.tint30,

    colorStatusWarningBorder1: warningRamp.tint20,
    colorStatusWarningBorder2: warningRamp.primary,
    colorStatusWarningBorderActive: warningRamp.shade30,

    // Danger
    colorStatusDangerBackground1: dangerRamp.tint60,
    colorStatusDangerBackground2: dangerRamp.tint40,
    colorStatusDangerBackground3: dangerRamp.primary,
    colorStatusDangerBackground3Hover: dangerRamp.shade30,
    colorStatusDangerBackground3Pressed: dangerRamp.shade40,

    colorStatusDangerForeground1: dangerRamp.shade30,
    colorStatusDangerForeground2: dangerRamp.shade40,
    colorStatusDangerForeground3: dangerRamp.primary,
    colorStatusDangerForegroundInverted: dangerRamp.tint30,

    colorStatusDangerBorder1: dangerRamp.tint20,
    colorStatusDangerBorder2: dangerRamp.primary,
    colorStatusDangerBorderActive: dangerRamp.shade30
} satisfies Partial<Theme>;

// Dark solid status surfaces take a light fill with near-black text, the same
// inversion the brand color uses, so Background3 climbs the ramp instead of
// staying on `primary`.
const darkStatusOverrides = {
    // Success
    colorStatusSuccessBackground1: successRamp.shade40,
    colorStatusSuccessBackground2: successRamp.shade30,
    colorStatusSuccessBackground3: successRamp.tint30,

    colorStatusSuccessForeground1: successRamp.tint30,
    colorStatusSuccessForeground2: successRamp.tint40,
    colorStatusSuccessForeground3: successRamp.tint40,
    colorStatusSuccessForegroundInverted: successRamp.shade30,

    colorStatusSuccessBorder1: successRamp.tint20,
    colorStatusSuccessBorder2: successRamp.tint40,
    colorStatusSuccessBorderActive: successRamp.tint30,

    // Warning
    colorStatusWarningBackground1: warningRamp.shade40,
    colorStatusWarningBackground2: warningRamp.shade30,
    colorStatusWarningBackground3: warningRamp.tint30,

    colorStatusWarningForeground1: warningRamp.tint30,
    colorStatusWarningForeground2: warningRamp.tint40,
    colorStatusWarningForeground3: warningRamp.tint30,
    colorStatusWarningForegroundInverted: warningRamp.shade30,

    colorStatusWarningBorder1: warningRamp.tint20,
    colorStatusWarningBorder2: warningRamp.tint30,
    colorStatusWarningBorderActive: warningRamp.tint30,

    // Danger
    colorStatusDangerBackground1: dangerRamp.shade40,
    colorStatusDangerBackground2: dangerRamp.shade30,
    colorStatusDangerBackground3: dangerRamp.tint30,
    colorStatusDangerBackground3Hover: dangerRamp.tint40,
    colorStatusDangerBackground3Pressed: dangerRamp.tint20,

    colorStatusDangerForeground1: dangerRamp.tint30,
    colorStatusDangerForeground2: dangerRamp.tint40,
    colorStatusDangerForeground3: dangerRamp.tint40,
    colorStatusDangerForegroundInverted: dangerRamp.shade30,

    colorStatusDangerBorder1: dangerRamp.tint20,
    colorStatusDangerBorder2: dangerRamp.tint30,
    colorStatusDangerBorderActive: dangerRamp.tint30
} satisfies Partial<Theme>;

/**
 * Fluent's Badge, MessageBar, Link and Button read the raw --colorPalette* ramps,
 * which createLightTheme/createDarkTheme leave at their stock values. Without these
 * aliases the app renders status UI in two unrelated palettes: themed --colorStatus*
 * where components style themselves, stock Fluent red/green/yellow where they rely
 * on Fluent. The aliases point at the status overrides above rather than at the
 * ramps directly, so the two families can never drift apart.
 */
const paletteAliases = (status: typeof lightStatusOverrides | typeof darkStatusOverrides) =>
    ({
        colorPaletteGreenBackground1: status.colorStatusSuccessBackground1,
        colorPaletteGreenBackground2: status.colorStatusSuccessBackground2,
        colorPaletteGreenBackground3: status.colorStatusSuccessBackground3,
        colorPaletteGreenForeground1: status.colorStatusSuccessForeground1,
        colorPaletteGreenForeground2: status.colorStatusSuccessForeground2,
        colorPaletteGreenForeground3: status.colorStatusSuccessForeground3,
        colorPaletteGreenForegroundInverted: status.colorStatusSuccessForegroundInverted,
        colorPaletteGreenBorder1: status.colorStatusSuccessBorder1,
        colorPaletteGreenBorder2: status.colorStatusSuccessBorder2,
        colorPaletteGreenBorderActive: status.colorStatusSuccessBorderActive,

        colorPaletteYellowBackground1: status.colorStatusWarningBackground1,
        colorPaletteYellowBackground2: status.colorStatusWarningBackground2,
        colorPaletteYellowBackground3: status.colorStatusWarningBackground3,
        colorPaletteYellowForeground1: status.colorStatusWarningForeground1,
        colorPaletteYellowForeground2: status.colorStatusWarningForeground2,
        colorPaletteYellowForeground3: status.colorStatusWarningForeground3,
        colorPaletteYellowForegroundInverted: status.colorStatusWarningForegroundInverted,
        colorPaletteYellowBorder1: status.colorStatusWarningBorder1,
        colorPaletteYellowBorder2: status.colorStatusWarningBorder2,
        colorPaletteYellowBorderActive: status.colorStatusWarningBorderActive,

        colorPaletteRedBackground1: status.colorStatusDangerBackground1,
        colorPaletteRedBackground2: status.colorStatusDangerBackground2,
        colorPaletteRedBackground3: status.colorStatusDangerBackground3,
        colorPaletteRedForeground1: status.colorStatusDangerForeground1,
        colorPaletteRedForeground2: status.colorStatusDangerForeground2,
        colorPaletteRedForeground3: status.colorStatusDangerForeground3,
        colorPaletteRedForegroundInverted: status.colorStatusDangerForegroundInverted,
        colorPaletteRedBorder1: status.colorStatusDangerBorder1,
        colorPaletteRedBorder2: status.colorStatusDangerBorder2,
        colorPaletteRedBorderActive: status.colorStatusDangerBorderActive
    }) satisfies Partial<Theme>;

export const createMucgptTheme = (isLight: boolean): Theme => {
    const baseTheme = isLight ? createLightTheme(mucgptBrandRamp) : createDarkTheme(mucgptBrandRamp);

    return {
        ...baseTheme,
        ...shapeOverrides,
        ...(isLight
            ? {
                  ...lightNeutralOverrides,
                  ...lightStatusOverrides,
                  ...paletteAliases(lightStatusOverrides)
              }
            : {
                  ...darkNeutralOverrides,
                  ...darkBrandOverrides,
                  ...darkStatusOverrides,
                  ...paletteAliases(darkStatusOverrides)
              })
    };
};

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

// Scales Fluent's font-size and line-height tokens for the user-configurable
// font scaling accessibility setting. Applied after createMucgptTheme.
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
