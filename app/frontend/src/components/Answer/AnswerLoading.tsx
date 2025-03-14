import { Stack } from "@fluentui/react";
import { animated, useSpring } from "@react-spring/web";

import styles from "./Answer.module.css";
import { AnswerIcon } from "./AnswerIcon";

interface Props {
    text: string;
}

export const AnswerLoading = ({ text }: Props) => {
    const animatedStyles = useSpring({
        from: { opacity: 0 },
        to: { opacity: 1 }
    });

    return (
        <animated.div style={{ ...animatedStyles }}>
            <Stack className={styles.answerContainer} verticalAlign="space-between">
                <AnswerIcon />
                <Stack.Item className={styles.growItem} grow>
                    <p className={styles.answerText}>
                        {text}
                        <span className={styles.loadingdots} />
                    </p>
                </Stack.Item>
            </Stack>
        </animated.div>
    );
};
