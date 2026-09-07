import { infoRamp } from "./palette";

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
}

const lightAppTokens: AppTokens = {
    userMessageBackground: "#E8F0FE",
    assistantConfigSurface: "#F8FAFC",
    assistantConfigSurfaceHover: "#F1F6FD",
    assistantConfigSurfaceEditing: "#EFF6FF",
    assistantConfigBorder: "#C7D7F2",
    assistantConfigBorderHover: "#9DB5E8",
    statusInfoBorder: infoRamp.light
};

const darkAppTokens: AppTokens = {
    userMessageBackground: "#1E293B",
    assistantConfigSurface: "#0B1224",
    assistantConfigSurfaceHover: "#111C34",
    assistantConfigSurfaceEditing: "#101A31",
    assistantConfigBorder: "#263653",
    assistantConfigBorderHover: "#3A4D73",
    statusInfoBorder: infoRamp.medium
};

export const getAppTokens = (isLight: boolean): AppTokens => (isLight ? lightAppTokens : darkAppTokens);

type AppCssVariableName =
    | "--app-primary-subtle-foreground"
    | "--app-user-message-background"
    | "--app-assistant-config-surface"
    | "--app-assistant-config-surface-hover"
    | "--app-assistant-config-surface-editing"
    | "--app-assistant-config-border"
    | "--app-assistant-config-border-hover"
    | "--app-status-info-border"
    | "--app-radius-xsmall"
    | "--app-radius-xxlarge";

export type AppCssVariables = Record<AppCssVariableName, string>;

export const createAppCssVars = (tokens: AppTokens): AppCssVariables => ({
    // Compatibility for DiscoveryCard until its design-system update lands.
    "--app-primary-subtle-foreground": "var(--colorBrandForeground2)",
    "--app-user-message-background": tokens.userMessageBackground,
    "--app-assistant-config-surface": tokens.assistantConfigSurface,
    "--app-assistant-config-surface-hover": tokens.assistantConfigSurfaceHover,
    "--app-assistant-config-surface-editing": tokens.assistantConfigSurfaceEditing,
    "--app-assistant-config-border": tokens.assistantConfigBorder,
    "--app-assistant-config-border-hover": tokens.assistantConfigBorderHover,
    "--app-status-info-border": tokens.statusInfoBorder,
    // Chat-bubble geometry: not part of Fluent's radius scale, constant across themes.
    "--app-radius-xsmall": "2px",
    "--app-radius-xxlarge": "24px"
});
