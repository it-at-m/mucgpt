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
    const simply = true;
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
                {bots.map((bot: Bot, _) => (
                    <Tooltip content={bot.title} relationship="description" positioning="below">
                        <Link to={`/bot/${bot.id}`} className={styles.box}>
                            {bot.title}
                        </Link>
                    </Tooltip>
                ))}
                {bots.length === 0 && <div>Keine Assistenten gefunden</div>}
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
