import React, { LegacyRef, useLayoutEffect, useRef, useState } from "react";
import styles from "./SumAnswer.module.css";
import { IconButton, Stack } from "@fluentui/react";
import { useTranslation } from 'react-i18next';
import { SumResponse } from "../../api";
import DOMPurify from "dompurify";
import { Button } from "@fluentui/react-button";
interface Props {
    answer: SumResponse;
    top_n: number; // die besten zwei Varianten darstellen
}

export const SumAnswer = ({ answer, top_n }: Props) => {
    const { t } = useTranslation();
    const [getSelected, setSelected] = useState(0);
    const answers = answer.answer.length > 2 ? answer.answer.slice(-2) : answer.answer
    const sanitizedAnswerHtml = answers.map(answ => {
        let summary = answ.denser_summary;
        answ.missing_entities.forEach(ent => {
            summary = summary.replaceAll(ent, `<font style="color: green">${ent}</font>`)
        });
        return DOMPurify.sanitize(summary)
    });
    const sanitzedKeywords = answers.map(answ => answ.missing_entities.reduceRight((prev, curr) => prev + ", " + curr));
    return (
        <Stack verticalAlign="space-between" className={`${styles.sumanswerContainer}`}>
            <Stack.Item>
                <Stack horizontal horizontalAlign="end">
                    {sanitzedKeywords.map((x, i) => (
                        <div>
                            <Button
                                style={{ border: "0.5px solid black", padding: "10px", backgroundColor: getSelected === i ? "#f2f2f2" : "white", height: "100%" }}
                                appearance="outline"
                                size="small"
                                shape="rounded"
                                onClick={() => setSelected(i)}
                                key={i}
                            >{t("components.sumanswer.alternative")} {i + 1}</Button>
                        </div>
                    ))}
                </Stack>
            </Stack.Item>
            <Stack.Item grow>
                <div className={styles.sumanswerContainer}>
                    <div className={styles.answerText} dangerouslySetInnerHTML={{ __html: sanitizedAnswerHtml[getSelected] }}></div>
                </div>
            </Stack.Item>
        </Stack>
    );
};


