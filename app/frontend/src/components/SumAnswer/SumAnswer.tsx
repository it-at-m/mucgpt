import React, { useState } from "react";
import styles from "./SumAnswer.module.css";
import { IconButton, Stack } from "@fluentui/react";
import { useTranslation } from 'react-i18next';
import { SumResponse } from "../../api";
import DOMPurify from "dompurify";
import { Button } from "@fluentui/react-button";
import { Tooltip } from "@fluentui/react-components";
import { CopyToClipboard } from 'react-copy-to-clipboard';
interface Props {
    answer: SumResponse;
    top_n: number; // die besten zwei Varianten darstellen
}

export const SumAnswer = ({ answer, top_n }: Props) => {
    const { t } = useTranslation();
    const [getSelected, setSelected] = useState(0);
    const [icon, setIcon] = useState<string>("Copy")
    const [copied, setCopied] = useState<boolean>(false);
    const [ref, setRef] = React.useState<HTMLElement | null>();

    const answers = answer.answer.length > 2 ? answer.answer.slice(-2) : answer.answer


    const sanitizedAnswerHtmlWithoutColors = answers.map(answ => {
        let summary = answ.denser_summary;
        return DOMPurify.sanitize(summary)
    });

    const sanitizedAnswerHtml = answers.map(answ => {
        let summary = answ.denser_summary;
        answ.missing_entities.forEach(ent => {
            summary = summary.replaceAll(ent, `<font style="color: green">${ent}</font>`)
        });
        return DOMPurify.sanitize(summary)
    });
    const sanitzedKeywords = answers.map(answ => answ.missing_entities.reduceRight((prev, curr) => prev + ", " + curr));

    const oncopy = () => {
        setCopied(true);
        setIcon("Checkmark");
        setTimeout(() => {
            setIcon("Copy");
            setCopied(false);
        }, 1000)
    }
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
                    <Tooltip content={t('components.sumanswer.copy')} relationship="description" positioning="below" mountNode={ref}>
                        <div ref={setRef} >
                            <CopyToClipboard text={sanitizedAnswerHtmlWithoutColors[getSelected]}
                                onCopy={oncopy}>
                                <IconButton
                                    style={{ color: "black" }}
                                    iconProps={{ iconName: icon }}
                                >
                                </IconButton>
                            </CopyToClipboard>
                        </div>
                    </Tooltip>
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


