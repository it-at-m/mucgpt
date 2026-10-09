import { useEffect, useState, type ReactElement } from "react";
import { Caption1 } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";

import styles from "./AnswerActivity.module.css";

// Short steps don't need a timer; after this, the elapsed time reassures that work is still going on.
const SHOW_ELAPSED_AFTER_SECONDS = 3;

const useElapsedSeconds = (startedAt: number | undefined) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (startedAt === undefined) return;
        let timeout: number;
        // Tick on each full second since `startedAt`, not since mount, so the counter never lags behind.
        const tick = () => {
            const current = Date.now();
            setNow(current);
            timeout = window.setTimeout(tick, 1000 - ((current - startedAt) % 1000));
        };
        tick();
        return () => window.clearTimeout(timeout);
    }, [startedAt]);

    return startedAt === undefined ? undefined : Math.max(0, Math.floor((now - startedAt) / 1000));
};

interface Props {
    icon: ReactElement;
    /** What is happening right now; rendered with the progress shimmer. */
    label: string;
    /** Start of what is being timed (the run or a step); its elapsed time shows once it takes longer than a few seconds. */
    startedAt?: number;
}

/** One in-progress activity line: icon, shimmering label and elapsed time. Queries and URLs are left to the step list. */
export const ActivityLine = ({ icon, label, startedAt }: Props) => {
    const { t } = useTranslation();
    const elapsed = useElapsedSeconds(startedAt);

    return (
        <span className={styles.line}>
            {/* Keyed by label: a new message fades in instead of swapping abruptly. */}
            <span key={`icon:${label}`} className={`${styles.icon} ${styles.enter}`} aria-hidden="true">
                {icon}
            </span>
            <Caption1 className={styles.label}>
                <span key={label} className={styles.enter}>
                    <span className={styles.shimmer}>{label}</span>
                </span>
                {elapsed !== undefined && elapsed >= SHOW_ELAPSED_AFTER_SECONDS && (
                    // The ticking time is visual reassurance only; announcing it every second would be noise.
                    <span className={styles.meta} aria-hidden="true">
                        {` · ${t("chat.activity_duration", { seconds: elapsed })}`}
                    </span>
                )}
            </Caption1>
        </span>
    );
};
