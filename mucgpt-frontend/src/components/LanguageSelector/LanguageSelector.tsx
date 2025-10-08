import { Menu, MenuButton, MenuItem, MenuPopover, MenuTrigger, Tooltip } from "@fluentui/react-components";
import { useState, useEffect, useCallback, useMemo } from "react";
import { LocalLanguage24Regular } from "@fluentui/react-icons";
import styles from "./LanguageSelector.module.css";

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
    { code: "EN", name: "Englisch" },
    { code: "FR", name: "French" },
    { code: "BA", name: "Bairisch" },
    { code: "UK", name: "Ukrainisch" }
];

export const LanguageSelector = ({ onSelectionChange, defaultlang }: LanguageSelectorProps) => {
    const [selectedLang, setSelectedLang] = useState(defaultlang);

    // Handle button click - cycle through languages with useCallback for stability
    const handleButtonClick = useCallback(
        (language: Language) => {
            setSelectedLang(language.name);
            onSelectionChange(language.name);
        },
        [selectedLang, onSelectionChange]
    );

    // Update selected language when defaultlang prop changes
    useEffect(() => {
        setSelectedLang(defaultlang);
    }, [defaultlang]);

    // Memoize the current language to prevent unnecessary re-calculations
    const currentLanguage = useMemo(() => {
        const current = AVAILABLE_LANGUAGES.find((lang: Language) => lang.name === selectedLang);
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
    const tooltipText = `Sprache: ${currentLanguage.name} - Zum Ändern klicken`

    return (
        <Menu>
            <MenuTrigger disableButtonEnhancement>
                <Tooltip content={tooltipText} relationship="description" positioning="below">
                    <MenuButton
                        appearance={"subtle"}
                        aria-label={tooltipText}
                        icon={<LocalLanguage24Regular className={styles.iconRightMargin} />}
                    >
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
