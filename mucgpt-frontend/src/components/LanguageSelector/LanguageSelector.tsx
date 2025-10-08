import { Menu, MenuButton, MenuItem, MenuPopover, MenuTrigger, Tooltip } from "@fluentui/react-components";
import { useState, useEffect, useCallback, useMemo } from "react";
import { LocalLanguage24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

interface LanguageSelectorProps {
    onSelectionChange: (newSelection: string) => void;
    defaultlang: string;
}

interface Language {
    code: string;
    name: string;
}

// Defining languages outside component to avoid re-creation on each render
const AVAILABLE_LANGUAGES: Language[] = [
    { code: "DE", name: "Deutsch" },
    { code: "EN", name: "English" },
    { code: "FR", name: "Français" },
    { code: "BA", name: "Boarisch" },
    { code: "UK", name: "Українська" }
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
        [selectedLang, onSelectionChange]
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

    // Memoize the keyboard handler
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent, language: Language) => {
            if (e.key === "Enter" || e.key === " ") {
                handleButtonClick(language);
                e.preventDefault();
            }
        },
        [handleButtonClick]
    );

    // Tooltip text
    const tooltipText = `${currentLanguage.name} - ${t("components.language_selector.change_language")}`;

    return (
        <Menu>
            <MenuTrigger disableButtonEnhancement>
                <Tooltip content={tooltipText} relationship="description" positioning="below">
                    <MenuButton appearance={"subtle"} aria-label={tooltipText} icon={<LocalLanguage24Regular />}>
                        {currentLanguage.code}
                    </MenuButton>
                </Tooltip>
            </MenuTrigger>
            <MenuPopover>
                {AVAILABLE_LANGUAGES.map(language => (
                    <MenuItem key={language.code} onClick={() => handleButtonClick(language)} onKeyDown={event => handleKeyDown(event, language)}>
                        {language.code} - {language.name}
                    </MenuItem>
                ))}
            </MenuPopover>
        </Menu>
    );
};
