import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown16Regular } from "@fluentui/react-icons";

import styles from "./WikiTutorial.module.css";

export const wikiAnchor = (id: string) => `wiki-${id}`;

export interface WikiTutorialSubsection {
    id: string;
    title: string;
}

export interface WikiTutorialSection {
    id: string;
    title: string;
    content: ReactNode;
    // Subsections only add entries to the table of contents. Their anchor element
    // must be rendered inside the section content with id={wikiAnchor(sub.id)}.
    subsections?: WikiTutorialSubsection[];
    // Rendered in the content but omitted from the table of contents and scroll spy.
    hideFromToc?: boolean;
}

interface WikiTutorialProps {
    tocTitle: string;
    sections: WikiTutorialSection[];
}

/**
 * Wiki-style tutorial layout: a sticky table of contents next to the content that
 * highlights the section currently in view and allows jumping between sections.
 * On small screens the table of contents collapses into a sticky bar at the top.
 */
export const WikiTutorial = ({ tocTitle, sections }: WikiTutorialProps) => {
    const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
    const [tocOpen, setTocOpen] = useState(false);
    // Suppress the scroll spy while a click-triggered smooth scroll is still running.
    const suppressSpyUntil = useRef(0);

    const tocSections = useMemo(() => sections.filter(section => !section.hideFromToc), [sections]);

    // All anchor ids in document order.
    const anchorIds = useMemo(
        () => tocSections.flatMap(section => [section.id, ...(section.subsections?.map(sub => sub.id) ?? [])]),
        [tocSections]
    );

    const parentOf = useMemo(() => {
        const map = new Map<string, string>();
        tocSections.forEach(section => section.subsections?.forEach(sub => map.set(sub.id, section.id)));
        return map;
    }, [tocSections]);

    // Scroll spy: mark the section whose start sits in a thin activation band near the top of
    // the viewport, reported by an IntersectionObserver.
    useEffect(() => {
        const visible = new Set<string>();
        const orderOf = new Map(anchorIds.map((id, index) => [id, index]));

        const pickActive = () => {
            if (Date.now() < suppressSpyUntil.current) return;
            // Last anchor in document order wins, so a subsection beats its enclosing section.
            let bestId = "";
            let bestOrder = -1;
            for (const id of visible) {
                const order = orderOf.get(id) ?? -1;
                if (order > bestOrder) {
                    bestOrder = order;
                    bestId = id;
                }
            }
            if (bestId) setActiveId(previous => (previous === bestId ? previous : bestId));
        };

        const idOf = new Map(anchorIds.map(id => [wikiAnchor(id), id]));
        const observer = new IntersectionObserver(
            entries => {
                for (const entry of entries) {
                    const id = idOf.get(entry.target.id);
                    if (!id) continue;
                    if (entry.isIntersecting) visible.add(id);
                    else visible.delete(id);
                }
                pickActive();
            },
            { rootMargin: "-120px 0px -65% 0px", threshold: 0 }
        );

        for (const id of anchorIds) {
            const element = document.getElementById(wikiAnchor(id));
            if (element) observer.observe(element);
        }

        return () => observer.disconnect();
    }, [anchorIds]);

    const handleSelect = useCallback((id: string) => {
        const element = document.getElementById(wikiAnchor(id));
        element?.scrollIntoView({ behavior: "smooth", block: "start" });
        suppressSpyUntil.current = Date.now() + 800;
        setActiveId(id);
        setTocOpen(false);
    }, []);

    const activeTitle = useMemo(() => {
        for (const section of tocSections) {
            if (section.id === activeId) return section.title;
            const sub = section.subsections?.find(candidate => candidate.id === activeId);
            if (sub) return sub.title;
        }
        return tocTitle;
    }, [tocSections, activeId, tocTitle]);

    return (
        <div className={styles.wiki}>
            <nav className={styles.toc} aria-label={tocTitle}>
                <button type="button" className={styles.tocToggle} onClick={() => setTocOpen(open => !open)} aria-expanded={tocOpen}>
                    <span className={styles.tocToggleLabel}>{activeTitle}</span>
                    <ChevronDown16Regular className={`${styles.chevron} ${tocOpen ? styles.chevronOpen : ""}`} />
                </button>
                <ul className={`${styles.tocList} ${tocOpen ? styles.tocListOpen : ""}`}>
                    {tocSections.map(section => {
                        const sectionActive = activeId === section.id || parentOf.get(activeId) === section.id;
                        return (
                            <li key={section.id}>
                                <button
                                    type="button"
                                    className={`${styles.tocLink} ${sectionActive ? styles.tocLinkActive : ""}`}
                                    aria-current={activeId === section.id ? "location" : undefined}
                                    onClick={() => handleSelect(section.id)}
                                >
                                    {section.title}
                                </button>
                                {section.subsections && section.subsections.length > 0 && (
                                    <ul className={styles.tocSubList}>
                                        {section.subsections.map(sub => (
                                            <li key={sub.id}>
                                                <button
                                                    type="button"
                                                    className={`${styles.tocLink} ${styles.tocSubLink} ${activeId === sub.id ? styles.tocLinkActive : ""}`}
                                                    aria-current={activeId === sub.id ? "location" : undefined}
                                                    onClick={() => handleSelect(sub.id)}
                                                >
                                                    {sub.title}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </nav>
            <div className={styles.content}>
                {sections.map(section => (
                    <section key={section.id} id={wikiAnchor(section.id)} className={styles.section} aria-label={section.title}>
                        {section.content}
                    </section>
                ))}
            </div>
        </div>
    );
};

export default WikiTutorial;
