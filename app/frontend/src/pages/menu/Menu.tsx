import styles from "./Menu.module.css";

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@fluentui/react-components";
import { useEffect, useState } from "react";

import { AddBotButton } from "../../components/AddBotButton";
import { CreateBotDialog } from "../../components/CreateBotDialog/CreateBotDialog";
import { BotStorageService } from "../../service/botstorage";
import { Bot } from "../../api/models";
import { BOT_STORE } from "../../constants";
import { migrate_old_bots } from "../../service/migration";

const Menu = () => {
    const { t } = useTranslation();
    const [bots, setBots] = useState<Bot[]>([]);
    const [communityBots, setCommunityBots] = useState<Bot[]>([]);

    const [showDialogInput, setShowDialogInput] = useState<boolean>(false);

    const botStorageService: BotStorageService = new BotStorageService(BOT_STORE);

    useEffect(() => {
        migrate_old_bots().then(async () => {
            let bots = await botStorageService.getAllBotConfigs();
            let community_assistants = communityBots;
            for (let bot of bots) {
                if (bot.publish) {
                    if (community_assistants.find(b => b.id === bot.id)) {
                        community_assistants = community_assistants.filter(b => b.id !== bot.id);
                    }
                    community_assistants.push(bot);
                    bots = bots.filter(b => b.id !== bot.id);
                }
            }
            setBots(bots);
            setCommunityBots(community_assistants);
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
                {bots.map((bot: Bot, _) => (
                    <Tooltip content={bot.title} relationship="description" positioning="below">
                        <Link to={`/bot/${bot.id}`} className={styles.box}>
                            <span>{bot.title}</span>
                        </Link>
                    </Tooltip>
                ))}
                {bots.length === 0 && <div>{t("menu.no_bots")}</div>}
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
                {communityBots.length === 0 && <div>{t("menu.no_bots")}</div>}
            </div>
            <div className={styles.rowheader}> </div>
        </div>
    );
};

export default Menu;
