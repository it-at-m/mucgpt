import { Button, DrawerBody, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, Tooltip } from "@fluentui/react-components";
import { Options24Regular } from "@fluentui/react-icons";
import { MutableRefObject, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AskResponse } from "../../api/models";
import styles from "./History.module.css";
import { MessageError } from "../../pages/chat/MessageError";

interface Props {
    allChats: any[];
    onDeleteChat: (id: number) => void;
    onChatOptionsChange: (config: any) => void;
}
export const History = ({ allChats, onDeleteChat, onChatOptionsChange }: Props) => {
    const { t } = useTranslation();
    const [chatButtons, setChatButtons] = useState<JSX.Element[]>([]);

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
            //storageService.renameChat(newName.trim(), chat);
        }
    };

    const changeFavourites = (fav: boolean, id: number) => {
        // storageService.changeFavouritesInDb(fav, id);
    };

    const getAllChats = async () => {
        try {
            const categorizedChats = allChats
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
                                <Button className={styles.savedChatButton} onClick={() => { }} size="large">
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
                                        <MenuItem onClick={() => onDeleteChat(chat.id)}>
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
