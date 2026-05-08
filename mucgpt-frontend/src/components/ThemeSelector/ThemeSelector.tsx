import { Button, Switch } from "@fluentui/react-components";
import { useState, useEffect, useCallback } from "react";
import { WeatherSunny20Regular, WeatherMoon20Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import styles from "./ThemeSelector.module.css";

interface ThemeSelectorProps {
    isLight: boolean;
    onThemeChange: (isLight: boolean) => void;
    label?: string;
    layout?: "default" | "row";
}

export const ThemeSelector = ({ isLight, onThemeChange, layout = "default" }: ThemeSelectorProps) => {
    const [currentIsLight, setCurrentIsLight] = useState(isLight);
    const { t } = useTranslation();
    const themeIcon = currentIsLight ? <WeatherSunny20Regular className={styles.icon} /> : <WeatherMoon20Regular className={styles.icon} />;

    const updateTheme = useCallback(
        (newIsLight: boolean) => {
            setCurrentIsLight(newIsLight);
            onThemeChange(newIsLight);
        },
        [onThemeChange]
    );

    // Handle button click to toggle theme
    const handleButtonClick = useCallback(() => {
        updateTheme(!currentIsLight);
    }, [currentIsLight, updateTheme]);

    const handleSwitchChange = useCallback(
        (_event: React.ChangeEvent<HTMLInputElement>, data: { checked: boolean }) => {
            updateTheme(!data.checked);
        },
        [updateTheme]
    );

    // Update state when prop changes
    useEffect(() => {
        setCurrentIsLight(isLight);
    }, [isLight]);

    // Memoize the keyboard handler
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                handleButtonClick();
                e.preventDefault();
            }
        },
        [handleButtonClick]
    );

    const themeText = currentIsLight ? t("components.theme_selector.theme_light") : t("components.theme_selector.theme_dark");

    if (layout === "row") {
        return (
            <div className={styles.themeSwitchRow} onClick={handleButtonClick} role="button" tabIndex={0} onKeyDown={handleKeyDown}>
                <span className={styles.rowContent}>
                    {themeIcon}
                    <span className={styles.rowLabel}>{themeText}</span>
                </span>
                <Switch checked={!currentIsLight} onChange={handleSwitchChange} aria-label={themeText} onClick={e => e.stopPropagation()} />
            </div>
        );
    }

    return (
        <Button
            appearance={"subtle"}
            onClick={handleButtonClick}
            aria-label={themeText}
            onKeyDown={handleKeyDown}
            icon={themeIcon}
            className={styles.themeButton}
        >
            {themeText}
        </Button>
    );
};

export default ThemeSelector;
