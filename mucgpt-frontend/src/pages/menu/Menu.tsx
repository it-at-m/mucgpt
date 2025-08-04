import styles from "./Menu.module.css";

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@fluentui/react-components";
import { useContext, useEffect, useState } from "react";

import { AddBotButton } from "../../components/AddBotButton";
import { CreateBotDialog } from "../../components/CreateBotDialog/CreateBotDialog";
import { BotStorageService } from "../../service/botstorage";
import { AssistantResponse, Bot } from "../../api/models";
import { BOT_STORE } from "../../constants";
import { migrate_old_bots } from "../../service/migration";
import { SearchCommunityBotButton } from "../../components/SearchCommunityBotButton/SearchCommunityBotButton";
import { CommunityBotsDialog } from "../../components/CommunityBotDialog/CommunityBotDialog";
import { getOwnedCommunityBots, getUserSubscriptionsApi } from "../../api";
import { DEFAULTHEADER, HeaderContext } from "../layout/HeaderContextProvider";
import { QuestionInput } from "../../components/QuestionInput/QuestionInput";

const Menu = () => {
    const { t } = useTranslation();
    const [bots, setBots] = useState<Bot[]>([]);
    const [communityBots, setCommunityBots] = useState<{ id: string; name: string }[]>([]);
    const [ownedCommunityBots, setOwnedCommunityBots] = useState<AssistantResponse[]>([]);
    const [showSearchBot, setShowSearchBot] = useState<boolean>(false);
    const [getCommunityBots, setGetCommunityBots] = useState<boolean>(false);

    const [showDialogInput, setShowDialogInput] = useState<boolean>(false);
    const [question, setQuestion] = useState<string>("");
    const { setHeader } = useContext(HeaderContext);
    setHeader(DEFAULTHEADER);

    const botStorageService: BotStorageService = new BotStorageService(BOT_STORE);

    useEffect(() => {
        // Check if the current path starts with "/?q="
        const currentPath = window.location.pathname + window.location.search;
        if (currentPath) {
            if (currentPath.startsWith("/?q=")) {
                const query = currentPath.slice(4, currentPath.length - 1);
                const decoded_query = decodeURIComponent(query).replaceAll("+", " ");
                setQuestion(decoded_query);
            }
        }

        migrate_old_bots().then(async () => {
            const bots = await botStorageService.getAllBotConfigs();
            setBots(bots);
            getUserSubscriptionsApi().then(subscriptions => {
                setCommunityBots(subscriptions);
            });
        });
        getOwnedCommunityBots().then(response => {
            setOwnedCommunityBots(response);
        });
    }, []);

    const onAddBot = () => {
        setShowDialogInput(true);
    };
    const onSearchBot = () => {
        setShowSearchBot(true);
        setGetCommunityBots(true);
    };

    return (
        <div>
            <div className={styles.chatstartercontainer}>
                <CreateBotDialog showDialogInput={showDialogInput} setShowDialogInput={setShowDialogInput} />
                <h1 className={styles.heading}>{t("menu.chat_header")}</h1>
                <div className={styles.chatstarter}>
                    <QuestionInput
                        onSend={question => {
                            window.location.href = `#/chat?q=${encodeURIComponent(question)}`;
                        }}
                        disabled={false}
                        placeholder={t("chat.prompt")}
                        tokens_used={0}
                        token_limit_tracking={false}
                        setQuestion={question => {
                            setQuestion(question);
                        }}
                        selectedTools={[]}
                        question={question}
                    ></QuestionInput>
                </div>
            </div>
            <div className={styles.container}>
                <div className={styles.rowheader}>
                    {t("menu.own_bots")} <AddBotButton onClick={onAddBot}></AddBotButton>
                </div>
                <div className={styles.row}>
                    {bots.map((bot: Bot, key) => (
                        <Tooltip key={key} content={bot.title} relationship="description" positioning="below">
                            <Link to={`/bot/${bot.id}`} className={styles.box}>
                                <span>{bot.title}</span>
                            </Link>
                        </Tooltip>
                    ))}
                    {bots.length === 0 && <div>{t("menu.no_bots")}</div>}
                </div>
                <div className={styles.rowheader}>
                    {t("menu.community_bots")} <SearchCommunityBotButton onClick={onSearchBot} />
                </div>
                <CommunityBotsDialog
                    showSearchDialogInput={showSearchBot}
                    setShowSearchDialogInput={setShowSearchBot}
                    takeCommunityBots={getCommunityBots}
                    setTakeCommunityBots={setGetCommunityBots}
                />
                <div className={styles.subrowheader}>Eigene:</div>
                <div className={styles.row}>
                    {ownedCommunityBots.map((bot: AssistantResponse, key) => (
                        <Tooltip key={key} content={bot.latest_version.name} relationship="description" positioning="below">
                            <Link to={`owned/communitybot/${bot.id}`} className={styles.box}>
                                {bot.latest_version.name}
                            </Link>
                        </Tooltip>
                    ))}
                    {ownedCommunityBots.length === 0 && <div>{t("menu.no_bots")}</div>}
                </div>
                <div className={styles.subrowheader}>Abonnierte:</div>
                <div className={styles.row}>
                    {communityBots.map(({ id, name }, key) => (
                        <Tooltip key={key} content={name} relationship="description" positioning="below">
                            <Link to={`communitybot/${id}`} className={styles.box}>
                                {name}
                            </Link>
                        </Tooltip>
                    ))}
                    {communityBots.length === 0 && <div>{t("menu.no_bots")}</div>}
                </div>
                <div className={styles.rowheader}> </div>
            </div>
        </div>
    );
};

export default Menu;
