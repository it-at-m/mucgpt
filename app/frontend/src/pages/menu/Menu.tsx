import { Link, NavLink } from "react-router-dom";
import styles from "./Menu.module.css";
import { useTranslation } from "react-i18next";
import { AddBotButton } from "../../components/AddBotButton";
import { useEffect, useState } from "react";
import { getAllBots } from "../../service/storage";
import { Bot } from "../../api/models";
const onAddBot = () => { window.location.href = "/#/create" }

const Menu = () => {
    const { t, i18n } = useTranslation();
    const simply = true;
    const [bots, setBots] = useState<Bot[]>([]);
    useEffect(() => {
        getAllBots().then((bots) => {
            if (bots) {
                setBots(bots)
            } else {
                setBots([])
            }
        })
    }, [])

    return (
        <div className={styles.container}>
            <div className={styles.row}>
                <Link to="/chat" className={styles.box}>
                    {t('header.chat')}
                </Link>
                <Link to="/sum" className={styles.box}>
                    {t('header.sum')}
                </Link>
                <Link to="/brainstorm" className={styles.box}>
                    {t('header.brainstorm')}
                </Link>
                {simply &&
                    <Link to="/simply" className={styles.box}>
                        <p className={styles.btnText}>{t('header.simply')}</p>
                    </Link>
                }
            </div>
            <div className={styles.rowheader}>
                Eigene Assistenten <AddBotButton onClick={onAddBot}></AddBotButton>
            </div>

            <div className={styles.row}>
                {bots.map((bot: Bot, index: number) => (
                    <Link to={`/bot/${bot.id}`} className={styles.box}>
                        {bot.title}
                    </Link>
                ))}
            </div>
            <div className={styles.rowheader}>
                Community Assistenten
            </div>
            <div className={styles.row}>
                Comming soon...
            </div>
        </div >
    );
};

export default Menu;
