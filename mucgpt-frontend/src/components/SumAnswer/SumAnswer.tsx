import React, { useCallback, useState } from "react";
import styles from "./SumAnswer.module.css";
import { Stack } from "@fluentui/react";
import { useTranslation } from "react-i18next";
import { SumResponse } from "../../api";
import DOMPurify from "dompurify";
import { Button } from "@fluentui/react-button";
import { Tooltip } from "@fluentui/react-components";
import { CheckmarkSquare24Regular, Copy24Regular } from "@fluentui/react-icons";
import { AnswerIcon } from "../Answer/AnswerIcon";
interface Props {
    answer: SumResponse;
}

export const SumAnswer = ({ answer }: Props) => {
    const { t } = useTranslation();
    const [getSelected, setSelected] = useState(0);
    const [copied, setCopied] = useState<boolean>(false);
    const [ref, setRef] = React.useState<HTMLElement | null>();

    const answers = answer.answer.length > 2 ? answer.answer.slice(-2) : answer.answer;

    const sanitizedAnswerHtmlWithoutColors = answers.map(answ => {
        return DOMPurify.sanitize(answ);
    });

    // copy
    const oncopy = useCallback(
        (text: string) => {
            setCopied(true);
            navigator.clipboard.writeText(text);
            setTimeout(() => {
                setCopied(false);
            }, 1000);
        },
        [navigator.clipboard]
    );

    return (
        <Stack verticalAlign="space-between" className={`${styles.sumanswerContainer}`}>
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon aria-hidden />
                    <div className={styles.buttonContainer}>
                        {answers.map((x, i) => (
                            <div key={i}>
                                <Button
                                    style={{
                                        border: "0.5px solid black",
                                        padding: "10px",
                                        backgroundColor: getSelected === i ? "var(--colorBrandBackgroundSelected)" : "var(--colorNeutralBackground1Hover)",
                                        height: "100%"
                                    }}
                                    appearance="outline"
                                    size="small"
                                    shape="rounded"
                                    onClick={() => setSelected(i)}
                                    key={i}
                                >
                                    {t("components.sumanswer.alternative")} {i + 1}
                                </Button>
                            </div>
                        ))}
                        <Tooltip content={t("components.sumanswer.copy")} relationship="description" positioning={{ target: ref }}>
                            <Button
                                ref={setRef}
                                appearance="subtle"
                                aria-label={t("components.answer.copy")}
                                onClick={() => oncopy(sanitizedAnswerHtmlWithoutColors[getSelected])}
                                icon={
                                    !copied ? (
                                        <Copy24Regular className={styles.iconRightMargin} />
                                    ) : (
                                        <CheckmarkSquare24Regular className={styles.iconRightMargin} />
                                    )
                                }
                                size="large"
                            ></Button>
                        </Tooltip>
                    </div>
                </Stack>
            </Stack.Item>
            <Stack.Item grow>
                <div className={styles.sumanswerContainer}>
                    <div className={styles.answerText} dangerouslySetInnerHTML={{ __html: sanitizedAnswerHtmlWithoutColors[getSelected] }}></div>
                </div>
            </Stack.Item>
        </Stack>
    );
};
