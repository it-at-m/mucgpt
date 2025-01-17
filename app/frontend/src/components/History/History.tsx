import { Button, DrawerBody, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, Tooltip } from "@fluentui/react-components";
import { Options24Regular } from "@fluentui/react-icons";
import { MutableRefObject, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CURRENT_CHAT_IN_DB, HistoryStorageService, indexedDBStorage } from "../../service/storage";
import { AskResponse } from "../../api/models";
import styles from "./History.module.css";
import { MessageError } from "../../pages/chat/MessageError";

interface Props {
    storage: indexedDBStorage;
    setAnswers: (answers: [user: string, response: AskResponse, user_tokens: number][]) => void;
    lastQuestionRef: MutableRefObject<string>;
    currentId: number;
    setCurrentId: (id: number) => void;
    onTemperatureChanged: (temp: number, id: number) => void;
    onMaxTokensChanged: (tokens: number, id: number) => void;
    onSystemPromptChanged: (prompt: string, id: number) => void;
    setError: (error: Error | undefined) => void;
}
export const History = ({
    storage,
    setAnswers,
    lastQuestionRef,
    currentId,
    setCurrentId,
    onTemperatureChanged,
    onMaxTokensChanged,
    onSystemPromptChanged,
    setError
}: Props) => {
    const { t } = useTranslation();
    const [chatButtons, setChatButtons] = useState<JSX.Element[]>([]);
    const storageService: HistoryStorageService = new HistoryStorageService(storage);

    const loadChat = async (stored: any) => {
        setError(undefined);
        let storedAnswers = stored.Data.Answers;
        lastQuestionRef.current = storedAnswers[storedAnswers.length - 1][0];
        if (storedAnswers[storedAnswers.length - 1][1].answer == "") {
            storedAnswers.pop();
            setError(new MessageError(t("components.history.error")));
        }
        setAnswers(storedAnswers);
        let id = stored.id;
        setCurrentId(id);
        onTemperatureChanged(stored.Options.temperature, id);
        onMaxTokensChanged(stored.Options.maxTokens, id);
        onSystemPromptChanged(stored.Options.system, id);
        stored["refID"] = id;
        stored["id"] = CURRENT_CHAT_IN_DB;
        try {
            const db = await storageService.connectToDB();
            let putRequest = await db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).put(stored);
        } catch (error) {
            storageService.onError(error);
        }
    };
    const getCategory = (lastEdited: string, fav: boolean) => {
        if (fav) return t("components.history.favourites");
        const today = new Date();
        const lastEditedDate = new Date(lastEdited);
        today.setHours(0, 0, 0, 0);
        lastEditedDate.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today.getTime() - lastEditedDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return t("components.history.today");
        if (diffDays === 1) return t("components.history.yesterday");
        if (diffDays <= 7) return t("components.history.sevendays");
        return t("components.history.older");
    };
    const changeChatName = (chat: any) => {
        const newName = prompt(t("components.history.newchat"), chat.Data.Name);
        if (newName && newName.trim() !== "") {
            storageService.renameChat(newName.trim(), chat);
            getAllChats();
        }
    };

    const deleteChat = (
        id: number,
        setAnswers: (answers: []) => void,
        isCurrent: boolean,
        lastQuestionRef: MutableRefObject<string>
    ) => {
        storageService.deleteChatFromDB(id, setAnswers, id === currentId, lastQuestionRef);
        getAllChats();
    };

    const changeFavourites = (fav: boolean, id: number) => {
        storageService.changeFavouritesInDb(fav, id);
        getAllChats();
    };

    const getAllChats = async () => {
        try {
            const db = await storageService.connectToDB(storage);
            let stored = await db.transaction(storage.objectStore_name, "readonly").objectStore(storage.objectStore_name).getAll();
            const categorizedChats = stored
                .filter((chat: any) => chat.id !== 0)
                .sort((a: any, b: any) => {
                    return new Date(b.Data.LastEdited).getTime() - new Date(a.Data.LastEdited).getTime();
                })
                .reduce((acc: any, chat: any) => {
                    const category = getCategory(chat.Data.LastEdited, chat.Options.favourites);
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(chat);
                    return acc;
                }, {});
            const sortedChats = Object.entries(categorizedChats).sort(([categoryA], [categoryB]) => {
                if (categoryA === t("components.history.favourites")) return -1;
                if (categoryB === t("components.history.favourites")) return 1;
                return 0;
            });
            const newChatButtons = sortedChats.map(([category, chats]: [string, any]) => (
                <div key={category}>
                    <h2>{category}</h2>
                    {chats.map((chat: any, index: number) => (
                        <div key={index}>
                            <Tooltip
                                content={t("components.history.lastEdited") + new Date(chat.Data.LastEdited).toString()}
                                relationship="description"
                                positioning="below"
                            >
                                <Button className={styles.savedChatButton} onClick={() => loadChat(chat)} size="large">
                                    {chat.Data.Name}
                                </Button>
                            </Tooltip>
                            <Menu>
                                <MenuTrigger disableButtonEnhancement>
                                    <Tooltip content={t("components.history.options")} relationship="description" positioning="below">
                                        <Button icon={<Options24Regular />} appearance="secondary" size="large" />
                                    </Tooltip>
                                </MenuTrigger>
                                <MenuPopover>
                                    <MenuList>
                                        <MenuItem onClick={() => deleteChat(chat.id, setAnswers, chat.id === currentId, lastQuestionRef)}>
                                            {t("components.history.delete")}
                                        </MenuItem>
                                        <MenuItem onClick={() => changeChatName(chat)}>{t("components.history.rename")}</MenuItem>
                                        {chat.Options.favourites ? (
                                            <MenuItem onClick={() => changeFavourites(false, chat.id)}>{t("components.history.unsave")}</MenuItem>
                                        ) : (
                                            <MenuItem onClick={() => changeFavourites(true, chat.id)}>{t("components.history.save")}</MenuItem>
                                        )}
                                    </MenuList>
                                </MenuPopover>
                            </Menu>
                            {index != chats.length - 1 && <hr />}
                        </div>
                    ))}
                </div>
            ));
            setChatButtons(newChatButtons);
        }
        catch (error) {
            storageService.onError(error);
        }
    };
    const open = () => {
        getAllChats();
    };

    useEffect(() => {
        open();
    }, []);

    return (
        <div>
            <div className={styles.historyHeader}>
                <Tooltip content={t("components.history.saved_in_browser")} relationship="description" positioning="below">
                    <h3>{t("components.history.history")}</h3>
                </Tooltip>
            </div>
            <div className={styles.historyContent}>{chatButtons}</div>
        </div>
    );
};
