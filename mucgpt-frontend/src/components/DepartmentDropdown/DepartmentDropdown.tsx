import { useState, useEffect, useContext, useRef } from "react";
import { UserContext } from "../../pages/layout/UserContextProvider";
import styles from "./DepartmentDropdown.module.css";
import { useTranslation } from "react-i18next";
import { getDepartements } from "../../api/core-client";

// Hilfsfunktion für Präfix-Matching
function isDepartmentPrefixMatch(a: string, b: string) {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    if (aLower === bLower) return true;
    if (bLower.startsWith(aLower + "-") || bLower.startsWith(aLower + "/")) return true;
    if (aLower.startsWith(bLower + "-") || aLower.startsWith(bLower + "/")) return true;
    return false;
}

interface Props {
    publishDepartments: string[];
    setPublishDepartments: (departments: string[]) => void;
    disabled?: boolean;
}

export const DepartementDropdown = ({ publishDepartments, setPublishDepartments, disabled }: Props) => {
    const { t } = useTranslation();
    const [departments, setDepartments] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [show, setShow] = useState(false);
    const { user } = useContext(UserContext);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (departments.length > 0) return; // Nur einmal laden, wenn noch keine Daten vorhanden sind
        getDepartements().then(data => {
            setDepartments(data || []);
        });
    }, []);

    // Scroll to dropdown when it opens
    useEffect(() => {
        if (show && dropdownRef.current) {
            setTimeout(() => {
                dropdownRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "nearest"
                });
            }, 50); // Small delay to ensure the dropdown is rendered
        }
    }, [show]);

    // First filter departments based on search and not already selected
    const filteredDepartments = departments.filter(
        d => d.toLowerCase().includes(search.toLowerCase()) && !publishDepartments.some(sel => isDepartmentPrefixMatch(sel, d))
    );

    // Sort with special cases
    const filtered = filteredDepartments.sort((a, b) => {
        // If one of the departments is the user's department, it comes first
        if (a === user?.department) return -1;
        if (b === user?.department) return 1;

        // Then exact matches to search
        if (search && a.toLowerCase() === search.toLowerCase()) return -1;
        if (search && b.toLowerCase() === search.toLowerCase()) return 1;

        // Then standard alphabetical sort
        return a.localeCompare(b);
    });

    const handleSelect = (d: string) => {
        const newSelected = publishDepartments.filter(sel => !isDepartmentPrefixMatch(sel, d));
        setPublishDepartments([...newSelected, d]);
        setSearch("");
        setShow(false);
        inputRef.current?.blur();
    };

    const handleRemove = (d: string) => {
        setPublishDepartments(publishDepartments.filter(sel => sel !== d));
    };

    return (
        <div className={styles.container}>
            <div className={styles.selected_container}>
                {publishDepartments.map(d => (
                    <span key={d} className={styles.selected_item}>
                        {d}
                        <button
                            onClick={() => handleRemove(d)}
                            className={styles.selected_button}
                            aria-label={`Remove ${d}`}
                            type="button"
                            disabled={disabled}
                            hidden={disabled}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>

            <input
                ref={inputRef}
                type="text"
                value={search}
                placeholder={t("components.department_dropdown.placeholder", "Suche Abteilung...")}
                onFocus={() => setShow(true)}
                onBlur={() => setShow(false)}
                onChange={e => {
                    setSearch(e.target.value);
                    setShow(true);
                }}
                className={styles.inputField}
                disabled={disabled}
                hidden={disabled}
            />
            {show && (
                <ul
                    ref={dropdownRef}
                    className={styles.dropdownList}
                    onMouseDown={e => e.preventDefault()} // verhindert, dass onBlur vor handleSelect ausgelöst wird
                >
                    {filtered.length === 0 && <li className={styles.noMatches}>{t("components.department_dropdown.no_matches", "Keine Treffer")}</li>}

                    {/* If user department exists and is in filtered list, display a separator */}
                    {user?.department && filtered.some(d => d === user.department) && (
                        <>
                            <li
                                key={user.department}
                                className={`${styles.dropdownItem} ${styles.userDepartment}`}
                                onMouseDown={() => user.department && handleSelect(user.department)}
                            >
                                {user.department}
                                <span className={styles.userDepartmentLabel}>
                                    {t("components.department_dropdown.own_department_label", "(Ihre Abteilung)")}
                                </span>
                            </li>
                            <li className={styles.dropdownDivider}></li>
                        </>
                    )}

                    {/* Display all other departments */}
                    {filtered
                        .filter(d => d !== user?.department) // Filter out user department as it's already displayed
                        .map(d => (
                            <li key={d} className={styles.dropdownItem} onMouseDown={() => handleSelect(d)}>
                                {d}
                            </li>
                        ))}
                </ul>
            )}
        </div>
    );
};

export default DepartementDropdown;
