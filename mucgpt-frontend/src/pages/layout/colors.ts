// Theme Color Definitions

export interface ThemeColors {
    surface: string;
    onSurface: string;
    onSurfaceVariant: string;
    primary: string;
    onPrimary: string;
    onPrimaryVariant: string;
    outline: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    disabled: string;
}

export const lightThemeColors: ThemeColors = {
    surface: "#F7FAF8",
    onSurface: "#191C1B",
    onSurfaceVariant: "#3A413E",
    primary: "#94B9AF",
    onPrimary: "#001412",
    onPrimaryVariant: "#001412",
    outline: "#BEC9C6",
    primaryContainer: "#E6EFED",
    onPrimaryContainer: "#5C6664",
    disabled: "#A9A3A3"
};

export const darkThemeColors: ThemeColors = {
    surface: "#191C1B",
    onSurface: "#D9D9D9",
    onSurfaceVariant: "#B8B8B8",
    primary: "#003631",
    onPrimary: "#B5CFC8",
    onPrimaryVariant: "#FFFFFF",
    outline: "#EDF2EC",
    primaryContainer: "#5C6664",
    onPrimaryContainer: "#E6EFED",
    disabled: "#F5F5F5"
};
