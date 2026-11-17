import { useMemo } from "react";
import DOMPurify from "dompurify";
import { generateHTML } from "@tiptap/html";
import { Button, DrawerBody, DrawerHeader, DrawerHeaderTitle, OverlayDrawer } from "@fluentui/react-components";
import { ArrowUndo24Regular, Dismiss24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import type { CanvasRevision } from "../../service/canvasStorage";
import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import { canvasExtensions } from "./canvasExtensions";
import { describeRevisionDiff, type CanvasRevisionDiffItem } from "./canvasDiff";
import styles from "./CanvasVersionsDrawer.module.css";

// Revision previews are rendered via dangerouslySetInnerHTML, so any link that
// survives sanitization must not navigate the app or leak window references.
// Namespace-scoped so other DOMPurify consumers (e.g. SVG sanitization) stay untouched.
DOMPurify.addHook("afterSanitizeAttributes", node => {
    const element = node as Element;
    if (element.namespaceURI === "http://www.w3.org/1999/xhtml" && element.tagName === "A") {
        element.setAttribute("rel", "noopener noreferrer");
        element.setAttribute("target", "_blank");
    }
});

interface Props {
    open: boolean;
    onClose: () => void;
    controller: CanvasControllerInstance;
    disabled?: boolean;
}

interface RevisionGroup {
    key: string;
    title: string;
    revisions: CanvasRevision[];
}

const revisionKey = (revision: CanvasRevision): string => `${revision.source}-${revision.revision}`;

const buildGroups = (revisions: { auto: CanvasRevision[]; manual: CanvasRevision[] }, t: (key: string) => string): RevisionGroup[] => [
    { key: "manual", title: t("canvas.versions.manual_group"), revisions: [...revisions.manual].reverse() },
    { key: "auto", title: t("canvas.versions.auto_group"), revisions: [...revisions.auto].reverse() }
];

export const CanvasVersionsDrawer = ({ open, onClose, controller, disabled = false }: Props) => {
    const { t, i18n } = useTranslation();
    const groups = buildGroups(controller.revisions, t);
    // Both sides must use the live editor schema: ProseMirror compares node
    // types by identity, so a separately generated schema would make every block
    // unequal (whole document shown as removed and re-added).
    const currentDoc = controller.editor?.state.doc;
    const schema = controller.editor?.state.schema;

    // Diff every stored revision against the live document: red marks what a
    // restore would remove, green what it would add. Invalid stored JSON stays
    // out of the map and falls back to the plain preview below.
    const diffs = useMemo(() => {
        const map = new Map<string, CanvasRevisionDiffItem[]>();
        if (!open || !currentDoc || !schema) return map;
        for (const revision of [...controller.revisions.manual, ...controller.revisions.auto]) {
            try {
                const revisionDoc = schema.nodeFromJSON(revision.doc_json);
                revisionDoc.check();
                map.set(revisionKey(revision), describeRevisionDiff(currentDoc, revisionDoc));
            } catch (error) {
                console.error("Canvas revision diff failed:", error);
            }
        }
        return map;
    }, [currentDoc, schema, controller.revisions, open]);

    const formatTimestamp = (timestamp: number) =>
        new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));

    const formatSource = (source: CanvasRevision["source"]) => t(`canvas.versions.source_${source}`);

    const previewHtml = (docJson: unknown) => {
        try {
            return DOMPurify.sanitize(generateHTML(docJson as Parameters<typeof generateHTML>[0], canvasExtensions()), { USE_PROFILES: { html: true } });
        } catch (error) {
            console.error("Canvas revision preview failed:", error);
            return "";
        }
    };

    return (
        <OverlayDrawer open={open} position="end" size="medium" onOpenChange={(_, data) => !data.open && onClose()}>
            <DrawerHeader>
                <DrawerHeaderTitle
                    action={<Button appearance="subtle" aria-label={t("canvas.versions.close")} icon={<Dismiss24Regular />} onClick={onClose} />}
                >
                    {t("canvas.versions.title")}
                </DrawerHeaderTitle>
            </DrawerHeader>
            <DrawerBody>
                {groups.every(group => group.revisions.length === 0) && <p className={styles.empty}>{t("canvas.versions.empty")}</p>}
                {groups.map(
                    group =>
                        group.revisions.length > 0 && (
                            <section key={group.key} className={styles.group} aria-label={group.title}>
                                <h3 className={styles.groupTitle}>{group.title}</h3>
                                {group.revisions.map((revision, index) => {
                                    const diff = diffs.get(revisionKey(revision));
                                    const hasChanges = diff?.some(item => item.kind !== "equal") ?? false;
                                    return (
                                        <article key={`${revision.source}-${revision.revision}-${index}`} className={styles.revision}>
                                            <div className={styles.revisionHeader}>
                                                <span className={styles.timestamp}>{formatTimestamp(revision.timestamp)}</span>
                                                <span className={styles.source}>{formatSource(revision.source)}</span>
                                            </div>
                                            {hasChanges && diff ? (
                                                <>
                                                    <p className={styles.diffCaption}>{t("canvas.versions.diff_caption")}</p>
                                                    <div className={styles.diff}>
                                                        {diff.map((item, itemIndex) =>
                                                            item.lines.map((line, lineIndex) => (
                                                                <div
                                                                    key={`${itemIndex}-${lineIndex}`}
                                                                    data-canvas-diff-kind={item.kind}
                                                                    className={
                                                                        item.kind === "insert"
                                                                            ? styles.diffInsertion
                                                                            : item.kind === "delete"
                                                                              ? styles.diffDeletion
                                                                              : styles.diffEqual
                                                                    }
                                                                >
                                                                    {line || "\u00a0"}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div
                                                    className={styles.preview}
                                                    // Preview of our own editor output, sanitized as defense in depth.
                                                    dangerouslySetInnerHTML={{ __html: previewHtml(revision.doc_json) }}
                                                />
                                            )}
                                            <div className={styles.revisionActions}>
                                                <Button
                                                    appearance="secondary"
                                                    size="small"
                                                    icon={<ArrowUndo24Regular />}
                                                    disabled={disabled}
                                                    onClick={() => controller.restore(revision.revision)}
                                                >
                                                    {t("canvas.versions.restore")}
                                                </Button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </section>
                        )
                )}
            </DrawerBody>
        </OverlayDrawer>
    );
};
