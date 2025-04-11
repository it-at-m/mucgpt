import { Button, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, Tooltip } from "@fluentui/react-components";
import { Options24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import styles from "./History.module.css";
import { DBObject } from "../../service/storage";
import { useCallback } from "react";

interface Props {
    allChats: DBObject<any, any>[];
    currentActiveChatId: string | undefined;
    onDeleteChat: (id: string) => void;
    onChatNameChange: (id: string, newName: string) => void;
    onFavChange: (id: string, fav: boolean) => void;
    onSelect: (id: string) => void;
}
export const History = ({ allChats, currentActiveChatId, onDeleteChat, onChatNameChange, onFavChange, onSelect }: Props) => {
    const { t } = useTranslation();

    // get time category of the chat
    // today, yesterday, last 7 days, older
    const getCategory = useCallback((lastEdited: number, fav: boolean) => {
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
    }, [t]);

    // sort chats by last edited date and categorize them
    const categorizedChats = allChats
        .filter((chat: DBObject<any, any>) => chat.id)
        .sort((a: DBObject<any, any>, b: DBObject<any, any>) => {
            return (b._last_edited as number) - (a._last_edited as number);
        })
        .reduce((acc: { [key: string]: DBObject<any, any>[] }, chat: DBObject<any, any>) => {
            const category = getCategory(chat._last_edited as number, chat.favorite ? chat.favorite : false);
            if (!acc[category]) acc[category] = [];
            acc[category].push(chat);
            return acc;
        }, {});
    const sortedChats = Object.entries(categorizedChats).sort(([categoryA], [categoryB]) => {
        if (categoryA === t("components.history.favourites")) return -1;
        if (categoryB === t("components.history.favourites")) return 1;
        return 0;
    });

    return (
        <div>
            <div className={styles.header} role="heading" aria-level={3}>
                <Tooltip content={t("components.history.saved_in_browser")} relationship="description" positioning="below">
                    <div>{t("components.history.history")}</div>
                </Tooltip>
            </div>

            <div className={styles.historyContent}>
                {sortedChats.map(([category, chats]) => (
                    <div key={category}>
                        <div className={styles.header} role="heading" aria-level={4}>
                            {category}
                        </div>
                        {chats.map((chat: DBObject<any, any>, index: number) => (
                            <div key={index}>
                                <div className={styles.singlechatcontainer}>
                                    <Tooltip
                                        content={t("components.history.lastEdited") + new Date(chat._last_edited as number).toString()}
                                        relationship="description"
                                        positioning="below"
                                    >
                                        <Button
                                            className={styles.savedChatButton}
                                            disabled={currentActiveChatId == chat.id}
                                            onClick={() => onSelect(chat.id as string)}
                                            size="large"
                                        >
                                            {currentActiveChatId === chat.id ? "🟢 " : ""}
                                            {chat.name}
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
                                                <MenuItem onClick={() => onDeleteChat(chat.id as string)} disabled={currentActiveChatId == chat.id}>
                                                    {t("components.history.delete")}
                                                </MenuItem>
                                                <MenuItem onClick={() => onChatNameChange(chat.id as string, chat.name as string)}>
                                                    {t("components.history.rename")}
                                                </MenuItem>
                                                {chat.favorite ? (
                                                    <MenuItem onClick={() => onFavChange(chat.id as string, false)}>{t("components.history.unsave")}</MenuItem>
                                                ) : (
                                                    <MenuItem onClick={() => onFavChange(chat.id as string, true)}>{t("components.history.save")}</MenuItem>
                                                )}
                                            </MenuList>
                                        </MenuPopover>
                                    </Menu>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};
