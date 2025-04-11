import { BrandVariants, createDarkTheme, createLightTheme, makeStyles } from "@fluentui/react-components";
import { tokens } from "@fluentui/react-theme";

export const useStyles = makeStyles({
    header: {
        backgroundColor: tokens.colorBrandBackground2,
        color: tokens.colorBrandForeground2
    }
});

export const enum STORAGE_KEYS {
    TERMS_OF_USE_READ = "TERMS_OF_USE_READ",
    SETTINGS_LANGUAGE = "SETTINGS_LANGUAGE",
    SETTINGS_LLM = "SETTINGS_LLM",
    SETTINGS_FONT_SCALING = "SETTINGS_FONT_SCALING",
    SETTINGS_IS_LIGHT_THEME = "SETTINGS_IS_LIGHT_THEME",
    VERSION_UPDATE_SEEN = "VERSION_UPDATE_SEEN",
    SHOW_SIDEBAR = "SHOW_SIDEBAR",
}

const customBrandRamp: BrandVariants = {
    10: "#f2f2f2",
    20: "#e4e4e5",
    30: "#d6d6d8",
    40: "#c8c8cb",
    50: "#bababe",
    60: "#acacb1",
    70: "#9e9ea4",
    80: "#909097",
    90: "#82828a",
    100: "#74747d",
    110: "#666670",
    120: "#585863",
    130: "#4a4a56",
    140: "#3c3c49",
    150: "#2e2e3c",
    160: "#212529"
};
export const adjustTheme = (isLight: boolean, scaling: number) => {
    let theme = isLight ? createLightTheme(customBrandRamp) : createDarkTheme(customBrandRamp);
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
