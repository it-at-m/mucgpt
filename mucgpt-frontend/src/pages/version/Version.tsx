import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Tooltip } from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { MarkdownRenderer } from "../../components/MarkdownRenderer/MarkdownRenderer";
import { useConfigContext } from "../../context/ConfigContext";
import styles from "./Version.module.css";

const Version = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { release_notes: releaseNotes } = useConfigContext();
    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <Tooltip content={t("common.close")} relationship="description" positioning="below">
                    <Button
                        aria-label={t("common.close")}
                        icon={<Dismiss24Regular className={styles.system_prompt_warining_icon} />}
                        appearance="secondary"
                        onClick={() => navigate("/")}
                        size="large"
                    />
                </Tooltip>
            </div>

            <div className={styles.versionRoot}>
                <h1 className={styles.header}>{t("version.header")}</h1>
                <Accordion multiple collapsible defaultOpenItems={releaseNotes[0] ? `${releaseNotes[0].version}-0` : undefined}>
                    {releaseNotes.map((releaseNote, index) => {
                        const itemId = `${releaseNote.version}-${index}`;

                        return (
                            <AccordionItem key={itemId} value={itemId}>
                                <AccordionHeader>[{releaseNote.version}]</AccordionHeader>
                                <AccordionPanel>
                                    <div className={styles.panel}>
                                        <MarkdownRenderer>{releaseNote.content}</MarkdownRenderer>
                                    </div>
                                </AccordionPanel>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </div>
        </div>
    );
};

export default Version;
