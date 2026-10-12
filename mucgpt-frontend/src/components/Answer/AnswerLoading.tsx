import { useEffect, useRef, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { DocumentBulletList16Regular, Sparkle16Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./Answer.module.css";
import { ActivityLine } from "../AnswerActivity/ActivityLine";
import { useIsVisibleTool } from "../AnswerActivity/useIsVisibleTool";
import { useToolIcon } from "../AnswerActivity/useToolIcon";
import { useToolDisplayName } from "../../hooks/useToolDisplayName";
import { getLiveStatus, getLiveStatusKey, type LiveStatus, type RunActivity } from "../../utils/agUiActivity";

// Each message stays at least this long; newer ones arriving meanwhile replace it afterwards,
// skipping anything in between. Skipped steps still show up in the answer's step list.
const MIN_STATUS_DISPLAY_MS = 2500;
// How often time-based changes (thinking stages, waiting for a tool's description) are re-checked.
const STATUS_CHECK_INTERVAL_MS = 250;

const useNow = (intervalMs: number) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(interval);
    }, [intervalMs]);
    return now;
};

/** Returns the status to show: holds each one for `minMs`, then jumps to the newest. */
const useHeldStatus = (status: LiveStatus, minMs: number): LiveStatus => {
    const [shown, setShown] = useState(status);
    const shownAt = useRef(Date.now());
    const key = getLiveStatusKey(status);
    const shownKey = getLiveStatusKey(shown);
    // While a tool's own description is about to arrive, keep the current message instead of flashing the tool name.
    const isReady = !(status.kind === "tool" && status.awaitingDescription);

    useEffect(() => {
        if (!isReady || key === shownKey) return;
        const timeout = window.setTimeout(
            () => {
                shownAt.current = Date.now();
                setShown(status);
            },
            Math.max(0, minMs - (Date.now() - shownAt.current))
        );
        return () => window.clearTimeout(timeout);
    }, [status, key, shownKey, isReady, minMs]);

    return shown;
};

interface Props {
    /** Live AG-UI run activity; drives what the loading line says. */
    activity?: RunActivity;
}

export const AnswerLoading = ({ activity }: Props) => {
    const { t } = useTranslation();
    const getToolDisplayName = useToolDisplayName();
    const getToolIcon = useToolIcon();
    const isVisibleTool = useIsVisibleTool();
    const now = useNow(STATUS_CHECK_INTERVAL_MS);
    const status = useHeldStatus(getLiveStatus(activity, now, isVisibleTool), MIN_STATUS_DISPLAY_MS);
    const animatedStyles = useSpring({
        from: { opacity: 0 },
        to: { opacity: 1 }
    });

    let icon = <Sparkle16Regular />;
    let label: string;
    if (status.kind === "tool") {
        icon = getToolIcon(status.step.toolName);
        label = status.step.description ?? t("chat.activity_running_tool", { tool: getToolDisplayName(status.step.toolName) });
    } else if (status.kind === "evaluating") {
        icon = <DocumentBulletList16Regular />;
        label = t("chat.activity_evaluating");
    } else {
        const stages = t("chat.activity_thinking_stages", { returnObjects: true }) as string[];
        label = stages[Math.min(status.stage, stages.length - 1)] ?? t("chat.answer_loading");
    }

    return (
        <animated.div style={{ ...animatedStyles }}>
            <div className={styles.answerContainer}>
                <div className={styles.growItem}>
                    <div className={styles.loadingLine} role="status">
                        {/* Announce what is shown, without the ticking time. */}
                        <span className={styles.visuallyHidden}>{label}</span>
                        <span aria-hidden="true">
                            <ActivityLine icon={icon} label={label} startedAt={activity?.startedAt} />
                        </span>
                    </div>
                </div>
            </div>
        </animated.div>
    );
};
