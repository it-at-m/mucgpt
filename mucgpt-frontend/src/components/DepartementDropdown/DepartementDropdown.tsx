import React, { useState, useEffect } from "react";
import { getDepartements } from "../../api";
import styles from "./DepartementDropdown.module.css";

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
}

export const DepartementDropdown = ({ publishDepartments, setPublishDepartments }: Props) => {
    const [departments, setDepartments] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [show, setShow] = useState(false);

    useEffect(() => {
        getDepartements().then(data => {
            setDepartments(data.departments || []);
        });
    }, []);

    const filtered = departments
        .filter(d => d.toLowerCase().includes(search.toLowerCase()) && !publishDepartments.some(sel => isDepartmentPrefixMatch(sel, d)))
        .sort((a, b) => {
            if (search && a.toLowerCase() === search.toLowerCase()) return -1;
            if (search && b.toLowerCase() === search.toLowerCase()) return 1;
            return a.localeCompare(b);
        });

    const handleSelect = (d: string) => {
        const newSelected = publishDepartments.filter(sel => !isDepartmentPrefixMatch(sel, d));
        setPublishDepartments([...newSelected, d]);
        setSearch("");
        setShow(false);
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
                        <button onClick={() => handleRemove(d)} className={styles.selected_button} aria-label={`Remove ${d}`} type="button">
                            ×
                        </button>
                    </span>
                ))}
            </div>
            <input
                type="text"
                value={search}
                placeholder="Suche Abteilung..."
                onFocus={() => setShow(true)}
                onBlur={() => setShow(false)}
                onChange={e => {
                    setSearch(e.target.value);
                    setShow(true);
                }}
                className={styles.inputField}
            />
            {show && (
                <ul
                    className={styles.dropdownList}
                    onMouseDown={e => e.preventDefault()} // verhindert, dass onBlur vor handleSelect ausgelöst wird
                >
                    {filtered.length === 0 && <li style={{ padding: 8, color: "#888" }}>Keine Treffer</li>}
                    {filtered.map(d => (
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
