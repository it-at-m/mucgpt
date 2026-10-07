import { useEffect, useRef, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { Sparkle16Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./Answer.module.css";
import { ActivityLine } from "../AnswerActivity/ActivityLine";
import { useToolIcon } from "../AnswerActivity/useToolIcon";
import { useToolDisplayName } from "../../hooks/useToolDisplayName";
import { getRunningStep, type RunActivity } from "../../utils/agUiActivity";

const PHRASE_COUNT = 12;
const PHRASE_INTERVAL_MS = 4000;
// Keeps fast tool calls readable instead of letting them flicker past.
const MIN_STEP_DISPLAY_MS = 400;

const shuffledIndices = (indices: number[]) => {
    for (let index = indices.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [indices[index], indices[randomIndex]] = [indices[randomIndex], indices[index]];
    }
    return indices;
};

/** Returns `value`, but holds each shown value for at least `minMs` before switching. */
const useMinimumDisplay = <T,>(value: T, minMs: number): T => {
    const [shown, setShown] = useState(value);
    const shownAt = useRef(Date.now());

    useEffect(() => {
        if (value === shown) return;
        const timeout = window.setTimeout(
            () => {
                shownAt.current = Date.now();
                setShown(value);
            },
            Math.max(0, minMs - (Date.now() - shownAt.current))
        );
        return () => window.clearTimeout(timeout);
    }, [value, shown, minMs]);

    return shown;
};

interface Props {
    /** Live AG-UI run activity; when a tool is running, it replaces the generic loading phrases. */
    activity?: RunActivity;
}

export const AnswerLoading = ({ activity }: Props) => {
    const { t } = useTranslation();
    const getToolDisplayName = useToolDisplayName();
    const getToolIcon = useToolIcon();
    const runningCallId = activity ? getRunningStep(activity)?.toolCallId : undefined;
    const shownCallId = useMinimumDisplay(runningCallId, MIN_STEP_DISPLAY_MS);
    const shownStep = shownCallId ? activity?.steps.find(step => step.toolCallId === shownCallId) : undefined;
    const toolLabel = shownStep ? t("chat.activity_running_tool", { tool: getToolDisplayName(shownStep.toolName) }) : undefined;
    const [initialPhraseIndex] = useState(() => Math.floor(Math.random() * PHRASE_COUNT));
    const [phraseIndex, setPhraseIndex] = useState(initialPhraseIndex);
    const animatedStyles = useSpring({
        from: { opacity: 0 },
        to: { opacity: 1 }
    });

    useEffect(() => {
        let previousIndex = initialPhraseIndex;
        let remaining = shuffledIndices(Array.from({ length: PHRASE_COUNT }, (_, index) => index).filter(index => index !== previousIndex));

        const interval = window.setInterval(() => {
            if (remaining.length === 0) {
                remaining = shuffledIndices(Array.from({ length: PHRASE_COUNT }, (_, index) => index));
                if (remaining[0] === previousIndex) {
                    [remaining[0], remaining[1]] = [remaining[1], remaining[0]];
                }
            }

            previousIndex = remaining.shift()!;
            setPhraseIndex(previousIndex);
        }, PHRASE_INTERVAL_MS);

        return () => window.clearInterval(interval);
    }, [initialPhraseIndex]);

    const phrases = t("chat.answer_loading_phrases", { returnObjects: true }) as string[];

    return (
        <animated.div style={{ ...animatedStyles }}>
            <div className={styles.answerContainer}>
                <div className={styles.growItem}>
                    <div className={styles.loadingLine} role="status">
                        {/* Announce only real progress changes, not the rotating filler phrases. */}
                        <span className={styles.visuallyHidden}>{toolLabel ?? t("chat.answer_loading")}</span>
                        <span aria-hidden="true">
                            {shownStep && toolLabel ? (
                                <ActivityLine
                                    icon={getToolIcon(shownStep.toolName)}
                                    label={toolLabel}
                                    detail={shownStep.detail}
                                    startedAt={activity?.startedAt}
                                />
                            ) : (
                                <ActivityLine
                                    icon={<Sparkle16Regular />}
                                    label={phrases[phraseIndex] ?? t("chat.answer_loading")}
                                    startedAt={activity?.startedAt}
                                />
                            )}
                        </span>
                    </div>
                </div>
            </div>
        </animated.div>
    );
};
