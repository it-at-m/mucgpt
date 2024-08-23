// Context.js
import React, { Dispatch, SetStateAction, useState } from "react";
import { Model } from "../../api";

interface ILLMProvider {
    LLM: Model;
    setLLM: Dispatch<SetStateAction<Model>>;
}

export const DEFAULTLLM = "gpt-4o-mini";
export const LLMContext = React.createContext<ILLMProvider>({ LLM: { model_name: DEFAULTLLM, max_tokens: 0 }, setLLM: () => { } });

export const LLMContextProvider = (props: React.PropsWithChildren<{}>) => {
    const [LLM, setLLM] = useState<Model>({ model_name: DEFAULTLLM, max_tokens: 0 });

    return (
        <LLMContext.Provider value={{ LLM, setLLM }}>
            {props.children}
        </LLMContext.Provider>
    );
};