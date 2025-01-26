import { MutableRefObject, Dispatch, SetStateAction } from "react";
import { StorageService } from "../service/storage";

export async function setupStore(
    error: unknown,
    setError: Dispatch<unknown>,
    setIsLoading: Dispatch<boolean>,
    storageService: StorageService<any, any>,
    setAnswers: Dispatch<SetStateAction<any[]>>,
    answers: any[],
    lastQuestionRef: MutableRefObject<string>,
    setActiveChat: Dispatch<SetStateAction<string | undefined>>
) {
    error && setError(undefined);
    setIsLoading(true);
    const existingData = await storageService.getNewestChat();
    if (existingData) {
        const messages = existingData.messages;
        setAnswers([...answers.concat(messages)]);
        lastQuestionRef.current = messages.length > 0 ? messages[messages.length - 1].user : "";
        setActiveChat(existingData.id);
    }
    setIsLoading(false);
}

export function handleDeleteChat(
    lastQuestionRef: MutableRefObject<string>,
    error: unknown,
    setError: Dispatch<unknown>,
    storageService: StorageService<any, any>,
    setAnswers: Dispatch<SetStateAction<any[]>>,
    setActiveChat: Dispatch<SetStateAction<string | undefined>>
) {
    return () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        storageService.delete();
        setAnswers([]);
        setActiveChat(undefined);
    };
}
export function handleRollback(
    storageService: StorageService<any, any>,
    setAnswers: Dispatch<SetStateAction<any[]>>,
    lastQuestionRef: MutableRefObject<string>,
    setQuestion: Dispatch<SetStateAction<string>>
) {
    return (message: string) => {
        return async () => {
            if (storageService.getActiveChatId()) {
                let result = await storageService.rollbackMessage(message);
                if (result) {
                    setAnswers(result.messages);
                    lastQuestionRef.current = result.messages.length > 0 ? result.messages[result.messages.length - 1].user : "";
                }
                setQuestion(message);
            }
        };
    };
}
