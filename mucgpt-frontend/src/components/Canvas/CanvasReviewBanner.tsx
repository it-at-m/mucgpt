import { Button, MessageBar } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";

import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import styles from "./CanvasReviewBanner.module.css";

interface Props {
    controller: CanvasControllerInstance;
}

/**
 * Review header for pending agent changes. The per-change controls live in the
 * document itself; this banner explains the interaction and offers the bulk
 * actions (also the primary keyboard path).
 */
export const CanvasReviewBanner = ({ controller }: Props) => {
    const { t } = useTranslation();
    if (controller.pendingChangeCount === 0) return null;

    return (
        <MessageBar intent="info" className={styles.banner}>
            <div className={styles.body}>
                <span className={styles.title}>{t("canvas.review.pending", { count: controller.pendingChangeCount })}</span>
                <span className={styles.hint}>{t("canvas.review.hint")}</span>
                <div className={styles.actions}>
                    <Button size="small" appearance="primary" onClick={controller.acceptAllChanges}>
                        {t("canvas.review.accept_all")}
                    </Button>
                    <Button size="small" appearance="secondary" onClick={controller.rejectAllChanges}>
                        {t("canvas.review.reject_all")}
                    </Button>
                </div>
            </div>
        </MessageBar>
    );
};
