from concurrent.futures import ThreadPoolExecutor
from typing import Any, List, Optional
import json
import re
from langchain.prompts import PromptTemplate
from langchain.chains import SequentialChain, LLMChain
from langchain_community.callbacks import get_openai_callback
from langchain_core.runnables.base import RunnableSerializable

from core.datahelper import Repository
from core.types.Config import ApproachConfig
from core.datahelper import Requestinfo
from core.textsplit import  splitPDF, splitText
from core.types.AzureChatGPTConfig import AzureChatGPTConfig
from core.types.LlmConfigs import LlmConfigs


class Summarize():
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

    user_translate_and_cleanup_prompt = """
    Übersetze den folgenden Text in {language}.

    Beachte folgende Regeln:
    - Vermeide allgemeine Phrasen wie "Das Dokument behandelt"
    - Füge Füllwörter ein, um ihn einfacher zu lesen machen.
    - Der Text sollte self-contained und einfach zu verstehen sein

    Text: {sum}
    """



    def __init__(self, llm: RunnableSerializable, config: ApproachConfig, model_info: AzureChatGPTConfig, repo: Repository, short_split = 2100, medium_split = 1500, long_split = 700):
        self.llm = llm
        self.config = config
        self.model_info = model_info
        self.repo = repo
        self.switcher =  {
            "short": short_split,
            "medium": medium_split,
            "long": long_split,
        }

    def getSummarizationPrompt(self) -> PromptTemplate:
        return PromptTemplate(input_variables=["text"], template=self.user_sum_prompt)

    def getTranslationPrompt(self) -> PromptTemplate: 
        return PromptTemplate(input_variables=["language", "sum"], template=self.user_translate_prompt)
    
    def getTranslationCleanupPrompt(self) -> PromptTemplate:
        return PromptTemplate(input_variables=["language", "sum"], template=self.user_translate_and_cleanup_prompt)


    def setup(self) -> SequentialChain:
        config: LlmConfigs = {
            "llm_api_key": self.model_info["openai_api_key"]
        }
        llm = self.llm.with_config(configurable=config)
        # setup model
        summarizationChain = LLMChain(llm=llm, prompt=self.getSummarizationPrompt(), output_key="sum")
        translationChain = LLMChain(llm=llm, prompt=self.getTranslationCleanupPrompt(), output_key="translation")

        return (summarizationChain, translationChain)
    
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
    
    def run_io_tasks_in_parallel(self, tasks):
        # execute tasks in parallel
        results = []
        with ThreadPoolExecutor() as executor:
            running_tasks = [executor.submit(task) for task in tasks]
            for running_task in running_tasks:
                results.append(running_task.result())
        return results

    
    def call_and_cleanup(self, text: str, summarizeChain: LLMChain):
        # calls summarization chain and cleans the data
        with get_openai_callback() as cb:
            result = summarizeChain.invoke({"text": text})
        total_tokens = cb.total_tokens
        chat_translate_result= result["sum"][result["sum"].index("{"):]
        chat_translate_result = chat_translate_result.replace("\n", "").rstrip()
        chat_translate_result = self.removeQuotations(chat_translate_result)
        if not chat_translate_result.endswith("}"):
            chat_translate_result  = chat_translate_result + "\"}]}"
        try:
            jsoned = json.loads(chat_translate_result)
        except Exception:
            # try again
            try: 
                (chat_translate_result, total_tokens) =  self.call_and_cleanup(text=text, summarizeChain=summarizeChain)   
                return (chat_translate_result, total_tokens)
            except Exception:
                total_tokens = 0
                jsoned = { }
                jsoned['data'] = [{'missing_entities': 'Fehler','denser_summary': 'Zusammenfassung konnte nicht generiert werden. Bitte nochmals versuchen.'}]

        cleaned = []
        for (i, element) in enumerate(jsoned['data']):
            missing = element['missing_entities']
            if(isinstance(missing, str)):
                element['missing_entities'] = [missing]
            cleaned.append(element)
        return (cleaned,total_tokens)



    async def run(self, splits: List[str],  language: str, department: Optional[str]) -> Any:
        #setup
        (summarizeChain, cleanupChain) = self.setup()
        # call chain
        total_tokens = 0
        summarys = []
        results  =  self.run_io_tasks_in_parallel(
             list(map(lambda chunk:  lambda: self.call_and_cleanup(text=chunk, summarizeChain=summarizeChain), splits)))

        for i in range(0,5):
            next_summary =   {"denser_summary": "", "missing_entities": []}
            for (result, tokens) in results:
                total_tokens += tokens
                next_summary["denser_summary"] += " "+ result[i]["denser_summary"]
                next_summary["missing_entities"] += result[i]["missing_entities"]
            summarys.append(next_summary)

        final_summarys = []
        for summary in summarys[-2:]:
            with get_openai_callback() as cb:
                result = cleanupChain.invoke({"language": language, "sum": summary['denser_summary']})        
            total_tokens = cb.total_tokens
            final_summarys.append(result['translation'])
        # save total tokens
        if self.config["log_tokens"]:
            self.repo.addInfo(Requestinfo( 
                tokencount = total_tokens,
                department = department,
                messagecount=  1,
                method = "Sum"))

        return {"answer": final_summarys}
    
    def split(self, detaillevel: str, file = None, text = None):
        splitsize = self.switcher.get(detaillevel, 700)

        #TODO Wenn Cleanup tokenlimit sprengt, was machen? In mehreren Schritten übersetzen.
        if(file is not None):
            splits = splitPDF(file, splitsize, 0)
        else:
            splits = splitText(text, splitsize, 0)
        return splits
    
