import { useMemo, useState } from "react";
import { Stack, IconButton } from "@fluentui/react";
import DOMPurify from "dompurify";

import styles from "./Answer.module.css";

import { AskResponse } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw'
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";


interface Props {
    answer: AskResponse;
    isSelected?: boolean;
    onCitationClicked: (filePath: string) => void;
    onSupportingContentClicked?: () => void;
    onRegenerateResponseClicked?: () => void;
}

export const Answer = ({
    answer,
    isSelected,
    onCitationClicked,
    onRegenerateResponseClicked, 
}: Props) => {
    const parsedAnswer = useMemo(() => parseAnswerToHtml(answer.answer, onCitationClicked), [answer]);
    
    const { t} = useTranslation ();

    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);

    return (
        <Stack className={`${styles.answerContainer} ${isSelected && styles.selected}`} verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon />
                    <div>
                        {onRegenerateResponseClicked &&
                            <IconButton
                                    style={{ color: "black"}}
                                    iconProps={{ iconName: "Sync" }}
                                    title={t('components.answer.regenerate')}
                                    ariaLabel={t('components.answer.regenerate')}
                                    onClick={() => onRegenerateResponseClicked()}
                                />
                        }
                    </div>
                </Stack>
            </Stack.Item>

            <Stack.Item grow>
                <Markdown 
                    className={styles.answerText}
                    remarkPlugins={[remarkGfm]} 
                    rehypePlugins={[rehypeRaw]}
                    children={sanitizedAnswerHtml}
                    components={{
                        "code": CodeBlockRenderer
                      }}/>
            </Stack.Item>
        </Stack>
    );
};
