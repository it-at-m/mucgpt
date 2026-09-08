import { MenuItem } from "@fluentui/react-components";
import { WeatherSunny20Regular, WeatherMoon20Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

interface ThemeSelectorProps {
    isLight: boolean;
    onThemeChange: (isLight: boolean) => void;
}

export const ThemeSelector = ({ isLight, onThemeChange }: ThemeSelectorProps) => {
    const { t } = useTranslation();
    const themeText = isLight ? t("components.theme_selector.theme_light") : t("components.theme_selector.theme_dark");

    return (
        <MenuItem icon={isLight ? <WeatherSunny20Regular /> : <WeatherMoon20Regular />} onClick={() => onThemeChange(!isLight)}>
            {themeText}
        </MenuItem>
    );
};

export default ThemeSelector;
