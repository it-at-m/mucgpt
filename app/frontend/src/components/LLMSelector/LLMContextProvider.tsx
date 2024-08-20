// Context.js
import React, { Dispatch, SetStateAction, useState } from "react";

interface ILLMProvider {
    LLM: string;
    setLLM: Dispatch<SetStateAction<string>>;
}

export const DEFAULTLLM = "GPT-4o-mini";
export const LLMContext = React.createContext<ILLMProvider>({ LLM: DEFAULTLLM, setLLM: () => { } });

export const LLMContextProvider = (props: React.PropsWithChildren<{}>) => {
    const [LLM, setLLM] = useState<string>(DEFAULTLLM);

    return (
        <LLMContext.Provider value={{ LLM, setLLM }}>
            {props.children}
        </LLMContext.Provider>
    );
};