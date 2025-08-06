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
import { UserContext } from "../layout/UserContextProvider";
import { QuestionInput } from "../../components/QuestionInput/QuestionInput";

const Menu = () => {
    const { t } = useTranslation();
    const [bots, setBots] = useState<Bot[]>([]);
    const [communityBots, setCommunityBots] = useState<{ id: string; name: string; description: string }[]>([]);
    const [ownedCommunityBots, setOwnedCommunityBots] = useState<AssistantResponse[]>([]);
    const [showSearchBot, setShowSearchBot] = useState<boolean>(false);
    const [getCommunityBots, setGetCommunityBots] = useState<boolean>(false);

    const [showDialogInput, setShowDialogInput] = useState<boolean>(false);
    const [question, setQuestion] = useState<string>("");
    const [username, setUserName] = useState<string>("");
    const { setHeader } = useContext(HeaderContext);
    const { user } = useContext(UserContext);
    setHeader(DEFAULTHEADER);

    const botStorageService: BotStorageService = new BotStorageService(BOT_STORE);

    useEffect(() => {
        // Check for query parameter in both hash and regular URLs
        let query = null;

        // Check hash format like #/?q=something
        const hashPart = window.location.hash;
        if (hashPart && hashPart.includes("?q=")) {
            const qIndex = hashPart.indexOf("?q=");
            if (qIndex !== -1) {
                query = hashPart.slice(qIndex + 3);
            }
        }
        // Check regular format /?q=something
        else {
            const currentPath = window.location.pathname + window.location.search;
            if (currentPath && currentPath.startsWith("/?q=")) {
                query = currentPath.slice(4);
            }
        }

        if (query) {
            const decoded_query = decodeURIComponent(query).replaceAll("+", " ");
            setQuestion(decoded_query);
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

    useEffect(() => {
        if (user) {
            setUserName(user.displayName || user.username || "User");
        }
    }, [user]);

    const onAddBot = () => {
        setShowDialogInput(true);
    };
    const onSearchBot = () => {
        setShowSearchBot(true);
        setGetCommunityBots(true);
    };

    const onSendQuestion = (question: string) => {
        window.location.href = `#/chat?q=${encodeURIComponent(question)}`;
    };
    return (
        <div>
            <div className={styles.chatstartercontainer}>
                <CreateBotDialog showDialogInput={showDialogInput} setShowDialogInput={setShowDialogInput} />
                <h1 className={styles.heading}>{t("menu.chat_header", { user: username })} </h1>
                <div className={styles.chatstarter}>
                    <QuestionInput
                        onSend={onSendQuestion}
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
                            <div className={styles.box}>
                                <div className={styles.boxHeader}>{bot.title}</div>
                                <div className={styles.boxDescription}>{bot.description}</div>
                                <Link to={`/bot/${bot.id}`} className={styles.boxChoose}>
                                    {t("menu.select")}
                                </Link>
                            </div>
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
                <div className={styles.subrowheader}>{t("menu.owned")}</div>
                <div className={styles.row}>
                    {ownedCommunityBots.map((bot: AssistantResponse, key) => (
                        <Tooltip key={key} content={bot.latest_version.name} relationship="description" positioning="below">
                            <div className={styles.box}>
                                <div className={styles.boxHeader}>{bot.latest_version.name}</div>
                                <div className={styles.boxDescription}>{bot.latest_version.description}</div>
                                <Link to={`owned/communitybot/${bot.id}`} className={styles.boxChoose}>
                                    {t("menu.select")}
                                </Link>
                            </div>
                        </Tooltip>
                    ))}
                    {ownedCommunityBots.length === 0 && <div>{t("menu.no_bots")}</div>}
                </div>
                <div className={styles.subrowheader}>{t("menu.subscribed")}</div>
                <div className={styles.row}>
                    {communityBots.map(({ id, name, description }, key) => (
                        <Tooltip key={key} content={name} relationship="description" positioning="below">
                            <div className={styles.box}>
                                <div className={styles.boxHeader}>{name}</div>
                                <div className={styles.boxDescription}>{description}</div>
                                <Link to={`communitybot/${id}`} className={styles.boxChoose}>
                                    {t("menu.select")}
                                </Link>
                            </div>
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
