import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Model } from "../../api";
import { STORAGE_KEYS } from "../../pages/layout/LayoutHelper";
import { RocketRegular } from "@fluentui/react-icons";
import styles from "./LLMSelector.module.css";

interface Props {
    onSelectionChange: (nextLLM: string) => void;
    defaultLLM: string;
    options: Model[];
}

export const LLMSelector = ({ onSelectionChange, defaultLLM, options }: Props) => {
    const [selectedModel, setSelectedModel] = useState(defaultLLM);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Handle selecting a new model
    const handleSelectModel = useCallback(
        (modelName: string) => {
            setSelectedModel(modelName);
            setIsOpen(false);

            // Save the selected LLM to local storage
            localStorage.setItem(STORAGE_KEYS.SETTINGS_LLM, modelName);
            onSelectionChange(modelName);
        },
        [onSelectionChange]
    );

    // Handle opening/closing the dropdown
    const toggleDropdown = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    // Update selected model when defaultLLM prop changes
    useEffect(() => {
        setSelectedModel(defaultLLM);
    }, [defaultLLM]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                toggleDropdown();
                e.preventDefault();
            } else if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
                e.preventDefault();
            }
        },
        [isOpen, toggleDropdown]
    );

    // Get the short display name for the model (first 6 chars)
    const displayName = useMemo(() => {
        const parts = selectedModel.split("-");
        return parts[parts.length - 1].substring(0, 6);
    }, [selectedModel]);

    return (
        <div
            className={styles.container}
            ref={dropdownRef}
            role="button"
            tabIndex={0}
            aria-label={`Sprachmodell: ${selectedModel}. Klicken zum Ändern`}
            aria-expanded={isOpen}
            onKeyDown={handleKeyDown}
        >
            <div className={styles.buttonContainer} onClick={toggleDropdown}>
                <RocketRegular className={styles.iconRightMargin} />
                <span className={styles.modelName}>{displayName}</span>
            </div>

            {isOpen && (
                <div className={styles.modelOptions} role="listbox">
                    {options.map(item => (
                        <div
                            key={item.llm_name}
                            className={styles.modelOption}
                            onClick={() => handleSelectModel(item.llm_name)}
                            role="option"
                            aria-selected={selectedModel === item.llm_name}
                        >
                            {item.llm_name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
