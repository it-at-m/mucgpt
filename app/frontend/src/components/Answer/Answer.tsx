import { useMemo, useState } from "react";
import { Stack } from "@fluentui/react";

import styles from "./Answer.module.css";

import { AskResponse } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw'
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { ArrowSync24Regular, CheckmarkSquare24Regular, ContentView24Regular, Copy24Regular, } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";
import { RecommendAnswers } from "../RecommendedAnswers/RecommendedAnswers";


interface Props {
    answer: AskResponse;
    isSelected?: boolean;
    onCitationClicked: (filePath: string) => void;
    onSupportingContentClicked?: () => void;
    onRegenerateResponseClicked?: () => void;
    setQuestion: (question: string) => void;
}

export const Answer = ({
    answer,
    isSelected,
    onCitationClicked,
    onRegenerateResponseClicked,
    setQuestion,
}: Props) => {
    const parsedAnswer = useMemo(() => parseAnswerToHtml(answer.answer, onCitationClicked), [answer]);


    const { t } = useTranslation();

    const [copied, setCopied] = useState<boolean>(false);
    const [formatted, setFormatted] = useState<boolean>(true);
    const [ref, setRef] = useState<HTMLElement | null>();

    const oncopy = () => {
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
        }, 1000)
    }
    return (
        <Stack className={`${styles.answerContainer} ${isSelected && styles.selected}`} verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon aria-hidden />
                    <div>
                        <Tooltip content={t('components.answer.copy')} relationship="description" positioning={{ target: ref }}
                        >
                            <CopyToClipboard text={parsedAnswer.answerHtml}
                                onCopy={oncopy}>
                                <Button ref={setRef} appearance="subtle" aria-label={t('components.answer.copy')} icon={(!copied ? <Copy24Regular className={styles.iconRightMargin} /> : <CheckmarkSquare24Regular className={styles.iconRightMargin} />)} size="large">
                                </Button>

                            </CopyToClipboard>

                        </Tooltip>

                        <Tooltip content={t('components.answer.unformat')} relationship="description" positioning="above">
                            <Button appearance="subtle" aria-label={t('components.answer.unformat')} icon={<ContentView24Regular className={styles.iconRightMargin} />} onClick={() => setFormatted(!formatted)} size="large">
                            </Button>
                        </Tooltip>

                        {onRegenerateResponseClicked &&
                            <Tooltip content={t('components.answer.regenerate')} relationship="description" positioning="above">
                                <Button appearance="subtle" aria-label={t('components.answer.regenerate')} icon={<ArrowSync24Regular className={styles.iconRightMargin} />}
                                    onClick={() => onRegenerateResponseClicked()} size="large">
                                </Button>
                            </Tooltip>
                        }
                    </div>
                </Stack>
            </Stack.Item>

            <Stack.Item grow>
                {formatted &&
                    <Markdown
                        className={styles.answerText}
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        children={parsedAnswer.answerHtml}
                        components={{
                            "code": CodeBlockRenderer
                        }} />
                }
                {!formatted &&
                    <div className={styles.unformattedAnswer} tabIndex={0}>{parsedAnswer.answerHtml}
                    </div>}
            </Stack.Item>
            {onRegenerateResponseClicked &&
                <Stack.Item >
                    <RecommendAnswers
                        setQuestion={question => setQuestion(question)} />
                </Stack.Item>
            }
        </Stack>
    );
};
