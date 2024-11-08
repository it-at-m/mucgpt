import { Stack } from "@fluentui/react"
import { Button, Divider, Tooltip } from "@fluentui/react-components";
import { Add24Regular, Cut24Regular, BookStar24Regular, BookContacts24Regular } from "@fluentui/react-icons";
import { useTranslation } from 'react-i18next';
import styles from "./RecommendedAnswers.module.css";

interface Props {
    setQuestion: (question: string) => void;
}

export const RecommendAnswers = ({ setQuestion }: Props) => {
    const { t } = useTranslation();
    return (
        <Stack style={{ width: 'auto' }}>
            <Divider className={styles.divider}><b>{t('components.recommendanswers.name')}</b></Divider>
            <Stack horizontal horizontalAlign="center">
                <Tooltip content={t('components.recommendanswers.informal_tooltip')} relationship="description" positioning="above">
                    <Button onClick={() => setQuestion(t('components.recommendanswers.informal_prompt'))} appearance="subtle" aria-label={t('components.recommendanswers.informal_prompt')} icon={<BookContacts24Regular />} className={styles.item}>{t('components.recommendanswers.informal')}</Button>
                </Tooltip>
                <Tooltip content={t('components.recommendanswers.formal_tooltip')} relationship="description" positioning="above">
                    <Button onClick={() => setQuestion(t('components.recommendanswers.formal_prompt'))} appearance="subtle" aria-label={t('components.recommendanswers.formal_prompt')} icon={<BookStar24Regular />} className={styles.item}>{t('components.recommendanswers.formal')}</Button>
                </Tooltip>
                <Tooltip content={t('components.recommendanswers.shorter_tooltip')} relationship="description" positioning="above">
                    <Button onClick={() => setQuestion(t('components.recommendanswers.shorter_prompt'))} appearance="subtle" aria-label={t('components.recommendanswers.shorter_prompt')} icon={<Cut24Regular />} className={styles.item}>{t('components.recommendanswers.shorter')}</Button>
                </Tooltip>
                <Tooltip content={t('components.recommendanswers.longer_tooltip')} relationship="description" positioning="above">
                    <Button onClick={() => setQuestion(t('components.recommendanswers.longer_prompt'))} appearance="subtle" aria-label={t('components.recommendanswers.longer_prompt')} icon={<Add24Regular />} className={styles.item}>{t('components.recommendanswers.longer')}</Button>
                </Tooltip>
            </Stack>
        </Stack>

    );
}


