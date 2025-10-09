import { Button, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, Tooltip } from "@fluentui/react-components";
import {
    MoreHorizontal20Regular,
    ChatHistory24Regular,
    Star24Filled,
    ChevronDown20Regular,
    ChevronRight20Regular,
    MoreCircle24Regular
} from "@fluentui/react-icons";
import { Collapse } from "@fluentui/react-motion-components-preview";
import { useTranslation } from "react-i18next";
import styles from "./History.module.css";
import { DBObject } from "../../service/storage";
import { useCallback, useMemo, useState } from "react";

interface Props {
    allChats: DBObject<any, any>[];
    currentActiveChatId: string | undefined;
    onDeleteChat: (id: string) => void;
    onChatNameChange: (id: string, newName: string) => void;
    onFavChange: (id: string, fav: boolean) => void;
    onSelect: (id: string) => void;
}

const INITIAL_ITEMS_PER_CATEGORY = 5;
const ITEMS_TO_ADD = 10;

export const History = ({ allChats, currentActiveChatId, onDeleteChat, onChatNameChange, onFavChange, onSelect }: Props) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState<boolean>(true);
    // Initialize all categories as collapsed by default
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [itemsToShow, setItemsToShow] = useState<Record<string, number>>({});

    // Toggle main history visibility
    const toggleHistoryVisibility = () => {
        setIsExpanded(!isExpanded);
    };

    // Toggle individual category visibility
    const toggleCategoryVisibility = (category: string) => {
        setExpandedCategories(prevExpanded => {
            const isExpanded = !!prevExpanded[category];
            const newExpandedState = !isExpanded;

            // If the category is being expanded for the very first time, initialize its items count.
            if (newExpandedState && itemsToShow[category] === undefined) {
                setItemsToShow(prevItems => ({
                    ...prevItems,
                    [category]: INITIAL_ITEMS_PER_CATEGORY
                }));
            }

            return { ...prevExpanded, [category]: newExpandedState };
        });
    };

    // get time category of the chat
    // today, yesterday, last 7 days, older
    const getCategory = useCallback(
        (lastEdited: number, fav: boolean) => {
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
        },
        [t]
    );

    // sort chats by last edited date and categorize them
    const sortedChats = useMemo(() => {
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

        return Object.entries(categorizedChats).sort(([categoryA], [categoryB]) => {
            const fav = t("components.history.favourites");
            if (categoryA === fav) return -1;
            if (categoryB === fav) return 1;
            return 0;
        });
    }, [allChats, getCategory, t]);

    // Initialize items to show when categories are accessed for the first time
    // instead of using a memoized value that re-calculates on each render

    const handleLoadMore = (category: string) => {
        setItemsToShow(prev => ({
            ...prev,
            [category]: (prev[category] || INITIAL_ITEMS_PER_CATEGORY) + ITEMS_TO_ADD
        }));
    };

    return (
        <div className={styles.historyContainer}>
            <div
                className={styles.header}
                role="heading"
                aria-level={3}
                onClick={toggleHistoryVisibility}
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && toggleHistoryVisibility()}
                aria-expanded={isExpanded}
            >
                <Tooltip content={t("components.history.saved_in_browser")} relationship="description" positioning="below">
                    <div className={styles.headerContent}>
                        <ChatHistory24Regular className={styles.icon} aria-hidden="true" />
                        <span>{t("components.history.history")}</span>
                        <div className={styles.expandCollapseIcon}>{isExpanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}</div>
                    </div>
                </Tooltip>
            </div>

            <Collapse visible={isExpanded}>
                <div className={styles.historyContent}>
                    {sortedChats.map(([category, chats]) => (
                        <ul key={category} className={styles.nopaddingleft}>
                            <li
                                className={styles.categoryHeader}
                                role="heading"
                                aria-level={4}
                                onClick={() => toggleCategoryVisibility(category)}
                                tabIndex={0}
                                onKeyDown={e => e.key === "Enter" && toggleCategoryVisibility(category)}
                                aria-expanded={!!expandedCategories[category]}
                            >
                                <div className={styles.categoryHeaderContent}>
                                    <span>{category}</span>
                                    <div className={styles.expandCollapseIcon}>
                                        {expandedCategories[category] ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
                                    </div>
                                </div>
                            </li>
                            <Collapse visible={!!expandedCategories[category]}>
                                <div className={styles.categoryContent}>
                                    {chats.slice(0, itemsToShow[category] || INITIAL_ITEMS_PER_CATEGORY).map((chat: DBObject<any, any>, index: number) => (
                                        <li key={index} className={`${styles.singlechatcontainer} ${currentActiveChatId === chat.id ? styles.activeChat : ""}`}>
                                            <Tooltip
                                                content={t("components.history.lastEdited") + new Date(chat._last_edited as number).toLocaleString()}
                                                relationship="description"
                                                positioning="below"
                                            >
                                                <Button
                                                    className={styles.savedChatButton}
                                                    onClick={() => onSelect(chat.id as string)}
                                                    appearance="subtle"
                                                >
                                                    <div className={styles.chatButtonContent}>
                                                        {chat.favorite && <Star24Filled className={styles.favoriteIcon} />}
                                                        <span className={styles.chatName}>{chat.name}</span>
                                                    </div>
                                                </Button>
                                            </Tooltip>
                                            <Menu>
                                                <MenuTrigger disableButtonEnhancement>
                                                    <Tooltip content={t("components.history.options")} relationship="description" positioning="below">
                                                        <Button
                                                            icon={<MoreHorizontal20Regular />}
                                                            appearance="subtle"
                                                            size="small"
                                                            className={styles.optionsButton}
                                                        />
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
                                                            <MenuItem onClick={() => onFavChange(chat.id as string, false)}>
                                                                {t("components.history.unsave")}
                                                            </MenuItem>
                                                        ) : (
                                                            <MenuItem onClick={() => onFavChange(chat.id as string, true)}>
                                                                {t("components.history.save")}
                                                            </MenuItem>
                                                        )}
                                                    </MenuList>
                                                </MenuPopover>
                                            </Menu>
                                        </li>
                                    ))}
                                    {chats.length > (itemsToShow[category] || INITIAL_ITEMS_PER_CATEGORY) && (
                                        <li className={styles.loadMoreContainer}>
                                            <Button
                                                onClick={() => handleLoadMore(category)}
                                                appearance="subtle"
                                                className={styles.loadMoreButton}
                                                icon={<MoreCircle24Regular />}
                                            >
                                                {t("components.history.loadMore")} ({chats.length - (itemsToShow[category] || INITIAL_ITEMS_PER_CATEGORY)})
                                            </Button>
                                        </li>
                                    )}
                                </div>
                            </Collapse>
                        </ul>
                    ))}
                </div>
            </Collapse>
        </div>
    );
};
