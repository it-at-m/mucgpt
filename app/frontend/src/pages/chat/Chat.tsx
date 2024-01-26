import { useRef, useState, useEffect, useContext } from "react";
import readNDJSONStream from "ndjson-readablestream";

import styles from "./Chat.module.css";

import { chatApi, AskResponse, ChatRequest, ChatTurn, handleRedirect } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList } from "../../components/Example";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from 'react-i18next';
import { ChatsettingsDrawer } from "../../components/ChatsettingsDrawer";

const Chat = () => {

    const { language } = useContext(LanguageContext)
    const { t } = useTranslation();
    const [shouldStream, setShouldStream] = useState<boolean>(true);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: AskResponse, user_tokens: number][]>([]);

    const [temperature, setTemperature] = useState(0.7);
    const [max_tokens, setMaxTokens] = useState(4000);
    const [systemPrompt, setSystemPrompt] = useState<string>("");

    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        try {
            const history: ChatTurn[] = answers.map(a => ({ user: a[0], bot: a[1].answer }));
            const request: ChatRequest = {
                history: [...history, { user: question, bot: undefined }],
                shouldStream: shouldStream,
                overrides: {
                    language: language,
                    temperature: temperature,
                    system_message: systemPrompt,
                    max_tokens: max_tokens
                }
            };

            const response = await chatApi(request);
            handleRedirect(response);

            if (!response.body) {
                throw Error("No response body");
            }
            if (shouldStream) {
                let answer: string = '';
                let askResponse: AskResponse = {} as AskResponse;
                let streamed_tokens = 0;
                let user_tokens = 0;
                for await (const event of readNDJSONStream(response.body)) {
                    if (event) {
                        let parsed = String(event)
                        if (parsed.startsWith("<<<<STREAMEDTOKENS>>>>")) {
                            streamed_tokens = Number(parsed.split("<<<<STREAMEDTOKENS>>>>")[1])
                        }
                        else if (parsed.startsWith("<<<<REQUESTTOKENS>>>>")) {
                            user_tokens = Number(parsed.split("<<<<REQUESTTOKENS>>>>")[1])
                        }
                        else
                            answer += parsed;
                        let latestResponse: AskResponse = { ...askResponse, answer: answer, tokens: streamed_tokens };
                        setIsLoading(false);
                        setAnswers([...answers, [question, latestResponse, user_tokens]]);
                    }
                }
            } else {
                const parsedResponse: AskResponse = await response.json();
                if (response.status > 299 || !response.ok) {
                    throw Error(parsedResponse.error || "Unknown error");
                }
                setAnswers([...answers, [question, parsedResponse, 0]]);
            }
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        setAnswers([]);
    };

    const onRegeneratResponseClicked = () => {
        if (answers.length > 0) {
            let last = answers.pop();
            setAnswers(answers);
            if (last)
                makeApiRequest(last[0])
        }
    }
    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const computeTokens = () => { return answers.map((answ) => answ[2] + (answ[1].tokens || 0)).reduceRight((prev, curr) => prev + curr, 0) }

    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };

    const onShowCitation = (citation: string, index: number) => {
        if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveCitation(citation);
            setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
        }

        setSelectedAnswer(index);
    };

    const onToggleTab = (tab: AnalysisPanelTabs, index: number) => {
        if (activeAnalysisPanelTab === tab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(tab);
        }

        setSelectedAnswer(index);
    };

    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
                <ChatsettingsDrawer
                    temperature={temperature}
                    setTemperature={setTemperature}
                    max_tokens={max_tokens}
                    setMaxTokens={setMaxTokens}
                    systemPrompt={systemPrompt}
                    setSystemPrompt={setSystemPrompt}
                ></ChatsettingsDrawer>
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {!lastQuestionRef.current ? (
                        <div className={styles.chatEmptyState} tabIndex={0}>
                            <h2 className={styles.chatEmptyStateSubtitle}>{t('chat.header')}</h2>
                            <ExampleList onExampleClicked={onExampleClicked} />
                        </div>
                    ) : (
                        <ul className={styles.chatMessageStream} aria-description={t("common.messages")}>
                            {answers.map((answer, index) => (
                                <div key={index}>
                                    <li aria-description={t('components.usericon.label') + " " + (index + 1).toString()} >
                                        <UserChatMessage message={answer[0]} />
                                    </li>
                                    <li className={styles.chatMessageGpt} aria-description={t('components.answericon.label') + " " + (index + 1).toString()} >
                                        {index === answers.length - 1 && <Answer
                                            key={index}
                                            answer={answer[1]}
                                            isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                            onCitationClicked={c => onShowCitation(c, index)}
                                            onRegenerateResponseClicked={onRegeneratResponseClicked}
                                        />
                                        }
                                        {index !== answers.length - 1 && <Answer
                                            key={index}
                                            answer={answer[1]}
                                            isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                            onCitationClicked={c => onShowCitation(c, index)}
                                        />
                                        }
                                    </li>
                                </div>
                            ))}
                            {isLoading && (
                                <>
                                    <li aria-description={t('components.usericon.label') + " " + (answers.length + 1).toString()}>
                                        <UserChatMessage message={lastQuestionRef.current} />
                                    </li>
                                    <li className={styles.chatMessageGptMinWidth} aria-description={t('components.answericon.label') + " " + (answers.length + 1).toString()} >  answericon
                                        <AnswerLoading text={t('chat.answer_loading')} />
                                    </li>
                                </>
                            )}
                            {error ? (
                                <>
                                    <li aria-description={t('components.usericon.label') + " " + (answers.length + 1).toString()} >
                                        <UserChatMessage message={lastQuestionRef.current} />
                                    </li>
                                    <li className={styles.chatMessageGptMinWidth} aria-description={t('components.answericon.label') + " " + (answers.length + 1).toString()} >
                                        <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
                                    </li>
                                </>
                            ) : null}
                            <div ref={chatMessageStreamEnd} />
                        </ul>
                    )}

                    <div className={styles.chatInput}>
                        <QuestionInput
                            clearOnSend
                            placeholder={t('chat.prompt')}
                            disabled={isLoading}
                            onSend={question => makeApiRequest(question)}
                            tokens_used={computeTokens()}
                        />
                    </div>
                </div>

                {answers.length > 0 && activeAnalysisPanelTab && (
                    <AnalysisPanel
                        className={styles.chatAnalysisPanel}
                        activeCitation={activeCitation}
                        onActiveTabChanged={x => onToggleTab(x, selectedAnswer)}
                        citationHeight="810px"
                        answer={answers[selectedAnswer][1]}
                        activeTab={activeAnalysisPanelTab}
                    />
                )}
            </div>
        </div>
    );
};

export default Chat;
