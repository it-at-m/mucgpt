import styles from "./Version.module.css";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Tooltip } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";

const Version = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const onClose = () => {
        navigate("/");
    };

    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <Tooltip content={t("common.close")} relationship="description" positioning="below">
                    <Button
                        aria-label={t("common.close")}
                        icon={<Dismiss24Regular className={styles.system_prompt_warining_icon} />}
                        appearance="secondary"
                        onClick={onClose}
                        size="large"
                    ></Button>
                </Tooltip>
            </div>

            <div className={styles.versionRoot}>
                <h1 className={styles.header}>{t("version.header")}</h1>
                <Accordion multiple collapsible defaultOpenItems="15">
                    <AccordionItem value="15">
                        <AccordionHeader>{t("versions.v2_0.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h2>{t("versions.v2_0.title")}</h2>

                                <h3>{t("versions.v2_0.newInterface.title")}</h3>
                                <p>{t("versions.v2_0.newInterface.paragraph1")}</p>
                                <p>{t("versions.v2_0.newInterface.paragraph2")}</p>

                                <h3>{t("versions.v2_0.shareableAssistants.title")}</h3>
                                <p>{t("versions.v2_0.shareableAssistants.paragraph1")}</p>
                                <p>{t("versions.v2_0.shareableAssistants.paragraph2")}</p>

                                <h3>{t("versions.v2_0.interfacesFoundation.title")}</h3>
                                <p>{t("versions.v2_0.interfacesFoundation.paragraph1")}</p>
                                <p>{t("versions.v2_0.interfacesFoundation.paragraph2")}</p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
};

export default Version;
