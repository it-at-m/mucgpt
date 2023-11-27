from typing import Any

import openai
from langchain.chat_models import AzureChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import SequentialChain, LLMChain
from langchain.callbacks import get_openai_callback
from core.datahelper import Repository
from core.types.Config import ApproachConfig
from core.datahelper import Requestinfo

from approaches.approach import Approach
import json
import re

class Summarize(Approach):
    """Chain of Density prompting: https://arxiv.org/abs/2309.04269"""

    user_sum_prompt = """
    Article: {text}
    You will generate increasingly concise entity-dense summaries of the above article. Repeat the following 2 steps 5 times.

    Step 1: Identify 1-3 informative entities (delimited) from the article which are missing from the previously generated summary.
    Step 2: Write a new denser summary of identical length which covers every entity and detail from the previous summary plus the missing entities.

    A missing entity is
    - Relevant: to the main stories.
    - Specific: descriptive yet concise (5 words or fewer).
    - Novel: not in the previous summary.
    - Faithful: present in the article.
    - Anywhere: located in the article.

    Guidelines:
    - The first summary should be long (4-5 sentences, ~80 words), yet highly non-specific, containing little information beyond the entities marked as missing. Use overly verbose language and fillers (e.g., "this article discusses") to reach ~80 words.
    - Make every word count. Rewrite the previous summary to improve flow and make space for additional entities.
    - Make space with fusion, compression, and removal of uninformative phrases like "the article discusses".
    - The summaries should become highly dense and concise, yet self-contained, e.g., easily understood without the article.
    - Missing entities can appear anywhere in the new summary.
    - Never drop entities from the previous summary. If space cannot be made, add fewer new entities.

    Remember: Use the exact same number of words for each summary.

    Do not include any explanations. Only return a valid valid RFC8259 compilant JSON.
    The JSON should be an array of length 5 following this format:
    {{
    "data": [
    {{
        "missing_entities": "An array of missing entitys"
        "denser_summary": "denser summary, covers every entity in detail"
    }}
    ]
    }}
    The response in JSON format:
    """

    user_translate_prompt = """
    Übersetze das folgende JSON in {language}. Beinhalte die Formatierung als RFC8259 JSON bei.
    Das JSON sollte ein Array der Länge 5 sein, welcher folgendem Format folgt:
    {{
    "data": [
    {{
        "missing_entities": "An array of missing entitys"
        "denser_summary": "denser summary, covers every entity in detail"
    }}
    ]
    }}

    JSON: {sum}
    """


    def __init__(self, chatgpt_deployment: str, chatgpt_model: str, config: ApproachConfig, repo: Repository):
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model
        
        self.config = config
        self.repo = repo

    def getSummarizationPrompt(self) -> PromptTemplate:
        return PromptTemplate(input_variables=["text"], template=self.user_sum_prompt)

    def getTranslationPrompt(self) -> PromptTemplate: 
        return PromptTemplate(input_variables=["language", "sum"], template=self.user_translate_prompt)


    async def run_internal(self, text: str, overrides: "dict[str, Any]", department: str) -> str:
        language = overrides.get("language")
        llm = AzureChatOpenAI(
            model=self.chatgpt_model,
            temperature= overrides.get("temperature") or 0.7,
            max_tokens=1000,
            n=1,
            deployment_name= "chat",
            openai_api_key=openai.api_key,
            openai_api_base=openai.api_base,
            openai_api_version=openai.api_version,
            openai_api_type=openai.api_type
        )
        summarizationChain = LLMChain(llm=llm, prompt=self.getSummarizationPrompt(), output_key="sum")
        translationChain = LLMChain(llm=llm, prompt=self.getTranslationPrompt(), output_key="translation")
        overall_chain = SequentialChain(
            chains=[summarizationChain, translationChain], 
            input_variables=["language", "text"],
            output_variables=["translation", "sum"])

        with get_openai_callback() as cb:
            result =  await overall_chain.acall({"text": text, "language": str(language).lower()})
        total_tokens = cb.total_tokens
        if self.config["log_tokens"]:
            self.repo.addInfo(Requestinfo( 
                tokencount = total_tokens,
                department = department,
                messagecount=  1,
                method = "Sum"))

        # array with {missing_entities: str[], denser_summary: str }
        chat_translate_result= result["translation"][result["translation"].index("{"):]
        chat_translate_result = chat_translate_result.replace("\n", "").rstrip()
        chat_translate_result = self.removeQuotations(chat_translate_result)
        if not chat_translate_result.endswith("}"):
            chat_translate_result  = chat_translate_result + "\"}]}"

        return chat_translate_result

    def removeQuotations(self,st):
        # finds all denser summarys, replaces quotation inside with &quot
        m = re.finditer(r'(?<=\"denser_summary\":)(.*?)(?=\})', st)

        new_string = ""
        idx = 0

        for i in list(m):
            ss, se = i.span(1)  # first and last index
            groups = i.group()  # complete string ins
            quotations = [m.start() for m in re.finditer('"', groups)]
            # Quotation inside dense summary?
            if(len(quotations)>2):
                new_string += st[idx:ss+quotations[1]]
                idx = ss+quotations[1]+1
                for quotindex in quotations[1:-1]:
                    new_string += st[idx:ss+quotindex] + "“ "
                    idx = ss+quotindex+1
                new_string += st[idx:se]
                idx = quotations[-1]+1
            else:
                new_string += st[idx:ss] +  groups
            idx = se
        new_string += st[idx:]
        return new_string

    async def run(self, text: str, overrides: "dict[str, Any]", department: str) -> Any:
        chat_translate_result = await self.run_internal(text, overrides, department)
        try:
            jsoned = json.loads(chat_translate_result)
        except Exception:
            # try again
            try: 
               chat_translate_result = await self.run_internal(text, overrides, department)   
               jsoned = json.loads(chat_translate_result)  
            except Exception:
                jsoned = { }
                jsoned['data'] = [{'missing_entities': 'Fehler','denser_summary': 'Zusammenfassung konnte nicht generiert werden. Bitte nochmals versuchen.'}]

        # sometimes, missing_entities is just str, convert to array.
        cleaned = []
        for (i, element) in enumerate(jsoned['data']):
            missing = element['missing_entities']
            if(isinstance(missing, str)):
                element['missing_entities'] = [missing]
            cleaned.append(element)
        
        return {"answer": cleaned}
    
