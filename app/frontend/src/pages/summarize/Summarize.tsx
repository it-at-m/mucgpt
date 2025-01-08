import { useRef, useState, useEffect, useContext } from "react";

import { sumApi, SumRequest, SumResponse } from "../../api";
import { AnswerError, AnswerLoading } from "../../components/Answer";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { ExampleListSum } from "../../components/Example/ExampleListSum";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import { SumAnswer } from "../../components/SumAnswer";
import { SumInput } from "../../components/SumInput";
import { Field, Radio, RadioGroup, RadioGroupOnChangeData } from "@fluentui/react-components";
import { checkStructurOfDB, deleteChatFromDB, getHighestKeyInDB, getStartDataFromDB, indexedDBStorage, saveToDB } from "../../service/storage";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";

const STORAGE_KEY_LEVEL_OF_DETAIL = "SUM_LEVEL_OF_DETAIL";

const Summarize = () => {
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const detaillevel_pref = (localStorage.getItem(STORAGE_KEY_LEVEL_OF_DETAIL) as "long" | "medium" | "short") || "short";

    const [detaillevel, setDetaillevel] = useState<"long" | "medium" | "short">(detaillevel_pref);

    const [answers, setAnswers] = useState<[user: string, response: SumResponse][]>([]);
    const [question, setQuestion] = useState<string>("");

    const storage: indexedDBStorage = { db_name: "MUCGPT-SUMMARIZE", objectStore_name: "summarize", db_version: 2 };
    const [currentId, setCurrentId] = useState<number>(0);
    const [idCounter, setIdCounter] = useState<number>(0);
    useEffect(() => {
        checkStructurOfDB(storage);
        getHighestKeyInDB(storage).then(highestKey => {
            setIdCounter(highestKey + 1);
            setCurrentId(highestKey);
        });
        error && setError(undefined);
        setIsLoading(true);
        getStartDataFromDB(storage, currentId).then(stored => {
            if (stored) {
                setAnswers([...answers.concat(stored.Data.Answers)]);
                lastQuestionRef.current = stored.Data.Answers[stored.Data.Answers.length - 1][0];
            }
        });
        setIsLoading(false);
    }, []);

    const onExampleClicked = (example: string) => {
        makeApiRequest(example, undefined);
    };

    const makeApiRequest = async (question: string, file?: File) => {
        let questionText = file ? file.name : question;
        lastQuestionRef.current = questionText;

        error && setError(undefined);
        setIsLoading(true);
        try {
            const request: SumRequest = {
                text: questionText,
                detaillevel: detaillevel,
                language: language,
                model: LLM.llm_name
            };
            const result = await sumApi(request, file);
            setAnswers([...answers, [questionText, result]]);
            saveToDB([questionText, result], storage, currentId, idCounter, setCurrentId, setIdCounter);
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
        deleteChatFromDB(storage, currentId, setAnswers, true, lastQuestionRef);
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const onDetaillevelChanged = (e: any, selection: RadioGroupOnChangeData) => {
        setDetaillevel(selection.value as "long" | "medium" | "short");
        localStorage.setItem(STORAGE_KEY_LEVEL_OF_DETAIL, selection.value);
    };

    const examplesComponent = <ExampleListSum onExampleClicked={onExampleClicked} />;
    const commands = [
        <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />,
        <Field label={t("sum.levelofdetail")}>
            <RadioGroup layout="vertical" onChange={onDetaillevelChanged} value={detaillevel_pref}>
                <Radio value="short" label={t("sum.short")} />
                <Radio value="medium" label={t("sum.medium")} />
                <Radio value="long" label={t("sum.long")} />
            </RadioGroup>
        </Field>
    ];
    const answerList = (
        <>
            {answers.map((answer, index) => (
                <ChatTurnComponent
                    key={index}
                    usermsg={
                        <UserChatMessage
                            message={answer[0]}
                            setAnswers={setAnswers}
                            setQuestion={setQuestion}
                            answers={answers}
                            storage={storage}
                            lastQuestionRef={lastQuestionRef}
                            current_id={currentId}
                            is_bot={false}
                        />
                    }
                    usermsglabel={t("components.usericon.label") + " " + (index + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (index + 1).toString()}
                    botmsg={<SumAnswer answer={answer[1]} top_n={2}></SumAnswer>}
                ></ChatTurnComponent>
            ))}
            {isLoading || error ? (
                <ChatTurnComponent
                    usermsg={
                        <UserChatMessage
                            message={lastQuestionRef.current}
                            setAnswers={setAnswers}
                            setQuestion={setQuestion}
                            answers={answers}
                            storage={storage}
                            lastQuestionRef={lastQuestionRef}
                            current_id={currentId}
                            is_bot={false}
                        />
                    }
                    usermsglabel={t("components.usericon.label") + " " + (answers.length + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (answers.length + 1).toString()}
                    botmsg={
                        <>
                            {isLoading && <AnswerLoading text={t("chat.answer_loading")} />}
                            {error ? <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} /> : null}
                        </>
                    }
                ></ChatTurnComponent>
            ) : (
                <div></div>
            )}
            <div ref={chatMessageStreamEnd} />
        </>
    );
    const inputComponent = (
        <SumInput
            clearOnSend
            placeholder={t("sum.prompt")}
            disabled={isLoading}
            onSend={(question, file) => makeApiRequest(question, file)}
            tokens_used={0}
            token_limit_tracking={false}
            question={question}
            setQuestion={setQuestion}
        />
    );
    return (
        <ChatLayout
            commands={commands}
            examples={examplesComponent}
            answers={answerList}
            input={inputComponent}
            showExamples={!lastQuestionRef.current}
            header={t("sum.header")}
            header_as_markdown={false}
            messages_description={t("common.messages")}
        ></ChatLayout>
    );
};

export default Summarize;
