from typing import Any, Sequence
from langchain import LLMChain

import openai
from langchain.chat_models import AzureChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import SequentialChain
from core.datahelper import Repository
from core.types.Config import ApproachConfig

from approaches.approach import Approach
import json

class Summarize(Approach):
    """Chain of Density Prompting: https://arxiv.org/abs/2309.04269"""

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
    Answer in JSON. The JSON should be a list (length 5) of dictionaries whose keys are "missing_entities" and "denser_summary".
    """

    user_translate_prompt = """
    Text: {sum}

    Übersetze den Text in {language}. Beinhalte die Formatierung als JSON bei.
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


    async def run(self, text: str, overrides: "dict[str, Any]") -> Any:
        language = overrides.get("language")

        llm = AzureChatOpenAI(
            model=self.chatgpt_model,
            temperature= overrides.get("temperature") or 0.7,
            max_tokens=4096,
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

        result =  await overall_chain.acall({"text": text, "language": str(language).lower()})
        # array with {missing_entities: str[], denser_summary: str }
        chat_translate_result = result['translation'].replace("\n", "")   
        # sometimes, missing_entities is just str, convert to array.
        cleaned = []
        for (i, element) in enumerate(json.loads(chat_translate_result)):
            print(element)
            missing = element['missing_entities']
            if(isinstance(missing, str)):
                element['missing_entities'] = [missing]
            cleaned.append(element)

        return {"answer": cleaned}
    
