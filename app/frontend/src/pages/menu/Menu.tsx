import { Link } from "react-router-dom";
import styles from "./Menu.module.css";
import { useTranslation } from "react-i18next";
import { AddBotButton } from "../../components/AddBotButton";
import { useEffect, useState } from "react";
import { bot_storage, getAllBots, getAllCommunityBots, storeBot, storeCommunityBot } from "../../service/storage_bot";
import { Bot } from "../../api/models";
import { Tooltip } from "@fluentui/react-components";
import { CreateBotDialog } from "../../components/CreateBotDialog/CreateBotDialog";
import { SearchBotButton } from "../../components/SearchBotButton/SearchBotButton";
import { CommunityBotsDialog } from "../../components/CommunityBotsDialog/CommuintyBotsDialog";
import { arielle_system, sherlock_system } from "./Prompts";
import { v4 as uuid } from 'uuid';

const Menu = () => {
    const { t } = useTranslation();
    const [bots, setBots] = useState<Bot[]>([]);
    const [communityBots, setCommunityBots] = useState<Bot[]>([]);

    const [showAddBot, setShowAddBot] = useState<boolean>(false);
    const [showSearachBot, setShowSearachBot] = useState<boolean>(false);

    useEffect(() => {
        const arielle: Bot = {
            title: "🧜‍♀️ Arielle",
            description:
                "Dieser Assistent erstellt syntaktisch korrekte Mermaid-Diagramme in Markdown für verschiedene Diagrammtypen basierend auf den bereitgestellten Daten und dem gewünschten Diagrammtyp.",
            system_message: arielle_system,
            publish: true,
            id: "0",
            temperature: 1.0,
            max_output_tokens: 4096
        };

        const sherlock: Bot = {
            title: "🕵️‍♂️ Sherlock Testfall-Designer",
            description:
                "🕵️‍♂️ Sherlock unterstützt Sie bei der Erstellung von Testfällen mit MUCGPT gemäß dem LHM-Testhandbuch, den ISTQB-Standards und der ISO-Norm 29119. Bei Fragen wenden Sie sich bitte an itm.km73-crowd@muenchen.de",
            system_message: sherlock_system,
            publish: true,
            id: "1",
            temperature: 1.0,
            max_output_tokens: 4096
        };

        storeCommunityBot(arielle);
        storeCommunityBot(sherlock);
        getAllBots().then(bots => {
            if (bots) {
                setBots(bots);
            } else {
                setBots([]);
            }
        });
        getAllCommunityBots().then(bots => {
            if (bots) {
                setCommunityBots(bots);
            } else {
                setCommunityBots([]);
            }
        });
    }, []);

    useEffect(() => {
        getAllCommunityBots().then(bots => {
            if (bots) {
                setCommunityBots(bots);
            } else {
                setCommunityBots([]);
            }
        });
    }, [showSearachBot]);

    const onAddBot = () => {
        setShowAddBot(true);
    };

    const onSearchBot = () => {
        setShowSearachBot(true);
    };

    return (
        <div className={styles.container}>
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

            <CreateBotDialog showDialogInput={showAddBot} setShowDialogInput={setShowAddBot} />

            <div className={styles.row}>
                {bots.map(
                    (bot: Bot, _) =>
                        <Tooltip content={bot.title} relationship="description" positioning="below">
                            <Link to={`/bot/${bot.id}`} className={styles.box}>
                                <span>{bot.title}</span>
                            </Link>
                        </Tooltip>
                )}
                {bots.length === 0 && <div>{t("menu.no_bots")}</div>}
            </div>
            <div className={styles.rowheader}>
                {t("menu.community_bots")} <SearchBotButton onClick={onSearchBot}></SearchBotButton>
            </div>
            <CommunityBotsDialog showSearchDialogInput={showSearachBot} setShowSearchDialogInput={setShowSearachBot} />

            <div className={styles.row}>
                {communityBots.map((bot: Bot, _) => (
                    <Tooltip content={bot.title} relationship="description" positioning="below">
                        <Link to={`/community-bot/${bot.id}`} className={styles.box}>
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
