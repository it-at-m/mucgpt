import { useRef, useState, useEffect, useContext } from "react";
import {SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";

import styles from "./Summarize.module.css";

import { Approaches, AskResponse, sumApi, SumRequest } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { ExampleListSum } from "../../components/Example/ExampleListSum";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { RoleSelector } from "../../components/RoleSelector";
import { SummarizationLengthSelector } from "../../components/SummarizationLengthSelector";
import { useTranslation } from 'react-i18next';

const Summarize = () => {
    const {language} = useContext(LanguageContext)
    const { t} = useTranslation ();

    const [useSuggestFollowupQuestions, setUseSuggestFollowupQuestions] = useState<boolean>(false);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);

    const DEFAULT_ROLE = "Second-Grader";
    const [role, setRole] = useState<string>(DEFAULT_ROLE);
    const onRoleChanged = (e: SelectionEvents, selection: OptionOnSelectData) => {
        setRole(selection.optionValue || DEFAULT_ROLE );
    };

    const DEFAULT_LENGTH = "in a maximum of 5 bullet points";
    const [textLength, setTextLength] = useState<string>(DEFAULT_LENGTH);
    const onTextLengthChanged = (e: SelectionEvents, selection: OptionOnSelectData) => {
        setTextLength(selection.optionValue || DEFAULT_LENGTH );
    };

    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };


    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        try {
            const request: SumRequest = {
                text: question,
                approach: Approaches.Summarize,
                overrides: {
                    language: language,
                    person_type: role,
                    sumlength: textLength
                }
            };
            const result = await sumApi(request);
            setAnswers([...answers, [question, result]]);
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        setAnswers([]);
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);


    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {!lastQuestionRef.current ? (
                        <div className={styles.chatEmptyState}>
                            <h2 className={styles.chatEmptyStateSubtitle}> {t('sum.header')}</h2>
                            <ExampleListSum onExampleClicked={onExampleClicked} />
                        </div>
                    ) : (
                        <div className={styles.chatMessageStream}>
                            {answers.map((answer, index) => (
                                <div key={index}>
                                    <UserChatMessage message={answer[0]} />
                                    <div className={styles.chatMessageGpt}>
                                        <Answer
                                            key={index}
                                            answer={answer[1]}
                                            isSelected={selectedAnswer === index }
                                            onCitationClicked={() => {}}
                                            onThoughtProcessClicked={() => {}}
                                            onSupportingContentClicked={() => {}}
                                            onFollowupQuestionClicked={q => makeApiRequest(q)}
                                            showFollowupQuestions={useSuggestFollowupQuestions && answers.length - 1 === index}
                                        />
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <>
                                    <UserChatMessage message={lastQuestionRef.current} />
                                    <div className={styles.chatMessageGptMinWidth}>
                                        <AnswerLoading />
                                    </div>
                                </>
                            )}
                            {error ? (
                                <>
                                    <UserChatMessage message={lastQuestionRef.current} />
                                    <div className={styles.chatMessageGptMinWidth}>
                                        <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
                                    </div>
                                </>
                            ) : null}
                            <div ref={chatMessageStreamEnd} />
                        </div>
                    )}

                    <div className={styles.chatInput}>
                        <QuestionInput
                            clearOnSend
                            placeholder={t('sum.prompt')}
                            disabled={isLoading}
                            onSend={question => makeApiRequest(question)}
                        />
                    </div>
                </div>
                <div className={styles.settingsContainer}>
                    <div className={styles.label}> 
                        <label>{t('sum.rolelabel')}</label>
                    </div>
                    <div className={styles.chatSettingsSeparator}> 
                        <RoleSelector onSelectionChange={onRoleChanged} defaultRole={t('components.roles.secondgrader')}></RoleSelector>
                    </div>
                    <div className={styles.label}> 
                        <label>{t('sum.lengthlabel')} </label>
                    </div>
                    <div className={styles.chatSettingsSeparator}> 
                        <SummarizationLengthSelector onSelectionChange={onTextLengthChanged} defaultLength={"Fünf Stichpunkten"}></SummarizationLengthSelector>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Summarize;
