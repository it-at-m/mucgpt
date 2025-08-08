import styles from "./Menu.module.css";

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Tooltip } from "@fluentui/react-components";
import { useContext, useEffect, useState } from "react";

import { AddBotButton } from "../../components/AddBotButton";
import { CreateBotDialog } from "../../components/CreateBotDialog/CreateBotDialog";
import { BotStorageService } from "../../service/botstorage";
import { AssistantResponse, Bot } from "../../api/models";
import { BOT_STORE } from "../../constants";
import { migrate_old_bots } from "../../service/migration";
import { SearchCommunityBotButton } from "../../components/SearchCommunityBotButton/SearchCommunityBotButton";
import { CommunityBotsDialog } from "../../components/CommunityBotDialog/CommunityBotDialog";
import { DEFAULTHEADER, HeaderContext } from "../layout/HeaderContextProvider";
import { UserContext } from "../layout/UserContextProvider";
import { QuestionInput } from "../../components/QuestionInput/QuestionInput";
import { getOwnedCommunityBots, getUserSubscriptionsApi } from "../../api/assistant-client";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { Share24Regular } from "@fluentui/react-icons";
import { BotStats } from "../../components/BotStats/BotStats";

const Menu = () => {
    const { t } = useTranslation();
    const [bots, setBots] = useState<Bot[]>([]);
    const [communityBots, setCommunityBots] = useState<{ id: string; name: string; description: string }[]>([]);
    const [ownedCommunityBots, setOwnedCommunityBots] = useState<AssistantResponse[]>([]);
    const [showSearchBot, setShowSearchBot] = useState<boolean>(false);
    const [getCommunityBots, setGetCommunityBots] = useState<boolean>(false);
    const [hoveredBotId, setHoveredBotId] = useState<string | null>(null);
    const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const [showDialogInput, setShowDialogInput] = useState<boolean>(false);
    const [question, setQuestion] = useState<string>("");
    const [username, setUserName] = useState<string>("");
    const { setHeader } = useContext(HeaderContext);
    const { user } = useContext(UserContext);
    const { showSuccess } = useGlobalToastContext();
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

    const onShareBot = (botId: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/#/communitybot/${botId}`);
        showSuccess("Link kopiert", "Der Bot-Link wurde in die Zwischenablage kopiert.");
    };

    const handleMouseEnter = (botId: string, event: React.MouseEvent) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        setHoverPosition({
            x: rect.left + scrollX + rect.width / 2,
            y: rect.bottom + scrollY
        });
        setHoveredBotId(botId);
    };

    const handleMouseLeave = () => {
        setHoveredBotId(null);
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
                        <div key={key} className={styles.box} onMouseEnter={e => handleMouseEnter(bot.id, e)} onMouseLeave={handleMouseLeave}>
                            <div className={styles.boxHeader}>{bot.latest_version.name}</div>
                            <div className={styles.boxDescription}>{bot.latest_version.description}</div>
                            <div className={styles.boxButtons}>
                                <Link to={`owned/communitybot/${bot.id}`} className={styles.boxChoose}>
                                    {t("menu.select")}
                                </Link>
                                <Button onClick={() => onShareBot(bot.id)} className={styles.boxChoose}>
                                    <Share24Regular /> Teilen
                                </Button>
                            </div>
                        </div>
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
            {hoveredBotId && (
                <div
                    style={{
                        position: "absolute",
                        left: hoverPosition.x - 160, // Center horizontally (assuming 320px width)
                        top: hoverPosition.y + 10, // Position below the bot box
                        zIndex: 1000,
                        padding: "12px",
                        pointerEvents: "none"
                    }}
                >
                    {ownedCommunityBots.find(bot => bot.id === hoveredBotId) && <BotStats bot={ownedCommunityBots.find(bot => bot.id === hoveredBotId)!} />}
                </div>
            )}
        </div>
    );
};

export default Menu;
