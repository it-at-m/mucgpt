import { Tooltip } from "@fluentui/react-components";
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
    const handleButtonClick = useCallback(() => {
        const currentIndex = AVAILABLE_LANGUAGES.findIndex((lang: Language) => lang.name === selectedLang);
        const nextIndex = (currentIndex + 1) % AVAILABLE_LANGUAGES.length;
        const nextLang = AVAILABLE_LANGUAGES[nextIndex];

        setSelectedLang(nextLang.name);

        onSelectionChange(nextLang.name);
    }, [selectedLang, onSelectionChange]);

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
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                handleButtonClick();
                e.preventDefault();
            }
        },
        [handleButtonClick]
    );

    return (
        <Tooltip content={`${currentLanguage.name} - Klicken zum Ändern`} relationship="description" positioning="below">
            <div
                className={styles.container}
                onClick={handleButtonClick}
                role="button"
                tabIndex={0}
                aria-label={`Sprache: ${currentLanguage.name}. Klicken zum Ändern`}
                onKeyDown={handleKeyDown}
            >
                <div className={styles.buttonContainer}>
                    <LocalLanguage24Regular className={styles.iconRightMargin} />
                    <span className={styles.languageCode}>{currentLanguage.code}</span>
                </div>
            </div>
        </Tooltip>
    );
};
