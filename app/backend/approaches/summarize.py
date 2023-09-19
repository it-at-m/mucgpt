from typing import Any, Sequence
from langchain import LLMChain

import openai
from langchain.chat_models import AzureChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import SequentialChain

from approaches.approach import Approach

class Summarize(Approach):
    user_sum_prompt = """
    Summarize the following text for a {person_type}.
    The summary should be written {sumlength}, expressing the key points and concepts written in the original text without adding your interpretations. 

    Text: {text}"""

    user_translate_prompt = """
    Übersetze den folgenden Text in {language}. Beinhalte die Formatierung bei.

    Text: {sum}"""


    def __init__(self, chatgpt_deployment: str, chatgpt_model: str):
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model

    def getSummarizationPrompt(self) -> PromptTemplate:
        return PromptTemplate(input_variables=["person_type", "sumlength", "text"], template=self.user_sum_prompt)

    def getTranslationPrompt(self) -> PromptTemplate: 
        return PromptTemplate(input_variables=["language", "sum"], template=self.user_translate_prompt)


    async def run(self, text: str, overrides: "dict[str, Any]") -> Any:
        person_type = overrides.get("person_type")
        language = overrides.get("language")
        sumlength = overrides.get("sumlength")

        verbose = True
        llm = AzureChatOpenAI(
            model="gpt-35-turbo",
            temperature= overrides.get("temperature") or 0.7,
            max_tokens=1024,
            n=1,
            deployment_name= "chat",
            openai_api_key=openai.api_key,
            openai_api_base=openai.api_base,
            openai_api_version=openai.api_version,
            openai_api_type=openai.api_type
        )
        summarizationChain = LLMChain(llm=llm, prompt=self.getSummarizationPrompt(), output_key="sum", verbose=verbose)
        translationChain = LLMChain(llm=llm, prompt=self.getTranslationPrompt(), output_key="translation", verbose=verbose)
        overall_chain = SequentialChain(
            chains=[summarizationChain, translationChain], 
            input_variables=["language", "person_type", "sumlength", "text"],
            output_variables=["translation", "sum"],
            verbose=verbose)

        result =  await overall_chain.acall({"text": text, "language": str(language).lower(), "sumlength": sumlength, "person_type": person_type})
        chat_translate_result = result['translation']     

        return {"data_points": [], "answer": chat_translate_result, "thoughts": f"Searched for:<br>{text}<br><br>Conversations:<br>"} #+ msg_to_display.replace('\n', '<br>')}
    
