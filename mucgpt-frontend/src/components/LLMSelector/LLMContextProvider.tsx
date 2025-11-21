// Context.js
import React, { Dispatch, SetStateAction, useState } from "react";
import { Model } from "../../api";
import { DEFAULT_MAX_OUTPUT_TOKENS } from "../../constants";

interface ILLMProvider {
    LLM: Model;
    setLLM: Dispatch<SetStateAction<Model>>;
    availableLLMs: Model[];
    setAvailableLLMs: Dispatch<SetStateAction<Model[]>>;
}

export const DEFAULTLLM = "gpt-4o-mini";
export const LLMContext = React.createContext<ILLMProvider>({
    LLM: { llm_name: DEFAULTLLM, max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS, max_input_tokens: 0, description: "" },
    setLLM: () => {},
    availableLLMs: [],
    setAvailableLLMs: () => {}
});

export const LLMContextProvider = (props: React.PropsWithChildren<unknown>) => {
    const [LLM, setLLM] = useState<Model>({
        llm_name: DEFAULTLLM,
        max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
        max_input_tokens: 0,
        description: ""
    });
    const [availableLLMs, setAvailableLLMs] = useState<Model[]>([]);

    return <LLMContext.Provider value={{ LLM, setLLM, availableLLMs, setAvailableLLMs }}>{props.children}</LLMContext.Provider>;
};
