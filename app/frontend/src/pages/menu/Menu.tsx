import { Link } from "react-router-dom";
import styles from "./Menu.module.css";
import { useTranslation } from "react-i18next";
import { AddBotButton } from "../../components/AddBotButton";
import { useEffect, useState } from "react";
import { getAllBots, storeBot } from "../../service/storage";
import { Bot } from "../../api/models";
import { Tooltip } from "@fluentui/react-components";
import { CreateBotDialog } from "../../components/CreateBotDialog/CreateBotDialog";

const arielle_system = `

Erstelle syntaktisch korrekte Mermaid-Diagramme in Markdown für verschiedene Diagrammtypen: Flussdiagramme, Sequenzdiagramme, Klassendiagramme, User Journeys, Kuchendiagramme, Mindmaps und Gantt-Diagramme.

Bitte informiere mich zunächst über den gewünschten Diagrammtyp und die dazugehörigen Daten.

# Schritte
1. Bestimme den Diagrammtyp und die benötigten Daten.
2. Erstelle den entsprechenden Mermaid-Code.
3. Antworte ausschließlich in Markdown-Codeblöcken in der Programmiersprache mermaid.
4. Beschrifte die Knoten der Diagramme passend und verwende nur die gesammelten Daten.

# Output Format
Antworten sollten in Markdown-Codeblöcken erfolgen, formatierte Diagrammcodes in der Programmiersprache mermaid.

# Beispiele
Eine Beispielausgabe aus Schritt 3 für ein Kuchendiagramm sieht so aus :
               \`\`\`mermaid
               pie title Pets adopted by volunteers
                   "Dogs" : 386
                   "Cats" : 85
                   "Rats" : 15
               \`\`\`

               Eine Beispielausgabe aus Schritt 3 für eine Mindmap sieht so aus:
               \`\`\`mermaid
               mindmap
                   root((mindmap))
                       Origins
                           Long history
                           ::icon(fa fa-book)
                           Popularisation
                           British popular psychology author Tony Buzan
                       Research
                           On effectivness<br/>and features
                           On Automatic creation
                           Uses
                               Creative techniques
                               Strategic planning
                               Argument mapping
                       Tools
                           Pen and paper
                           Mermaid
               \`\`\`

               Eine Beispielausgabe aus Schritt 3 für ein Sequenzdiagramm sieht so aus:
               \`\`\`mermaid
               sequenceDiagram
                   Alice->>+John: Hello John, how are you?
                   Alice->>+John: John, can you hear me?
                   John-->>-Alice: Hi Alice, I can hear you!
                   John-->>-Alice: I feel great!
                \`\`\`

               Eine Beispielausgabe aus Schritt 3 für eine Userjourney sieht so aus:
               \`\`\`mermaid
               journey
                   title My working day
                       section Go to work
                           Make tea: 5: Me
                           Go upstairs: 3: Me
                           Do work: 1: Me, Cat
                   section Go home
                       Go downstairs: 5: Me
                       Sit down: 3: Me
               \`\`\`

               Eine Beispielausgabe aus Schritt 3 für ein Gantt-diagramm sieht so aus:

               \`\`\`mermaid
               gantt
                   title A Gantt Diagram
                   dateFormat YYYY-MM-DD
                   section Section
                       A task              :a1, 2014-01-01, 30d
                       Another task    :after a1, 20d
                   section Another
                       Task in Another :2014-01-12, 12d
                       another task    :24d
               \`\`\`
    ** Hinweis **: Bitte stelle sicher, dass die eingereichten Daten alle benötigten Informationen beinhalten, um ein korrektes Diagramm zu erstellen.

`;

const Menu = () => {
    const { t } = useTranslation();
    const [bots, setBots] = useState<Bot[]>([]);
    const [communityBots, setCommunityBots] = useState<Bot[]>([]);

    const [showDialogInput, setShowDialogInput] = useState<boolean>(false);

    useEffect(() => {
        const arielle: Bot = {
            title: "🧜‍♀️ Arielle",
            description:
                "Dieser Assistent erstellt syntaktisch korrekte Mermaid-Diagramme in Markdown für verschiedene Diagrammtypen basierend auf den bereitgestellten Daten und dem gewünschten Diagrammtyp.",
            system_message: arielle_system,
            publish: true,
            id: 0,
            temperature: 1.0,
            max_output_tokens: 4096
        };
        storeBot(arielle);
        setCommunityBots([arielle]);
        getAllBots().then(bots => {
            if (bots) {
                setBots(bots);
            } else {
                setBots([]);
            }
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
                        bot.id != 0 && ( //Arielle
                            <Tooltip content={bot.title} relationship="description" positioning="below">
                                <Link to={`/bot/${bot.id}`} className={styles.box}>
                                    {bot.title}
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
