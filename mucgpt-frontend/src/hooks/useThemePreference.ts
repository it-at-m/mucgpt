import { useCallback, useState, useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "../pages/layout/LayoutHelper";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const DARK_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

const isThemePreference = (value: string | null): value is ThemePreference => THEME_PREFERENCES.some(preference => preference === value);

const readStoredThemePreference = (): ThemePreference => {
    const storedPreference = localStorage.getItem(STORAGE_KEYS.SETTINGS_THEME);
    if (isThemePreference(storedPreference)) {
        return storedPreference;
    }
    // Before the system option existed, only a light/dark flag was stored.
    return localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) === "false" ? "dark" : "light";
};

const subscribeToSystemColorScheme = (onChange: () => void) => {
    const mediaQuery = window.matchMedia(DARK_COLOR_SCHEME_QUERY);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
};

const getSystemPrefersDark = () => window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches;

export const useThemePreference = () => {
    const [themePreference, setThemePreferenceState] = useState<ThemePreference>(readStoredThemePreference);
    const systemPrefersDark = useSyncExternalStore(subscribeToSystemColorScheme, getSystemPrefersDark);
    const isLight = themePreference === "system" ? !systemPrefersDark : themePreference === "light";

    const setThemePreference = useCallback((preference: ThemePreference) => {
        setThemePreferenceState(preference);
        localStorage.setItem(STORAGE_KEYS.SETTINGS_THEME, preference);
        localStorage.removeItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME);
    }, []);

    return { themePreference, setThemePreference, isLight };
};
