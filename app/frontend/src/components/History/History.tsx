
import { Button, Drawer, DrawerBody, DrawerHeader, DrawerHeaderTitle, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, Tooltip } from '@fluentui/react-components';
import { Options24Regular, Dismiss24Regular, History24Regular } from '@fluentui/react-icons';
import { MutableRefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteChatFromDB, indexedDBStorage, onError, onUpgrade, renameChat, changeFavouritesInDb, CURRENT_CHAT_IN_DB } from '../../service/storage';
import { AskResponse } from '../../api/models';
import styles from "./History.module.css";
import { MessageError } from '../../pages/chat/MessageError';

interface Props {
    storage: indexedDBStorage
    setAnswers: (answers: [user: string, response: AskResponse, user_tokens: number][]) => void
    lastQuestionRef: MutableRefObject<string>
    currentId: number
    setCurrentId: (id: number) => void
    onTemperatureChanged: (temp: number, id: number) => void
    onMaxTokensChanged: (tokens: number, id: number) => void
    onSystemPromptChanged: (prompt: string, id: number) => void
    setError: (error: Error | undefined) => void
}
export const History = ({ storage, setAnswers, lastQuestionRef, currentId, setCurrentId, onTemperatureChanged, onMaxTokensChanged, onSystemPromptChanged, setError }: Props) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [chatButtons, setChatButtons] = useState<JSX.Element[]>([]);

    const loadChat = (stored: any) => {
        setError(undefined);
        let storedAnswers = stored.Data.Answers;
        lastQuestionRef.current = storedAnswers[storedAnswers.length - 1][0];
        if (storedAnswers[storedAnswers.length - 1][1].answer == "") {
            storedAnswers.pop()
            setError(new MessageError(t('components.history.error')))
        }
        setAnswers(storedAnswers);
        let id = stored.id;
        setIsOpen(false);
        setCurrentId(id);
        onTemperatureChanged(stored.Options.temperature, id);
        onMaxTokensChanged(stored.Options.maxTokens, id);
        onSystemPromptChanged(stored.Options.system, id);
        let openRequest = indexedDB.open(storage.db_name, storage.db_version);
        openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
        openRequest.onerror = () => onError(openRequest)
        openRequest.onsuccess = async function () {
            stored["refID"] = id
            stored["id"] = CURRENT_CHAT_IN_DB
            let putRequest = openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).put(stored);
            putRequest.onerror = () => onError(putRequest)
        }
    }
    const getCategory = (lastEdited: string, fav: boolean) => {
        if (fav) return t('components.history.favourites');
        const today = new Date();
        const lastEditedDate = new Date(lastEdited);
        today.setHours(0, 0, 0, 0);
        lastEditedDate.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today.getTime() - lastEditedDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return t('components.history.today');
        if (diffDays === 1) return t('components.history.yesterday');
        if (diffDays <= 7) return t('components.history.sevendays');
        return t('components.history.older');
    };
    const changeChatName = (chat: any) => {
        const newName = prompt(t('components.history.newchat'), chat.Data.Name);
        if (newName && newName.trim() !== "") {
            renameChat(storage, newName.trim(), chat)
            getAllChats();
        }
    };

    const deleteChat = (storage: indexedDBStorage, id: number, setAnswers: (answers: []) => void, isCurrent: boolean, lastQuestionRef: MutableRefObject<string>) => {
        deleteChatFromDB(storage, id, setAnswers, id === currentId, lastQuestionRef);
        getAllChats();
    }

    const changeFavourites = (fav: boolean, id: number) => {
        changeFavouritesInDb(fav, id, storage)
        getAllChats()
    }

    const getAllChats = async () => {
        let openRequest = indexedDB.open(storage.db_name, storage.db_version);
        openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
        openRequest.onerror = () => onError(openRequest)
        openRequest.onsuccess = async function () {
            let stored = openRequest.result.transaction(storage.objectStore_name, "readonly").objectStore(storage.objectStore_name).getAll();
            stored.onsuccess = function () {
                const categorizedChats = stored.result
                    .filter((chat: any) => chat.id !== 0)
                    .sort((a: any, b: any) => { return new Date(b.Data.LastEdited).getTime() - new Date(a.Data.LastEdited).getTime(); })
                    .reduce((acc: any, chat: any) => {
                        const category = getCategory(chat.Data.LastEdited, chat.Options.favourites);
                        if (!acc[category]) acc[category] = [];
                        acc[category].push(chat);
                        return acc;
                    }, {});
                const sortedChats = Object.entries(categorizedChats).sort(([categoryA], [categoryB]) => {
                    if (categoryA === t('components.history.favourites')) return -1;
                    if (categoryB === t('components.history.favourites')) return 1;
                    return 0;
                });
                const newChatButtons = sortedChats.map(([category, chats]: [string, any]) => (
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
                                            <MenuItem onClick={() => deleteChat(storage, chat.id, setAnswers, chat.id === currentId, lastQuestionRef)}>{t('components.history.delete')}</MenuItem>
                                            <MenuItem onClick={() => changeChatName(chat)}>{t('components.history.rename')}</MenuItem>
                                            {chat.Options.favourites ? (
                                                <MenuItem onClick={() => changeFavourites(false, chat.id)}>{t('components.history.unsave')}</MenuItem>
                                            ) : (
                                                <MenuItem onClick={() => changeFavourites(true, chat.id)}>{t('components.history.save')}</MenuItem>
                                            )}

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
    const open = () => {
        getAllChats();
        setIsOpen(true)
    }

    return (
        <div>
            <Drawer
                type={"overlay"}
                separator
                open={isOpen}
                position="end"
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
                        <Tooltip content={t('components.history.saved_in_browser')} relationship="description" positioning="below">
                            <p>{t('components.history.history')}:</p>
                        </Tooltip>
                    </DrawerHeaderTitle>
                </DrawerHeader>

                <DrawerBody>
                    {chatButtons}
                </DrawerBody>
            </Drawer>
            <div className={styles.button}>
                <Tooltip content={t('components.history.button')} relationship="description" positioning="below">
                    <Button aria-label={t('components.history.button')} icon={<History24Regular />} appearance="secondary" onClick={() => open()} size="large">
                    </Button>
                </Tooltip>
            </div>
        </div>
    )
}
