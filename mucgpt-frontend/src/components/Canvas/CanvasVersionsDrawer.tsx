import DOMPurify from "dompurify";
import { generateHTML } from "@tiptap/html";
import { Button, DrawerBody, DrawerHeader, DrawerHeaderTitle, OverlayDrawer } from "@fluentui/react-components";
import { ArrowUndo24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import type { CanvasRevision } from "../../service/canvasStorage";
import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import { canvasExtensions } from "./canvasExtensions";
import styles from "./CanvasVersionsDrawer.module.css";

interface Props {
    open: boolean;
    onClose: () => void;
    controller: CanvasControllerInstance;
}

interface RevisionGroup {
    key: string;
    title: string;
    revisions: CanvasRevision[];
}

const buildGroups = (revisions: { auto: CanvasRevision[]; manual: CanvasRevision[] }, t: (key: string) => string): RevisionGroup[] => [
    { key: "manual", title: t("canvas.versions.manual_group"), revisions: [...revisions.manual].reverse() },
    { key: "auto", title: t("canvas.versions.auto_group"), revisions: [...revisions.auto].reverse() }
];

export const CanvasVersionsDrawer = ({ open, onClose, controller }: Props) => {
    const { t, i18n } = useTranslation();
    const groups = buildGroups(controller.revisions, t);

    const formatTimestamp = (timestamp: number) =>
        new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));

    const formatSource = (source: CanvasRevision["source"]) => t(`canvas.versions.source_${source}`);

    const previewHtml = (docJson: unknown) => DOMPurify.sanitize(generateHTML(docJson as Parameters<typeof generateHTML>[0], canvasExtensions));

    return (
        <OverlayDrawer open={open} position="end" size="medium" onOpenChange={(_, data) => !data.open && onClose()}>
            <DrawerHeader>
                <DrawerHeaderTitle>{t("canvas.versions.title")}</DrawerHeaderTitle>
            </DrawerHeader>
            <DrawerBody>
                {groups.every(group => group.revisions.length === 0) && <p className={styles.empty}>{t("canvas.versions.empty")}</p>}
                {groups.map(
                    group =>
                        group.revisions.length > 0 && (
                            <section key={group.key} className={styles.group} aria-label={group.title}>
                                <h3 className={styles.groupTitle}>{group.title}</h3>
                                {group.revisions.map(revision => (
                                    <article key={revision.revision} className={styles.revision}>
                                        <div className={styles.revisionHeader}>
                                            <span className={styles.timestamp}>{formatTimestamp(revision.timestamp)}</span>
                                            <span className={styles.source}>{formatSource(revision.source)}</span>
                                        </div>
                                        <div
                                            className={styles.preview}
                                            // Preview of our own editor output, sanitized as defense in depth.
                                            dangerouslySetInnerHTML={{ __html: previewHtml(revision.doc_json) }}
                                        />
                                        <div className={styles.revisionActions}>
                                            <Button
                                                appearance="secondary"
                                                size="small"
                                                icon={<ArrowUndo24Regular />}
                                                onClick={() => controller.restore(revision.revision)}
                                            >
                                                {t("canvas.versions.restore")}
                                            </Button>
                                        </div>
                                    </article>
                                ))}
                            </section>
                        )
                )}
            </DrawerBody>
        </OverlayDrawer>
    );
};
