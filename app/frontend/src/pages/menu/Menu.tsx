import { Link } from "react-router-dom";
import styles from "./Menu.module.css";
import { useTranslation } from "react-i18next";
import { AddBotButton } from "../../components/AddBotButton";
import { useEffect, useState } from "react";
import { Bot } from "../../api/models";
import { Tooltip } from "@fluentui/react-components";
import { CreateBotDialog } from "../../components/CreateBotDialog/CreateBotDialog";
import { arielle_bot, sherlock_bot } from "./static_bots";
import { BOT_STORE } from "../../constants";
import { BotStorageService } from "../../service/botstorage";

const Menu = () => {
    const { t } = useTranslation();
    const [bots, setBots] = useState<Bot[]>([]);
    const [communityBots, setCommunityBots] = useState<Bot[]>([]);

    const [showDialogInput, setShowDialogInput] = useState<boolean>(false);

    const botStorageService: BotStorageService = new BotStorageService(BOT_STORE);

    useEffect(() => {
        const arielle: Bot = arielle_bot;
        const sherlock: Bot = sherlock_bot;
        botStorageService
            .getBotConfig(arielle.id as string)
            .then(bot => {
                if (!bot) botStorageService.createBot(arielle, arielle.id as string);
            })
            .then(async () => {
                const bot = await botStorageService.getBotConfig(sherlock.id as string);
                if (!bot) botStorageService.createBot(sherlock, sherlock.id as string);
            })
            .finally(() => {
                setCommunityBots([arielle, sherlock]);
                botStorageService.getAllBotConfigs().then(bots => {
                    setBots(bots);
                });
            });
    }, []);

    const onAddBot = () => {
        setShowDialogInput(true);
    };

    return (
        <div className={styles.container}>
            <CreateBotDialog showDialogInput={showDialogInput} setShowDialogInput={setShowDialogInput} />
            <div className={styles.row}>
                <Tooltip content={t("header.chat")} relationship="description" positioning="below">
                    <Link to="/chat" className={styles.box}>
                        {t("header.chat")}
                    </Link>
                </Tooltip>
                <Tooltip content={t("header.sum")} relationship="description" positioning="below">
                    <Link to="/sum" className={styles.box}>
                        {t("header.sum")}
                    </Link>
                </Tooltip>
                <Tooltip content={t("header.brainstorm")} relationship="description" positioning="below">
                    <Link to="/brainstorm" className={styles.box}>
                        {t("header.brainstorm")}
                    </Link>
                </Tooltip>
                <Tooltip content={t("header.simply")} relationship="description" positioning="below">
                    <Link to="/simply" className={styles.box}>
                        <p className={styles.btnText}>{t("header.simply")}</p>
                    </Link>
                </Tooltip>
            </div>
            <div className={styles.rowheader}>
                {t("menu.own_bots")} <AddBotButton onClick={onAddBot}></AddBotButton>
            </div>

            <div className={styles.row}>
                {bots.map(
                    (bot: Bot, _) =>
                        bot.id != arielle_bot.id &&
                        bot.id != sherlock_bot.id && (
                            <Tooltip content={bot.title} relationship="description" positioning="below">
                                <Link to={`/bot/${bot.id}`} className={styles.box}>
                                    <span>{bot.title}</span>
                                </Link>
                            </Tooltip>
                        )
                )}
                {bots.length === 1 && <div>{t("menu.no_bots")}</div>}
            </div>
            <div className={styles.rowheader}>{t("menu.community_bots")}</div>
            <div className={styles.row}>
                {communityBots.map((bot: Bot, _) => (
                    <Tooltip content={bot.title} relationship="description" positioning="below">
                        <Link to={`/bot/${bot.id}`} className={styles.box}>
                            {bot.title}
                        </Link>
                    </Tooltip>
                ))}
            </div>
            <div className={styles.rowheader}> </div>
        </div>
    );
};

export default Menu;
