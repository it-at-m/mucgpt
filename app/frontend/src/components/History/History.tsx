
import { Button, Drawer, DrawerBody, DrawerHeader, DrawerHeaderTitle, Tooltip } from '@fluentui/react-components';
import { Delete24Regular, Dismiss24Regular, History24Regular } from '@fluentui/react-icons';
import { MutableRefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteChatFromDB, indexedDBStorage, onError, onUpgrade } from '../../service/storage';
import { AskResponse } from '../../api/models';
import styles from "./History.module.css";

interface Props {
    storage: indexedDBStorage
    setAnswers: (answers: [user: string, response: AskResponse, user_tokens: number][]) => void
    lastQuestionRef: MutableRefObject<string>
    currentId: number
    setCurrentId: (id: number) => void
}
export const History = ({ storage, setAnswers, lastQuestionRef, currentId, setCurrentId }: Props) => {
    const { t } = useTranslation();

    const [isOpen, setIsOpen] = useState(false);
    const [chatButtons, setChatButtons] = useState<JSX.Element[]>([]);

    const loadChat = (stored: any) => {
        setAnswers(stored.Data.Answers);
        lastQuestionRef.current = stored.Data.Answers[stored.Data.Answers.length - 1][0];
        setIsOpen(false);
        setCurrentId(stored.id);
        let openRequest = indexedDB.open(storage.db_name, storage.db_version);
        openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
        openRequest.onerror = () => onError(openRequest)
        openRequest.onsuccess = async function () {
            let db = openRequest.result;
            let transaction = db.transaction(storage.objectStore_name, "readwrite");
            let chat = transaction.objectStore(storage.objectStore_name);
            stored["refID"] = stored["id"]
            stored["id"] = 0
            let putRequest = chat.put(stored);
            putRequest.onerror = () => onError(putRequest)
        }
    }

    const getAllChats = async () => {
        let openRequest = indexedDB.open(storage.db_name, storage.db_version);
        openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
        openRequest.onerror = () => onError(openRequest)
        openRequest.onsuccess = async function () {
            let db = openRequest.result;
            let transaction = db.transaction(storage.objectStore_name, "readwrite");
            let chat = transaction.objectStore(storage.objectStore_name);
            let stored = chat.getAll();
            stored.onsuccess = function () {
                const newChatButtons = stored.result.sort((a: any, b: any) => a.Data.LastEdited - b.DataLastEdited)
                    .filter((chat: any, index: any) => chat.id !== 0)
                    .map((chat: any, index: any) => (
                        <div key={index}>
                            <Button className={styles.savedChatButton} onClick={() => loadChat(chat)} size="large">{chat.Data.Name}</Button>
                            <Tooltip content={t('common.clear_chat')} relationship="description" positioning="below">
                                <Button aria-label={t('common.clear_chat')} icon={<Delete24Regular />} appearance="secondary" onClick={() => deleteChatFromDB(storage, chat.id, setAnswers, chat.id === currentId, lastQuestionRef)} size="large">
                                </Button>
                            </Tooltip>
                        </div>)
                    );
                setChatButtons(newChatButtons);
            };
            stored.onerror = () => onError(stored)
        };
    }

    getAllChats();

    return (
        <div>
            <Drawer
                type={"overlay"}
                separator
                open={isOpen}
                onOpenChange={(_, { open }) => setIsOpen(open)}
            >
                <DrawerHeader>
                    <DrawerHeaderTitle
                        action={
                            <Button
                                appearance="subtle"
                                aria-label="Close"
                                icon={<Dismiss24Regular />}
                                onClick={() => setIsOpen(false)}
                            />
                        }
                    >
                        History
                    </DrawerHeaderTitle>
                </DrawerHeader>

                <DrawerBody>
                    {t('components.history.button')}:
                    {chatButtons}
                </DrawerBody>
            </Drawer>
            <div className={styles.button}>
                <Tooltip content={t('components.history.button')} relationship="description" positioning="below">
                    <Button aria-label={t('components.history.button')} icon={<History24Regular />} appearance="secondary" onClick={() => setIsOpen(true)} size="large">
                    </Button>
                </Tooltip>
            </div>
        </div>
    )
}