import { Button, Tooltip } from "@fluentui/react-components";
import { useState, useEffect, useCallback } from "react";
import { WeatherSunny24Regular, WeatherMoon24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import styles from "./ThemeSelector.module.css";

interface ThemeSelectorProps {
    isLight: boolean;
    onThemeChange: (isLight: boolean) => void;
}

export const ThemeSelector = ({ isLight, onThemeChange }: ThemeSelectorProps) => {
    const [currentIsLight, setCurrentIsLight] = useState(isLight);
    const { t } = useTranslation();

    // Handle button click to toggle theme
    const handleButtonClick = useCallback(() => {
        const newIsLight = !currentIsLight;
        setCurrentIsLight(newIsLight);
        onThemeChange(newIsLight);
    }, [currentIsLight, onThemeChange]);

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

    // Get the theme text to display in tooltip
    const themeText = currentIsLight ? t("components.theme_selector.theme_light") : t("components.theme_selector.theme_dark");

    const tooltipContent = `${themeText} - ${t("components.theme_selector.change_theme")}`;

    return (
        <Tooltip content={tooltipContent} relationship="description" positioning="below">
            <Button
                appearance={"subtle"}
                onClick={handleButtonClick}
                aria-label={tooltipContent}
                onKeyDown={handleKeyDown}
                icon={currentIsLight ? <WeatherSunny24Regular className={styles.icon} /> : <WeatherMoon24Regular className={styles.icon} />}
                className={styles.themeButton}
            >
                {currentIsLight ? t("components.theme_selector.light_short") : t("components.theme_selector.dark_short")}
            </Button>
        </Tooltip>
    );
};

export default ThemeSelector;
