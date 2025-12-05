import { Dismiss24Regular } from "@fluentui/react-icons";
import styles from "./Faq.module.css";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Link, Tooltip } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { HeaderContext } from "../layout/HeaderContextProvider";

const Faq = () => {
    const { t } = useTranslation();
    const { setHeader } = useContext(HeaderContext);
    setHeader("FAQs");
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

            <div className={styles.faqRoot}>
                <h1 className={styles.header}>FAQs</h1>
                <Accordion multiple collapsible navigation="linear">
                    <AccordionItem value="1">
                        <AccordionHeader>{t("faq.header_what_is_mucgpt")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>{t("faq.answer_what_is_mucgpt")}</div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="2">
                        <AccordionHeader>{t("faq.header_mucgpt_vs_chatgpt")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>{t("faq.answer_mucgpt_vs_chatgpt")}</div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="3">
                        <AccordionHeader>{t("faq.header_difference_searchengin")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                {t("faq.answer_difference_searchengin1")}
                                <p>{t("faq.answer_difference_searchengin2")}</p>
                                <p>{t("faq.answer_difference_searchengin3")}</p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="4">
                        <AccordionHeader>{t("faq.header_who_is_alowed")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>{t("faq.answer_who_is_alowed")}</div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="5">
                        <AccordionHeader>{t("faq.header_goal_mucgpt")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                {t("faq.answer_goal_mucgpt")}
                                <ul>
                                    <li>{t("faq.answer_goal_mucgpt1")}</li>
                                    <li>{t("faq.answer_goal_mucgpt2")}</li>
                                    <li>{t("faq.answer_goal_mucgpt3")}</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="6">
                        <AccordionHeader>{t("faq.header_features")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <div>
                                    <ul>
                                        <li>
                                            <strong>{t("faq.feature_one_title")}</strong> {t("faq.feature_one_description")}
                                        </li>
                                        <li>
                                            <strong>{t("faq.feature_two_title")}</strong> {t("faq.feature_two_description")}
                                        </li>
                                        <li>
                                            <strong>{t("faq.feature_three_title")}</strong> {t("faq.feature_three_description")}
                                        </li>
                                    </ul>
                                    <p>
                                        {t("faq.text_explanationvideo")}{" "}
                                        <Link href="https://www.youtube.com/watch?v=jLFvdJhRV_U">{t("faq.text_explanationvideo2")}</Link>.
                                    </p>
                                    <p>
                                        {t("faq.helptext_prompting")}{" "}
                                        <Link href="https://the-decoder.de/chatgpt-guide-prompt-strategien/">
                                            https://the-decoder.de/chatgpt-guide-prompt-strategien/
                                        </Link>
                                    </p>
                                    <p>
                                        {t("faq.helptext_brainstroming1")}{" "}
                                        <Link href="https://it-services.muenchen.de/sp?id=sc_cat_item&table=sc_cat_item&sys_id=c1b4dc4f1ba12154a70c433c8b4bcba0">
                                            {t("faq.helptext_brainstroming2")}
                                        </Link>{" "}
                                        {t("faq.helptext_brainstroming3")}
                                    </p>
                                </div>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="7">
                        <AccordionHeader>{t("faq.header_knowledge")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>{t("faq.answer_knowledge")}</div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="8">
                        <AccordionHeader>{t("faq.header_check_results")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                {t("faq.answer_check_results1")}
                                <p>{t("faq.answer_check_results2")}</p>
                                <p>{t("faq.answer_check_results3")}</p>
                                <p>
                                    {t("faq.answer_check_results4")}
                                    <ul>
                                        <li>{t("faq.answer_check_results5")}</li>
                                        <li>{t("faq.answer_check_results6")}</li>
                                        <li>{t("faq.answer_check_results7")}</li>
                                    </ul>
                                </p>
                                <p>{t("faq.answer_check_results8")}</p>
                                <p>{t("faq.answer_check_results9")}</p>
                                <p>{t("faq.answer_check_results10")}</p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="9">
                        <AccordionHeader>{t("faq.header_using_results")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                {t("faq.answer_using_results")}
                                <p>{t("faq.answer_using_results2")}</p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="10">
                        <AccordionHeader>{t("faq.header_quotes")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <ul>
                                    <li>{t("faq.answer_quotes1")}</li>
                                    <li>{t("faq.answer_quotes2")}</li>
                                    <li>{t("faq.answer_quotes3")}</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="11">
                        <AccordionHeader>{t("faq.header_datasecurity")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                {t("faq.answer_datasecurity1")}
                                <p>
                                    {t("faq.answer_datasecurity2")}{" "}
                                    <Link href="https://wilma.muenchen.de/pages/it-nutzung-support/apps/wiki/dienstanweisung/list/view/293986cc-4ded-4aad-ac2a-dd831540eb5c?currentLanguage=NONE">
                                        {t("faq.answer_datasecurity3")}
                                    </Link>
                                    {t("faq.answer_datasecurity4")}
                                </p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="12">
                        <AccordionHeader>{t("faq.header_saving_input")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>{t("faq.answer_saving_input")}</div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="13">
                        <AccordionHeader>{t("faq.header_saving_chats")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>{t("faq.answer_saving_chats")}</div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="14">
                        <AccordionHeader>{t("faq.header_training")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>{t("faq.answer_training")}</div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="15">
                        <AccordionHeader>{t("faq.header_data_usage")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>{t("faq.answer_data_usage")}</div>
                        </AccordionPanel>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
};

export default Faq;
