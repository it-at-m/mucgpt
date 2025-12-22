import { useState, useEffect, useContext } from "react";
import { UserContext } from "../../pages/layout/UserContextProvider";
import styles from "./DepartmentTreeDropdown.module.css";
import { useTranslation } from "react-i18next";
import { getDirectoryChildren } from "../../api/assistant-client";
import { DirectoryNode } from "../../api/models";
import { ChevronRightRegular, ChevronDownRegular, DismissRegular, CheckmarkRegular } from "@fluentui/react-icons";

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

export const DepartmentTreeDropdown = ({ publishDepartments, setPublishDepartments, disabled }: Props) => {
    const { t } = useTranslation();
    const [tree, setTree] = useState<Record<string, DirectoryNode[]>>({});
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const { user } = useContext(UserContext);

    const pathKey = (path: string[]) => path.join("||");

    const labelFor = (node: DirectoryNode) => node.shortname || node.name;

    const displayText = (node: DirectoryNode) =>
        node.shortname && node.shortname !== node.name ? `${node.shortname} – ${node.name}` : node.shortname || node.name;

    const fetchChildren = async (path: string[]) => {
        const key = pathKey(path);
        if (loadingPaths.has(key)) return;
        setLoadingPaths(new Set(loadingPaths).add(key));
        setError(null);
        try {
            const children = await getDirectoryChildren(path);
            setTree(prev => ({ ...prev, [key]: children }));
        } catch (e) {
            console.error(e);
            setError(
                t("components.department_dropdown.load_error", {
                    defaultValue: "Konnte Verzeichnis nicht laden"
                })
            );
        } finally {
            setLoadingPaths(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    useEffect(() => {
        if (tree[pathKey([])]) return;
        fetchChildren([]);
    }, []);

    const handleSelect = (value: string) => {
        const isSelected = publishDepartments.includes(value);
        if (isSelected) {
            setPublishDepartments(publishDepartments.filter(sel => sel !== value));
        } else {
            const newSelected = publishDepartments.filter(sel => !isDepartmentPrefixMatch(sel, value));
            setPublishDepartments([...newSelected, value]);
        }
    };

    const handleRemove = (d: string) => {
        setPublishDepartments(publishDepartments.filter(sel => sel !== d));
    };

    const toggleExpand = async (path: string[], e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const key = pathKey(path);
        const next = new Set(expanded);
        if (expanded.has(key)) {
            next.delete(key);
            setExpanded(next);
            return;
        }

        if (!tree[key]) {
            await fetchChildren(path);
        }
        next.add(key);
        setExpanded(next);
    };

    const renderNodes = (nodes: DirectoryNode[], parentPath: string[]) => {
        return (
            <ul className={styles.treeList}>
                {nodes.map(node => {
                    const currentPath = [...parentPath, labelFor(node)];
                    const key = pathKey(currentPath);
                    const children = node.children || tree[key] || [];
                    const isExpanded = expanded.has(key);
                    const isLoading = loadingPaths.has(key);
                    const isSelected = publishDepartments.includes(labelFor(node));
                    const isUserDept = user?.department === node.shortname || user?.department === node.name;
                    const canExpand = children.length > 0 || (tree[key] ? tree[key].length > 0 : true);

                    return (
                        <li key={key} className={styles.treeItem}>
                            <div className={`${styles.treeRow} ${isSelected ? styles.treeRowSelected : ""}`} onClick={() => handleSelect(labelFor(node))}>
                                {canExpand ? (
                                    <button
                                        type="button"
                                        className={styles.toggleButton}
                                        onClick={e => toggleExpand(currentPath, e)}
                                        disabled={disabled}
                                        aria-label={isExpanded ? t("collapse", "Einklappen") : t("expand", "Ausklappen")}
                                        aria-expanded={isExpanded}
                                    >
                                        {isExpanded ? <ChevronDownRegular fontSize={20} /> : <ChevronRightRegular fontSize={20} />}
                                    </button>
                                ) : (
                                    <div className={styles.togglePlaceholder} />
                                )}
                                <div className={styles.nodeLabel}>
                                    <span className={styles.nodePrimary}>
                                        {displayText(node)}
                                        {isUserDept && <span className={styles.userBadge}>{t("me", "Ich")}</span>}
                                    </span>
                                    {node.shortname && node.shortname !== node.name && <span className={styles.nodeSecondary}>{node.name}</span>}
                                </div>
                                {isSelected && <CheckmarkRegular style={{ color: "#3182ce" }} />}
                                {isLoading && <span className={styles.loadingText}>{t("loading", "...")}</span>}
                            </div>
                            {isExpanded && children.length > 0 && <div className={styles.treeChildren}>{renderNodes(children, currentPath)}</div>}
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.controlsRow}>
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
                                <DismissRegular fontSize={12} />
                            </button>
                        </span>
                    ))}
                </div>
                {publishDepartments.length > 0 && (
                    <button className={styles.clearButton} onClick={() => setPublishDepartments([])} disabled={disabled}>
                        {t("clear_all", "Alle entfernen")}
                    </button>
                )}
            </div>

            <div className={styles.treeContainer}>
                {error && <div className={styles.errorText}>{error}</div>}
                {tree[pathKey([])] ? renderNodes(tree[pathKey([])], []) : <div className={styles.loadingText}>{t("loading", "Lädt...")}</div>}
            </div>
        </div>
    );
};

export default DepartmentTreeDropdown;
