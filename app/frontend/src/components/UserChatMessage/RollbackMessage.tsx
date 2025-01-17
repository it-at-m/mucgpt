import { Button, Tooltip } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { BotStorageService, ChatStorageService, StorageService, bot_history_storage, bot_storage, indexedDBStorage } from "../../service/storage";
import { DeleteArrowBackRegular } from "@fluentui/react-icons";

import styles from "./UserChatMessage.module.css";
import { MutableRefObject } from "react";

interface Props {
    message: string;
    setQuestion: (question: string) => void;
    answers: any[];
    setAnswers: (answers: any[]) => void;
    storage: indexedDBStorage;
    lastQuestionRef: MutableRefObject<string>;
    current_id: number;
    is_bot: boolean;
}

export const RollBackMessage = ({ message, setQuestion, answers, setAnswers, storage, lastQuestionRef, current_id, is_bot }: Props) => {
    const { t } = useTranslation();

    const botStorageService: BotStorageService = new BotStorageService(bot_history_storage, bot_storage);
    const storageService: ChatStorageService = new ChatStorageService(storage);

    const deleteMessageAndRollbackChat = () => {
        let last;
        while (answers.length) {
            if (is_bot) {
                botStorageService.popLastBotMessageInDB(current_id);
            } else {
                storageService.popLastMessageInDB(current_id); //TODO
            }

            last = answers.pop();
            setAnswers(answers);
            if (last && last[0] == message) {
                break;
            }
        }
        if (answers.length == 0) {
            storageService.deleteChatFromDB(current_id, setAnswers, true, lastQuestionRef);
            storageService.deleteChatFromDB(0, setAnswers, false, lastQuestionRef);
        } else {
            lastQuestionRef.current = last[1];
        }
        setQuestion(message);
    };

    return (
        <Tooltip content={t("components.deleteMessage.label")} relationship="description" positioning="above">
            <Button
                onClick={deleteMessageAndRollbackChat}
                appearance="subtle"
                aria-label={t("components.deleteMessage.label")}
                icon={<DeleteArrowBackRegular className={styles.iconRightMargin} />}
                size="large"
            />
        </Tooltip>
    );
};
