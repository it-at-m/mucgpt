import styles from "./Version.module.css";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Tooltip } from "@fluentui/react-components";
import vorgeschlageneAntworten from "../../assets/vorgeschlagene_antworten.png";
import zurückziehen from "../../assets/zurückziehen.png";
import history from "../../assets/History.png";
import simply from "../../assets/simply.png";
import latex from "../../assets/latex.png";
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
                                <h3>{t("version.added")}</h3>
                                <div>
                                    <ul>
                                        <h4>{t("versions.v2_0.communityAssistants.title")}</h4>
                                        <ul>
                                            <li>{t("versions.v2_0.communityAssistants.share")}</li>
                                            <li>{t("versions.v2_0.communityAssistants.subscribe")}</li>
                                            <li>{t("versions.v2_0.communityAssistants.searchable")}</li>
                                            <li>{t("versions.v2_0.communityAssistants.manage")}</li>
                                        </ul>

                                        <h4>{t("versions.v2_0.tools.title")}</h4>
                                        <ul>
                                            <li>{t("versions.v2_0.tools.brainstorming")}</li>
                                            <li>{t("versions.v2_0.tools.fullscreen")}</li>
                                            <li>{t("versions.v2_0.tools.simplify")}</li>
                                            <li>{t("versions.v2_0.tools.interfaces")}</li>
                                        </ul>

                                        <h4>{t("versions.v2_0.misc.title")}</h4>
                                        <ul>
                                            <li>{t("versions.v2_0.misc.mermaid")}</li>
                                            <li>{t("versions.v2_0.misc.username")}</li>
                                            <li>{t("versions.v2_0.misc.tutorial")}</li>
                                        </ul>

                                        <h4>{t("versions.v2_0.redesign.title")}</h4>
                                        <ul>
                                            <li>{t("versions.v2_0.redesign.languageSelection")}</li>
                                            <li>{t("versions.v2_0.redesign.settings")}</li>
                                        </ul>

                                        <h4>{t("versions.v2_0.technical.title")}</h4>
                                        <ul>
                                            <li>{t("versions.v2_0.technical.services")}</li>
                                            <li>{t("versions.v2_0.technical.agents")}</li>
                                        </ul>
                                    </ul>
                                    <h3>{t("version.changed")}</h3>
                                    <ul>
                                        <li>{t("versions.v2_0.changed.summarizeRemoved")}</li>
                                    </ul>
                                </div>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="14">
                        <AccordionHeader>{t("versions.v1_2_5.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_2_5.fixed.tokenSetting")}</li>
                                    <li>{t("versions.v1_2_5.fixed.messageRecall")}</li>
                                    <li>{t("versions.v1_2_5.fixed.messageDisplay")}</li>
                                    <li>
                                        {t("versions.v1_2_5.fixed.latex")}
                                        <p>
                                            <img width="50%" src={latex} alt={t("versions.v1_2_5.fixed.latexAlt")}></img>
                                        </p>
                                    </li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li dangerouslySetInnerHTML={{ __html: t("versions.v1_2_5.changed.simpleLanguagePrompt") }}></li>
                                    <li>{t("versions.v1_2_5.changed.generalImprovements")}</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="13">
                        <AccordionHeader>{t("versions.v1_2_4.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    {t("versions.v1_2_4.added.communityAssistantsTitle")}
                                    <ul>
                                        <li>{t("versions.v1_2_4.added.examplesAndSuggestions")}</li>
                                        <li>
                                            {t("versions.v1_2_4.added.newVersionsTitle")}
                                            <ul>
                                                <li>{t("versions.v1_2_4.added.sherlock")}</li>
                                                <li>{t("versions.v1_2_4.added.consultor")}</li>
                                                <li>{t("versions.v1_2_4.added.arielle")}</li>
                                            </ul>
                                        </li>

                                        <li>{t("versions.v1_2_4.added.centralConfig")}</li>
                                    </ul>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_2_4.fixed.performance")}</li>
                                    <li>{t("versions.v1_2_4.fixed.policyViolation")}</li>
                                    <li>{t("versions.v1_2_4.fixed.codeBlocks")}</li>
                                    <li>{t("versions.v1_2_4.fixed.settingsButton")}</li>
                                    <li>{t("versions.v1_2_4.fixed.versionFaq")}</li>
                                    <li>
                                        {t("versions.v1_2_4.fixed.tokenUsageTitle")}
                                        <ul>
                                            <li>{t("versions.v1_2_4.fixed.tokenDisplay")}</li>
                                            <li dangerouslySetInnerHTML={{ __html: t("versions.v1_2_4.fixed.tokenRemoved") }}></li>
                                            <li>{t("versions.v1_2_4.fixed.tokenHidden")}</li>
                                        </ul>
                                    </li>
                                    <li>{t("versions.v1_2_4.fixed.typos")}</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>
                                        {t("versions.v1_2_4.changed.simpleLanguageTitle")}
                                        <ul>
                                            <li dangerouslySetInnerHTML={{ __html: t("versions.v1_2_4.changed.easyLanguageRemoved") }}></li>
                                            <li dangerouslySetInnerHTML={{ __html: t("versions.v1_2_4.changed.simpleLanguagePrompt") }}></li>
                                        </ul>
                                    </li>
                                    <li>
                                        {t("versions.v1_2_4.changed.ownAssistantsTitle")}
                                        <ul>
                                            <li dangerouslySetInnerHTML={{ __html: t("versions.v1_2_4.changed.settingsEditOnly") }}></li>
                                            <li>{t("versions.v1_2_4.changed.sidebarExpands")}</li>
                                            <li>{t("versions.v1_2_4.changed.communityReadOnly")}</li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="12">
                        <AccordionHeader>{t("versions.v1_2_3.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>{t("versions.v1_2_3.added.sherlock")}</li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>
                                        {t("versions.v1_2_3.fixed.brainstormingTitle")}
                                        <ul>
                                            <li>{t("versions.v1_2_3.fixed.darkMode")}</li>
                                        </ul>
                                    </li>
                                    <li>
                                        {t("versions.v1_2_3.fixed.simpleLanguageTitle")}
                                        <ul>
                                            <li>{t("versions.v1_2_3.fixed.linksIgnored")}</li>
                                        </ul>
                                    </li>
                                    <li>{t("versions.v1_2_3.fixed.codeCopy")}</li>
                                    <li>{t("versions.v1_2_3.fixed.mistralApi")}</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>
                                        {t("versions.v1_2_3.changed.brainstormingTitle")}
                                        <ul>
                                            <li>{t("versions.v1_2_3.changed.mindmapImproved")}</li>
                                        </ul>
                                    </li>
                                    <li>
                                        {t("versions.v1_2_3.changed.assistantsTitle")}
                                        <ul>
                                            <li>{t("versions.v1_2_3.changed.multipleChats")}</li>
                                        </ul>
                                    </li>
                                    <li>
                                        {t("versions.v1_2_3.changed.simpleLanguageTitle")}
                                        <ul>
                                            <li dangerouslySetInnerHTML={{ __html: t("versions.v1_2_3.changed.titleRenamed") }}></li>
                                        </ul>
                                    </li>
                                    <li>
                                        {t("versions.v1_2_3.changed.uiImprovementsTitle")}
                                        <ul>
                                            <li>{t("versions.v1_2_3.changed.sidebar")}</li>
                                            <li dangerouslySetInnerHTML={{ __html: t("versions.v1_2_3.changed.storage") }}></li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="11">
                        <AccordionHeader>{t("versions.v1_2_2.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        {t("versions.v1_2_2.added.customAssistants")}
                                        <ul>
                                            {t("versions.v1_2_2.added.examplesTitle")}
                                            <li>{t("versions.v1_2_2.added.translator")}</li>
                                            <li>{t("versions.v1_2_2.added.testGenerator")}</li>
                                            <li>{t("versions.v1_2_2.added.editor")}</li>
                                        </ul>
                                    </li>
                                    <li>{t("versions.v1_2_2.added.creation")}</li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_2_2.fixed.frontendBugs")}</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_2_2.changed.design")}</li>
                                    <li>{t("versions.v1_2_2.changed.arielle")}</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="10">
                        <AccordionHeader>{t("versions.v1_2_1.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        {t("versions.v1_2_1.added.simpleLanguageFeature")}
                                        <p>
                                            <img width="70%" src={simply} alt={t("versions.v1_2_1.added.simpleLanguageAlt")}></img>
                                        </p>
                                        <ul>
                                            <li>{t("versions.v1_2_1.added.chat")}</li>
                                            <li>{t("versions.v1_2_1.added.selection")}</li>
                                            <li>{t("versions.v1_2_1.added.easyLanguageDef")}</li>
                                            <li>{t("versions.v1_2_1.added.plainLanguageDef")}</li>
                                            <li dangerouslySetInnerHTML={{ __html: t("versions.v1_2_1.added.modelRecommendation") }}></li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_2_1.fixed.serviceNowRedirect")}</li>
                                    <li>{t("versions.v1_2_1.fixed.performance")}</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="9">
                        <AccordionHeader>{t("versions.v1_2_0.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_2_0.fixed.codeDisplay")}</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="8">
                        <AccordionHeader>{t("versions.v1_1_4.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_1_4.fixed.versionNumber")}</li>
                                    <li>{t("versions.v1_1_4.fixed.tokenSplit")}</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="7">
                        <AccordionHeader>{t("versions.v1_1_3.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        {t("versions.v1_1_3.added.modelSelection")}
                                        <ul>
                                            <li>GPT-4o-mini</li>
                                            <li>GPT-4o</li>
                                            <li>Mistral-Large-2407</li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_1_3.changed.defaultModel")}</li>
                                    <li>
                                        {t("versions.v1_1_3.changed.summarizeTitle")}
                                        <ul>
                                            <li>{t("versions.v1_1_3.changed.fewerErrors")}</li>
                                            <li>{t("versions.v1_1_3.changed.reliableSummaries")}</li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="6">
                        <AccordionHeader>{t("versions.v1_1_2.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        {t("versions.v1_1_2.added.chatHistory")}
                                        <p>
                                            <img width="70%" src={history}></img>
                                        </p>
                                        <ul>
                                            <li>{t("versions.v1_1_2.added.autoSave")}</li>
                                            <li>{t("versions.v1_1_2.added.management")}</li>
                                            <li>{t("versions.v1_1_2.added.favorites")}</li>
                                            <li>{t("versions.v1_1_2.added.sorting")}</li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="5">
                        <AccordionHeader>{t("versions.v1_1_1.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>{t("versions.v1_1_1.added.errorHint")}</li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_1_1.fixed.systempromptHelp")}</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_1_1.changed.arielleDescription")}</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="1">
                        <AccordionHeader>{t("versions.v1_1_0.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        {t("versions.v1_1_0.added.chatSummarizeBrainstormTitle")}
                                        <ul>
                                            <li>
                                                {t("versions.v1_1_0.added.recallMessages")}
                                                <p>
                                                    <img width="70%" src={zurückziehen}></img>
                                                </p>
                                            </li>
                                            <li>{t("versions.v1_1_0.added.browserCache")}</li>
                                        </ul>
                                    </li>
                                    <li>{t("versions.v1_1_0.added.updateHistory")}</li>
                                    <li>
                                        {t("versions.v1_1_0.added.chatTitle")}
                                        <ul>
                                            <li>
                                                <div dangerouslySetInnerHTML={{ __html: t("versions.v1_1_0.added.suggestedResponses") }}></div>
                                                <p>
                                                    <img width="80%" src={vorgeschlageneAntworten}></img>
                                                </p>
                                            </li>
                                            <li dangerouslySetInnerHTML={{ __html: t("versions.v1_1_0.added.mermaidDiagrams") }}></li>
                                            <li>{t("versions.v1_1_0.added.arielle")}</li>
                                            <li>{t("versions.v1_1_0.added.systempromptSpace")}</li>
                                            <li>{t("versions.v1_1_0.added.systempromptWarning")}</li>
                                            <li>{t("versions.v1_1_0.added.temperatureDescription")}</li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_1_0.fixed.systempromptToken")}</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="2">
                        <AccordionHeader>{t("versions.v1_0_0.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>{t("versions.v1_0_0.added.production")}</li>
                                    <li>{t("versions.v1_0_0.added.faq")}</li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_0_0.fixed.streamingErrors")}</li>
                                    <li>{t("versions.v1_0_0.fixed.typos")}</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>{t("versions.v1_0_0.changed.termsDaily")}</li>
                                    <li>{t("versions.v1_0_0.changed.termsUpdated")}</li>
                                    <li>{t("versions.v1_0_0.changed.servicedesk")}</li>
                                    <li>{t("versions.v1_0_0.changed.wilmaLink")}</li>
                                </ul>
                                <li>{t("versions.v1_0_0.added.communityExamples")}</li>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="3">
                        <AccordionHeader>{t("versions.v0_3_0.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>{t("versions.v0_3_0.added.settingsSaved")}</li>
                                    <li>
                                        {t("versions.v0_3_0.added.accessibilityTitle")}
                                        <ul>
                                            <li>{t("versions.v0_3_0.added.screenreader")}</li>
                                            <li>{t("versions.v0_3_0.added.colorblind")}</li>
                                            <li>{t("versions.v0_3_0.added.highContrast")}</li>
                                            <li>{t("versions.v0_3_0.added.moreOptimizations")}</li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>{t("versions.v0_3_0.fixed.inlineCode")}</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>
                                        {t("versions.v0_3_0.changed.brainstormTitle")}
                                        <ul>
                                            <li>{t("versions.v0_3_0.changed.mindmapDownload")}</li>
                                        </ul>
                                    </li>
                                    <li>
                                        {t("versions.v0_3_0.changed.summarizeTitle")}
                                        <ul>
                                            <li>{t("versions.v0_3_0.changed.summaryLength")}</li>
                                            <li>{t("versions.v0_3_0.changed.detailLevel")}</li>
                                        </ul>
                                    </li>
                                    <li>{t("versions.v0_3_0.changed.designUnified")}</li>
                                    <li>{t("versions.v0_3_0.changed.darkMode")}</li>
                                    <li>{t("versions.v0_3_0.changed.termsUpdated")}</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="4">
                        <AccordionHeader>{t("versions.v0_2_0.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                {t("versions.v0_2_0.subtitle")}
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        {t("versions.v0_2_0.added.markdownTitle")}
                                        <ul>
                                            <li>{t("versions.v0_2_0.added.codeLanguage")}</li>
                                            <li>{t("versions.v0_2_0.added.lineNumbers")}</li>
                                        </ul>
                                    </li>
                                    <li>
                                        {t("versions.v0_2_0.added.summarizeTitle")}
                                        <ul>
                                            <li>{t("versions.v0_2_0.added.copySummary")}</li>
                                            <li>{t("versions.v0_2_0.added.noTokenLimit")}</li>
                                            <li>{t("versions.v0_2_0.added.pdfUpload")}</li>
                                        </ul>
                                    </li>
                                    <li>
                                        {t("versions.v0_2_0.added.chatTitle")}
                                        <ul>
                                            <li>{t("versions.v0_2_0.added.unformattedView")}</li>
                                            <li>
                                                {t("versions.v0_2_0.added.moreSettingsTitle")}
                                                <ul>
                                                    <li>{t("versions.v0_2_0.added.temperature")}</li>
                                                    <li>{t("versions.v0_2_0.added.maxLength")}</li>
                                                    <li>{t("versions.v0_2_0.added.systemprompt")}</li>
                                                </ul>
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>{t("versions.v0_2_0.fixed.textFieldGrowth")}</li>
                                    <li>{t("versions.v0_2_0.fixed.htmlEntities")}</li>
                                    <li>{t("versions.v0_2_0.fixed.codeBlockWrapping")}</li>
                                    <li>{t("versions.v0_2_0.fixed.authExpiration")}</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
};

export default Version;
