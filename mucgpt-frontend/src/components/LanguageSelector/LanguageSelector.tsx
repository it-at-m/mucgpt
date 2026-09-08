import { Menu, MenuItem, MenuPopover, MenuTrigger } from "@fluentui/react-components";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import styles from "./LanguageSelector.module.css";

interface LanguageSelectorProps {
    onSelectionChange: (newSelection: string) => void;
    defaultlang: string;
}

interface Language {
    code: string;
    flagClassName: string;
}

// Defining languages outside component to avoid re-creation on each render
const AVAILABLE_LANGUAGES: Language[] = [
    { code: "DE", flagClassName: styles.languageFlagDE },
    { code: "EN", flagClassName: styles.languageFlagEN },
    { code: "BA", flagClassName: styles.languageFlagBA },
    { code: "FR", flagClassName: styles.languageFlagFR },
    { code: "UK", flagClassName: styles.languageFlagUK }
];

export const LanguageSelector = ({ onSelectionChange, defaultlang }: LanguageSelectorProps) => {
    const [selectedLang, setSelectedLang] = useState(defaultlang);
    const { t } = useTranslation();
    // Handle button click - cycle through languages with useCallback for stability
    const handleButtonClick = useCallback(
        (language: Language) => {
            setSelectedLang(language.code);
            onSelectionChange(language.code);
        },
        [onSelectionChange]
    );

    // Update selected language when defaultlang prop changes
    useEffect(() => {
        setSelectedLang(defaultlang);
    }, [defaultlang]);

    // Memoize the current language to prevent unnecessary re-calculations
    const currentLanguage = useMemo(() => {
        const current = AVAILABLE_LANGUAGES.find((lang: Language) => lang.code === selectedLang);
        return current || AVAILABLE_LANGUAGES[0];
    }, [selectedLang]);
    const languageOptions = useMemo(
        () =>
            AVAILABLE_LANGUAGES.map(language => ({
                ...language,
                name: t(`common.language_names.${language.code}`, language.code)
            })),
        [t]
    );
    const currentLanguageName = t(`common.language_names.${currentLanguage.code}`, currentLanguage.code);

    const currentFlagClassName = `${styles.languageFlag} ${currentLanguage.flagClassName}`;

    return (
        <Menu positioning={{ position: "after", align: "start", offset: { mainAxis: 8 } }}>
            <MenuTrigger disableButtonEnhancement>
                <MenuItem hasSubmenu icon={<span className={currentFlagClassName} title={currentLanguage.code} aria-hidden="true" />}>
                    {currentLanguageName}
                </MenuItem>
            </MenuTrigger>
            <MenuPopover className={styles.languagePopover}>
                {languageOptions.map(language => (
                    <MenuItem
                        key={language.code}
                        icon={<span className={`${styles.languageFlag} ${language.flagClassName}`} title={language.code} aria-hidden="true" />}
                        onClick={() => handleButtonClick(language)}
                    >
                        {language.name}
                        <span className={styles.fallbackCode}>{language.code}</span>
                    </MenuItem>
                ))}
            </MenuPopover>
        </Menu>
    );
};
