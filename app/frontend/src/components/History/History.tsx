
import { Button, Drawer, DrawerBody, DrawerHeader, DrawerHeaderTitle, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, Tooltip } from '@fluentui/react-components';
import { Options24Regular, Dismiss24Regular, History24Regular } from '@fluentui/react-icons';
import { MutableRefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteChatFromDB, indexedDBStorage, onError, onUpgrade, renameChat } from '../../service/storage';
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
    const getCategory = (lastEdited: string) => {
        const today = new Date();
        const lastEditedDate = new Date(lastEdited);
        const diffTime = Math.abs(today.getTime() - lastEditedDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return t('components.history.today');
        if (diffDays === 2) return t('components.history.yesterday');
        if (diffDays <= 7) return t('components.history.sevendays');
        return t('components.history.older');
    };
    const changeChatName = (chat: any) => {
        const newName = prompt(t('components.history.newchat'), chat.Data.Name);
        if (newName && newName.trim() !== "") {
            renameChat(storage, newName.trim(), chat)
        }
    };

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
                const categorizedChats = stored.result
                    .filter((chat: any) => chat.id !== 0)
                    .sort((a: any, b: any) => { return new Date(b.Data.LastEdited).getTime() - new Date(a.Data.LastEdited).getTime(); })
                    .reduce((acc: any, chat: any) => {
                        const category = getCategory(chat.Data.LastEdited);
                        if (!acc[category]) acc[category] = [];
                        acc[category].push(chat);
                        return acc;
                    }, {});
                const newChatButtons = Object.entries(categorizedChats).map(([category, chats]: [string, any]) => (
                    <div key={category} >
                        <h2>{category}</h2>
                        {chats.map((chat: any, index: number) => (
                            <div key={index}>
                                <Tooltip content={t('components.history.lastEdited') + new Date(chat.Data.LastEdited).toString()} relationship="description" positioning="below">
                                    <Button className={styles.savedChatButton} onClick={() => loadChat(chat)} size="large" >
                                        {chat.Data.Name}
                                    </Button>
                                </Tooltip>
                                <Menu >
                                    <MenuTrigger disableButtonEnhancement>
                                        <Tooltip content={t('components.history.options')} relationship="description" positioning="below">
                                            <Button icon={<Options24Regular />} appearance="secondary" size="large" />
                                        </Tooltip>
                                    </MenuTrigger>
                                    <MenuPopover>
                                        <MenuList>
                                            <MenuItem onClick={() => deleteChatFromDB(storage, chat.id, setAnswers, chat.id === currentId, lastQuestionRef)}>Delete Chat</MenuItem>
                                            <MenuItem onClick={() => changeChatName(chat)}>Rename Chat</MenuItem>
                                        </MenuList>
                                    </MenuPopover>
                                </Menu>
                                {index != chats.length - 1 && <hr />}
                            </div>
                        ))
                        }
                    </div >
                ));
                setChatButtons(newChatButtons);
            };
            stored.onerror = () => onError(stored)
        };
    }

    useEffect(() => {
        getAllChats();
    }, []);

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
                                aria-label={t('components.history.close')}
                                icon={<Dismiss24Regular />}
                                onClick={() => setIsOpen(false)}
                            />
                        }
                    >
                        {t('components.history.history')}:
                    </DrawerHeaderTitle>
                </DrawerHeader>

                <DrawerBody>
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