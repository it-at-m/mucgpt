import { Link, NavLink } from "react-router-dom";
import styles from "./Menu.module.css";
import { useTranslation } from "react-i18next";
import { AddBotButton } from "../../components/AddBotButton";
import { useEffect, useState } from "react";
import { getAllBots } from "../../service/storage";
import { Bot } from "../../api/models";
import { Tooltip } from "@fluentui/react-components";
import { CreateBotDialog } from "../../components/CreateBotDialog/CreateBotDialog";

const Menu = () => {
    const { t, i18n } = useTranslation();
    const [bots, setBots] = useState<Bot[]>([]);


    const [showDialogInput, setShowDialogInput] = useState<boolean>(false);

    useEffect(() => {
        getAllBots().then((bots) => {
            if (bots) {
                setBots(bots)
            } else {
                setBots([])
            }
        })
    }, [])

    const onAddBot = () => { setShowDialogInput(true) }



    return (
        <div className={styles.container}>
            <CreateBotDialog showDialogInput={showDialogInput} setShowDialogInput={setShowDialogInput} />
            <div className={styles.row}>
                <Tooltip content={t('header.chat')} relationship="description" positioning="below">
                    <Link to="/chat" className={styles.box}>
                        {t('header.chat')}
                    </Link>
                </Tooltip>
                <Tooltip content={t('header.sum')} relationship="description" positioning="below">
                    <Link to="/sum" className={styles.box}>
                        {t('header.sum')}
                    </Link>
                </Tooltip>
                <Tooltip content={t('header.brainstorm')} relationship="description" positioning="below">
                    <Link to="/brainstorm" className={styles.box}>
                        {t('header.brainstorm')}
                    </Link>
                </Tooltip>
                <Tooltip content={t('header.simply')} relationship="description" positioning="below">
                    <Link to="/simply" className={styles.box}>
                        <p className={styles.btnText}>{t('header.simply')}</p>
                    </Link>
                </Tooltip>
            </div>
            <div className={styles.rowheader}>
                {t('menu.own_bots')} <AddBotButton onClick={onAddBot}></AddBotButton>
            </div>

            <div className={styles.row}>
                {bots.map((bot: Bot, _) => (
                    <Tooltip content={bot.title} relationship="description" positioning="below">
                        <Link to={`/bot/${bot.id}`} className={styles.box}>
                            {bot.title}
                        </Link>
                    </Tooltip>
                ))}
                {bots.length === 0 && <div>{t('menu.no_bots')}</div>}
            </div>
            <div className={styles.rowheader}>
                {t('menu.community_bots')}
            </div>
            <div className={styles.row}>
                {t('menu.soon')}
            </div>
        </div >
    );
};

export default Menu;
