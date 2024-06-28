import { Button, Tooltip } from "@fluentui/react-components"
import { useTranslation } from "react-i18next";
import { deleteFromDB, indexedDBStorage, popLastInDB } from "../../service/storage";
import { DeleteArrowBackRegular } from "@fluentui/react-icons";

import styles from "./UserChatMessage.module.css"
import { MutableRefObject } from "react";


interface Props {
    message: string;
    setQuestion: (question: string) => void;
    answers: any[];
    setAnswers: (answers: any[]) => void;
    storage: indexedDBStorage;
    lastQuestionRef: MutableRefObject<string>;
}

export const RollBackMessage = ({ message, setQuestion, answers, setAnswers, storage, lastQuestionRef }: Props) => {
    const { t } = useTranslation();
    const deleteMessageAndRollbackChat = () => {
        let last;
        while (answers.length) {
            popLastInDB(storage);
            last = answers.pop();
            setAnswers(answers);
            if (last && last[0] == message) {
                break;
            }
        }
        if (answers.length == 0) {
            lastQuestionRef.current = ""
            deleteFromDB(storage)
        } else {
            lastQuestionRef.current = last[1]
        }
        setQuestion(message);
    };

    return <Tooltip content={t('components.deleteMessage.label')} relationship="description" positioning="above">
        <Button onClick={deleteMessageAndRollbackChat} appearance="subtle" aria-label={t('components.deleteMessage.label')} icon={<DeleteArrowBackRegular className={styles.iconRightMargin} />} size="large" />
    </Tooltip>;

}