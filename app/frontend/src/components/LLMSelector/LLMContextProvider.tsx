// Context.js
import React, { Dispatch, SetStateAction, useState } from "react";
import { Model } from "../../api";

interface ILLMProvider {
    LLM: Model;
    setLLM: Dispatch<SetStateAction<Model>>;
}

export const DEFAULTLLM = "gpt-4o-mini";
export const LLMContext = React.createContext<ILLMProvider>({
    LLM: { llm_name: DEFAULTLLM, max_output_tokens: 0, max_input_tokens: 0, description: "" },
    setLLM: () => {}
});

export const LLMContextProvider = (props: React.PropsWithChildren<{}>) => {
    const [LLM, setLLM] = useState<Model>({ llm_name: DEFAULTLLM, max_output_tokens: 0, max_input_tokens: 0, description: "" });

    return <LLMContext.Provider value={{ LLM, setLLM }}>{props.children}</LLMContext.Provider>;
};
