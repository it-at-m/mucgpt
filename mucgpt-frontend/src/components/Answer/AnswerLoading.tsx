import { useEffect, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { useTranslation } from "react-i18next";

import styles from "./Answer.module.css";

const PHRASE_COUNT = 12;
const PHRASE_INTERVAL_MS = 4000;

const shuffledIndices = (indices: number[]) => {
    for (let index = indices.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [indices[index], indices[randomIndex]] = [indices[randomIndex], indices[index]];
    }
    return indices;
};

export const AnswerLoading = () => {
    const { t } = useTranslation();
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
                    <p className={styles.answerText} role="status" aria-label={t("chat.answer_loading")}>
                        <span aria-hidden="true">{phrases[phraseIndex] ?? t("chat.answer_loading")}</span>
                        <span className={styles.loadingdots} aria-hidden="true" />
                    </p>
                </div>
            </div>
        </animated.div>
    );
};
