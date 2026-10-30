import { infoRamp, mucgptBrandRamp, neutralRamp } from "./palette";

/**
 * Product-specific semantics that Fluent's theme does not model.
 * Everything Fluent already owns (brand, neutral, status colors, radii)
 * is provided by createMucgptTheme instead.
 */
export interface AppTokens {
    userMessageBackground: string;
    assistantConfigSurface: string;
    assistantConfigSurfaceHover: string;
    assistantConfigSurfaceEditing: string;
    assistantConfigBorder: string;
    assistantConfigBorderHover: string;
    statusInfoBorder: string;
    progressHighlight: string;
    canvasSelectionBackground: string;
}

const lightAppTokens: AppTokens = {
    userMessageBackground: "#FFFFFF",
    assistantConfigSurface: "#F8FAFC",
    assistantConfigSurfaceHover: "#F1F6FD",
    assistantConfigSurfaceEditing: "#EFF6FF",
    assistantConfigBorder: "#C7D7F2",
    assistantConfigBorderHover: "#9DB5E8",
    statusInfoBorder: infoRamp.light,
    progressHighlight: mucgptBrandRamp[90],
    canvasSelectionBackground: mucgptBrandRamp[130]
};

const darkAppTokens: AppTokens = {
    userMessageBackground: "#1E293B",
    assistantConfigSurface: neutralRamp[50],
    assistantConfigSurfaceHover: neutralRamp[30],
    assistantConfigSurfaceEditing: neutralRamp[60],
    assistantConfigBorder: "#263653",
    assistantConfigBorderHover: "#3A4D73",
    statusInfoBorder: infoRamp.medium,
    progressHighlight: mucgptBrandRamp[120],
    canvasSelectionBackground: mucgptBrandRamp[30]
};

export const getAppTokens = (isLight: boolean): AppTokens => (isLight ? lightAppTokens : darkAppTokens);

type AppCssVariableName =
    | "--app-user-message-background"
    | "--app-assistant-config-surface"
    | "--app-assistant-config-surface-hover"
    | "--app-assistant-config-surface-editing"
    | "--app-assistant-config-border"
    | "--app-assistant-config-border-hover"
    | "--app-status-info-border"
    | "--app-progress-highlight"
    | "--app-canvas-selection-background"
    | "--app-radius-xsmall"
    | "--app-radius-xxlarge";

export type AppCssVariables = Record<AppCssVariableName, string>;

export const createAppCssVars = (tokens: AppTokens): AppCssVariables => ({
    "--app-user-message-background": tokens.userMessageBackground,
    "--app-assistant-config-surface": tokens.assistantConfigSurface,
    "--app-assistant-config-surface-hover": tokens.assistantConfigSurfaceHover,
    "--app-assistant-config-surface-editing": tokens.assistantConfigSurfaceEditing,
    "--app-assistant-config-border": tokens.assistantConfigBorder,
    "--app-assistant-config-border-hover": tokens.assistantConfigBorderHover,
    "--app-status-info-border": tokens.statusInfoBorder,
    // Light brand blue that sweeps over in-progress status text (the shimmer); never used as a text color on its own.
    "--app-progress-highlight": tokens.progressHighlight,
    // Visible text-selection tint for the canvas editor's persistent selection/caret
    // (Fluent's colorNeutralBackground2Selected is remapped to a near-background
    // tone for control surfaces and is invisible behind editor text).
    "--app-canvas-selection-background": tokens.canvasSelectionBackground,
    // Chat-bubble geometry: not part of Fluent's radius scale, constant across themes.
    "--app-radius-xsmall": "2px",
    "--app-radius-xxlarge": "24px"
});
