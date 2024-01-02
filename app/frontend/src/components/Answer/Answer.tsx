import { useMemo, useState } from "react";
import { Stack, IconButton } from "@fluentui/react";

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
import { TextEditStyle24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";


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

    const { t } = useTranslation();

    const [icon, setIcon] = useState<string>("Copy")
    const [copied, setCopied] = useState<boolean>(false);
    const [formatted, setFormatted] = useState<boolean>(true);

    const oncopy = () => {
        setCopied(true);
        setIcon("Checkmark");
        setTimeout(() => {
            setIcon("Copy");
            setCopied(false);
        }, 1000)
    }
    return (
        <Stack className={`${styles.answerContainer} ${isSelected && styles.selected}`} verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon />
                    <div>
                        <CopyToClipboard text={parsedAnswer.answerHtml}
                            onCopy={oncopy}>
                            <IconButton
                                style={{ color: "black" }}
                                iconProps={{ iconName: icon }}
                                title={t('components.answer.copy')}
                            >
                            </IconButton>
                        </CopyToClipboard>
                        <IconButton
                            style={{ color: "black" }}
                            iconProps={{ iconName: "FabricTextHighlight" }}
                            ariaLabel={t('components.answer.unformat')}
                            title={t('components.answer.unformat')}
                            onClick={() => setFormatted(!formatted)}
                        />

                        {onRegenerateResponseClicked &&
                            <IconButton
                                style={{ color: "black" }}
                                iconProps={{ iconName: "Sync" }}
                                ariaLabel={t('components.answer.regenerate')}
                                title={t('components.answer.regenerate')}
                                onClick={() => onRegenerateResponseClicked()}
                            />
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
                    <div className={styles.unformattedAnswer}>{parsedAnswer.answerHtml}
                    </div>}
            </Stack.Item>
        </Stack>
    );
};
