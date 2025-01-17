import { useRef, useState, useEffect, useContext } from "react";

import { AskResponse, simplyApi, SimplyRequest, SimplyResponse } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { ExampleListSimply } from "../../components/Example/ExampleListSimply";
import { useTranslation } from "react-i18next";
import { ChatStorageService } from "../../service/storage";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { SimplySidebar } from "../../components/SimplySidebar/SimplySidebar";

const enum STORAGE_KEYS {
    SIMPLY_SYSTEM_PROMPT = "SIMPLY_SYSTEM_PROMPT",
    SIMPLY_OUTPUT_TYPE = "SIMPLY_OUTPUT_TYPE"
}

const Simply = () => {
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const outputType_pref = localStorage.getItem(STORAGE_KEYS.SIMPLY_OUTPUT_TYPE) || "plain";
    const [outputType, setOutputType] = useState<string>(outputType_pref);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);
    const [question, setQuestion] = useState<string>("");

    const storageService: ChatStorageService = new ChatStorageService({ db_name: "MUCGPT-SIMPLY", objectStore_name: "simply", db_version: 2 });

    const [currentId, setCurrentId] = useState<number>(0);
    const [idCounter, setIdCounter] = useState<number>(0);

    useEffect(() => {
        error && setError(undefined);
        setIsLoading(true);
        storageService.checkStructurOfDB();
        storageService.getHighestKeyInDB().then(highestKey => {
            setIdCounter(highestKey + 1);
            setCurrentId(highestKey);
        });
        storageService.getStartDataFromDB(currentId).then(stored => {
            if (stored) {
                setAnswers([...answers.concat(stored.Data.Answers)]);
                lastQuestionRef.current = stored.Data.Answers[stored.Data.Answers.length - 1][0];
            }
        });
        setIsLoading(false);
    }, []);

    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };

    const makeApiRequest = async (question: string) => {
        error && setError(undefined);
        lastQuestionRef.current = question;
        setIsLoading(true);
        try {
            const request: SimplyRequest = {
                topic: question,
                model: LLM.llm_name,
                temperature: 0,
                output_type: outputType
            };
            const parsedResponse: SimplyResponse = await simplyApi(request);
            const askResponse: AskResponse = { answer: parsedResponse.content, error: parsedResponse.error };
            setAnswers([...answers, [question, askResponse]]);
            storageService.saveToDB([question, askResponse], currentId, idCounter, setCurrentId, setIdCounter, language);
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
        storageService.deleteChatFromDB(currentId, setAnswers, true, lastQuestionRef);
    };

    const onDeleteMessage = (message: string) => {
        return async () => {
            let last;
            while (answers.length) {
                await storageService.popLastMessageInDB(currentId);
                last = answers.pop();
                setAnswers(answers);
                if (last && last[0] == message) {
                    break;
                }
            }
            if (answers.length == 0) {
                storageService.deleteChatFromDB(currentId, setAnswers, true, lastQuestionRef);
                storageService.deleteChatFromDB(0, setAnswers, false, lastQuestionRef);
            }
            if (last)
                lastQuestionRef.current = last[0];
            setQuestion(message);
        }
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const onOutputTypeChanged = (newValue: string) => {
        setOutputType(newValue);
        localStorage.setItem(STORAGE_KEYS.SIMPLY_OUTPUT_TYPE, newValue);
    };

    const sidebar_actions = <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />;
    const sidebar_content = <SimplySidebar onOutputTypeChanged={onOutputTypeChanged} outputType={outputType} />;
    const sidebar = <Sidebar actions={sidebar_actions} content={sidebar_content}></Sidebar>;

    const examplesComponent = <ExampleListSimply onExampleClicked={onExampleClicked} />;
    const inputComponent = (
        <QuestionInput
            clearOnSend
            placeholder={t("simply.prompt")}
            disabled={isLoading}
            onSend={question => makeApiRequest(question)}
            tokens_used={0}
            question={question}
            setQuestion={question => setQuestion(question)}
        />
    );
    const answerList = (
        <>
            {answers.map((answer, index) => (
                <ChatTurnComponent
                    key={index}
                    usermsg={
                        <UserChatMessage
                            message={answer[0]}
                            onDeleteMessage={onDeleteMessage(answer[0])}
                        />
                    }
                    usermsglabel={t("components.usericon.label") + " " + (index + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (index + 1).toString()}
                    botmsg={<Answer key={index} answer={answer[1]} setQuestion={question => setQuestion(question)} />}
                ></ChatTurnComponent>
            ))}
            {isLoading || error ? (
                <ChatTurnComponent
                    usermsg={
                        <UserChatMessage
                            message={lastQuestionRef.current}
                            onDeleteMessage={onDeleteMessage(lastQuestionRef.current)}
                        />
                    }
                    usermsglabel={t("components.usericon.label") + " " + (answers.length + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (answers.length + 1).toString()}
                    botmsg={
                        <>
                            {isLoading && <AnswerLoading text={outputType === "plain" ? t("simply.answer_loading_plain") : t("simply.answer_loading_easy")} />}
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
    return (
        <ChatLayout
            sidebar={sidebar}
            examples={examplesComponent}
            answers={answerList}
            input={inputComponent}
            showExamples={!lastQuestionRef.current}
            header={t("chat.header")}
            header_as_markdown={false}
            messages_description={t("common.messages")}
            size="small"
        ></ChatLayout>
    );
};

export default Simply;
