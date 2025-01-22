import { useRef, useState, useEffect, useContext } from "react";

import { AskResponse, simplyApi, SimplyRequest, SimplyResponse } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { ExampleListSimply } from "../../components/Example/ExampleListSimply";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { SimplySidebar } from "../../components/SimplySidebar/SimplySidebar";
import { SIMPLY_STORE } from "../../constants";
import { DBMessage, StorageService } from "../../service/storage";

const enum STORAGE_KEYS {
    SIMPLY_SYSTEM_PROMPT = "SIMPLY_SYSTEM_PROMPT",
    SIMPLY_OUTPUT_TYPE = "SIMPLY_OUTPUT_TYPE"
}

type SimplyMessage = DBMessage<AskResponse>;

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

    const [answers, setAnswers] = useState<SimplyMessage[]>([]);
    const [question, setQuestion] = useState<string>("");

    const [currentId, setCurrentId] = useState<string | undefined>(undefined);

    const storageService: StorageService<AskResponse, {}> = new StorageService<AskResponse, {}>(SIMPLY_STORE);



    useEffect(() => {
        error && setError(undefined);
        setIsLoading(true);
        storageService.setup();
        storageService.getNewestChat().then(existingData => {
            if (existingData) {
                const messages = existingData.messages;
                setAnswers([...answers.concat(messages)]);
                lastQuestionRef.current = messages.length > 0 ? messages[messages.length - 1].user : "";
                setCurrentId(existingData.id);
            }
        }).finally(() => {
            setIsLoading(false);
        });
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
            const completeAnswer: SimplyMessage = { user: question, response: askResponse };

            setAnswers([...answers, completeAnswer]);
            if (currentId)
                await storageService.appendMessage(currentId, completeAnswer);
            else {
                const id = await storageService.create([completeAnswer], undefined);
                if (id)
                    setCurrentId(id);
                else
                    throw new Error("Could not create new ID in DB");
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
        if (currentId)
            storageService.delete(currentId);
        setAnswers([]);
        currentId && setCurrentId(undefined);
    };


    const onRollbackMessage = (message: string) => {
        return async () => {
            if (currentId) {
                let result = await storageService.rollbackMessage(currentId, message);
                if (result) {
                    setAnswers(result.messages);
                    lastQuestionRef.current = result.messages.length > 0 ? result.messages[result.messages.length - 1].user : "";
                }
                setQuestion(message);
            }
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
                            message={answer.user}
                            onRollbackMessage={onRollbackMessage(answer.user)}
                        />
                    }
                    usermsglabel={t("components.usericon.label") + " " + (index + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (index + 1).toString()}
                    botmsg={<Answer key={index} answer={answer.response} setQuestion={question => setQuestion(question)} />}
                ></ChatTurnComponent>
            ))}
            {isLoading || error ? (
                <ChatTurnComponent
                    usermsg={
                        <UserChatMessage
                            message={lastQuestionRef.current}
                            onRollbackMessage={onRollbackMessage(lastQuestionRef.current)}
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
