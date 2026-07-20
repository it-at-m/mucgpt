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
            <div className={styles.answerContainer}>
                <AnswerIcon />
                <div className={styles.growItem}>
                    <p className={styles.answerText}>
                        {text}
                        <span className={styles.loadingdots} />
                    </p>
                </div>
            </div>
        </animated.div>
    );
};
