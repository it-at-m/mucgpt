import { Menu, MenuItemRadio, MenuList, MenuPopover, MenuTrigger } from "@fluentui/react-components";
import { DarkTheme20Regular, Desktop20Regular, WeatherMoon20Regular, WeatherSunny20Regular } from "@fluentui/react-icons";
import { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { THEME_PREFERENCES, ThemePreference } from "../../hooks/useThemePreference";
import { MenuItem } from "../../ui/MenuItem";
import styles from "./ThemeSelector.module.css";

interface ThemeSelectorProps {
    themePreference: ThemePreference;
    onThemePreferenceChange: (themePreference: ThemePreference) => void;
}

const THEME_ICONS: Record<ThemePreference, ReactElement> = {
    light: <WeatherSunny20Regular />,
    dark: <WeatherMoon20Regular />,
    system: <Desktop20Regular />
};

export const ThemeSelector = ({ themePreference, onThemePreferenceChange }: ThemeSelectorProps) => {
    const { t } = useTranslation();

    return (
        <Menu openOnHover={false} persistOnItemClick positioning={{ position: "after", align: "start", offset: { mainAxis: 8 } }}>
            <MenuTrigger disableButtonEnhancement>
                <MenuItem hasSubmenu icon={<DarkTheme20Regular />}>
                    {t("components.theme_selector.label")}
                </MenuItem>
            </MenuTrigger>
            <MenuPopover>
                <MenuList checkedValues={{ theme: [themePreference] }}>
                    {THEME_PREFERENCES.map(preference => (
                        <MenuItemRadio
                            key={preference}
                            name="theme"
                            value={preference}
                            icon={THEME_ICONS[preference]}
                            checkmark={{ className: styles.checkmark }}
                            onClick={() => onThemePreferenceChange(preference)}
                        >
                            {t(`components.theme_selector.${preference}`)}
                        </MenuItemRadio>
                    ))}
                </MenuList>
            </MenuPopover>
        </Menu>
    );
};

export default ThemeSelector;
