import json
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any, List, Optional, Tuple

from langchain.chains import LLMChain, SequentialChain
from langchain.prompts import PromptTemplate
from langchain_community.callbacks import get_openai_callback
from langchain_core.runnables.base import RunnableSerializable
from langchain_core.pydantic_v1 import BaseModel, Field
from langchain_core.prompts import PromptTemplate

from core.datahelper import Repository, Requestinfo
from core.textsplit import splitPDF, splitText
from core.types.Config import ApproachConfig
from core.types.LlmConfigs import LlmConfigs
from summarize.summarizeresult import SummarizeResult

class DenserSummary(BaseModel):
    missing_entities: List[str] = Field(description="An list of missing entitys")
    denser_summary: str = Field(description="denser summary, covers every entity in detail")

class Summarys(BaseModel):
    data: List[DenserSummary] = Field(description="An list of increasingly concise dense summaries")

class Summarize:
    """Summarizes text. Chunks long texts. Individual chunks where summarized with Chain of Density prompting: https://arxiv.org/abs/2309.04269. Afterwards the text is translated into the target language."""

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

    user_translate_and_cleanup_prompt = """
    Übersetze den folgenden Text in {language}.

    Beachte folgende Regeln:
    - Vermeide allgemeine Phrasen wie "Das Dokument behandelt"
    - Füge Füllwörter ein, um ihn einfacher zu lesen machen.
    - Der Text sollte self-contained und einfach zu verstehen sein

    Text: {sum}
    """



    def __init__(self, llm: RunnableSerializable, config: ApproachConfig, repo: Repository, short_split = 2100, medium_split = 1500, long_split = 700, use_last_n_summaries = -2):
        self.llm = llm
        self.config = config
        self.repo = repo
        self.switcher =  {
            "short": short_split,
            "medium": medium_split,
            "long": long_split,
        }
        # use only last 2 summaries, they have the best results
        self.use_last_n_summaries = use_last_n_summaries

    def getSummarizationPrompt(self) -> PromptTemplate:
        return PromptTemplate(input_variables=["text"], template=self.user_sum_prompt)
    
    def getTranslationCleanupPrompt(self) -> PromptTemplate:
        return PromptTemplate(input_variables=["language", "sum"], template=self.user_translate_and_cleanup_prompt)


    def setup(self) -> SequentialChain:
        config: LlmConfigs = {
        }
        llm = self.llm.with_config(configurable=config)

        summarizationChain = self.getSummarizationPrompt() | llm.with_structured_output(schema=Summarys)
        translationChain = self.getTranslationCleanupPrompt() | llm.with_structured_output(schema=Summarys)

        return (summarizationChain, translationChain)
    
    
    
    def run_io_tasks_in_parallel(self, tasks) -> List[Tuple[Summarys, int]]:
        """execute tasks in parallel

        Args:
            tasks : the task to be executed

        Returns:
            List[Any]: the results of the task
        """
        results = []
        with ThreadPoolExecutor() as executor:
            running_tasks = [executor.submit(task) for task in tasks]
            for running_task in running_tasks:
                results.append(running_task.result())
        return results

    
    def call_and_cleanup(self, text: str, summarizeChain: LLMChain) -> Tuple[Summarys, int]:
        """calls summarization chain and cleans the data

        Args:
            text (str): text, to be summarized
            summarizeChain (LLMChain): the chain, that summarizes and cleans the data

        Returns:
            Tuple[List[str], int]: the last n summaries, the number of consumed tokens
        """
        try:
            with get_openai_callback() as cb:
                result: Summarys = summarizeChain.invoke({"text": text})
  
            total_tokens = cb.total_tokens
        
        except Exception as ex:
            print(ex)
            # error message
            total_tokens = 0
            result = Summarys(data= [DenserSummary(missing_entities="Fehler", denser_summary='Zusammenfassung konnte nicht generiert werden. Bitte nochmals versuchen.' ),
                                     DenserSummary(missing_entities="Fehler", denser_summary='Zusammenfassung konnte nicht generiert werden. Bitte nochmals versuchen.' ),
                                     DenserSummary(missing_entities="Fehler", denser_summary='Zusammenfassung konnte nicht generiert werden. Bitte nochmals versuchen.' ),
                                     DenserSummary(missing_entities="Fehler", denser_summary='Zusammenfassung konnte nicht generiert werden. Bitte nochmals versuchen.' ),
                                     DenserSummary(missing_entities="Fehler", denser_summary='Zusammenfassung konnte nicht generiert werden. Bitte nochmals versuchen.' )])


        return (result,total_tokens)



    async def summarize(self, splits: List[str],  language: str, department: Optional[str]) -> SummarizeResult:
        """summarizes text with chain of density prompting. Generates 5 increasingly better summaries per split.
        Concatenates the results and translates it into the target language.

        Args:
            splits (List[str]): splits, to be summarized
            language (str): the target language
            department (Optional[str]): _description_

        Returns:
            SummarizeResult: the best n summarizations
        """
        # setup
        (summarizeChain, cleanupChain) = self.setup()
        # call chain
        total_tokens = 0
        summarys: List[DenserSummary] = []
        # call summarization in parallel
        chunk_summaries  =  self.run_io_tasks_in_parallel(
             list(map(lambda chunk:  lambda: self.call_and_cleanup(text=chunk, summarizeChain=summarizeChain), splits)))

        # concatenate all summarys
        for i in range(0,5):
            next_summary = DenserSummary(missing_entities=[], denser_summary="")
            for (chunk_summary, tokens) in chunk_summaries:
                total_tokens += tokens
                next_summary.denser_summary += " "+ chunk_summary.data[i].denser_summary
                next_summary.missing_entities += chunk_summary.data[i].missing_entities
            summarys.append(next_summary)

        final_summarys = []
        for summary in summarys[self.use_last_n_summaries:]:
            # translate and beautify the concatenated summaries
            with get_openai_callback() as cb:
                chunk_summary = cleanupChain.invoke({"language": language, "sum": summary.denser_summary})        
            total_tokens = cb.total_tokens
            final_summarys.append(chunk_summary.content)
        # save total tokens
        if self.config["log_tokens"]:
            self.repo.addInfo(Requestinfo( 
                tokencount = total_tokens,
                department = department,
                messagecount=  1,
                method = "Sum"))

        return SummarizeResult(answer= final_summarys)
    
    def split(self, detaillevel: str, file = None, text = None) -> List[str]:
        """splits the text (either a pdf or text) into equal chunks

        Args:
            detaillevel (str): size of the chunks
            file (pdf, optional): a pdf. Defaults to None
            text (str, optional): a text. Defaults to None.

        Returns:
            List[str]: the chunked text
        """
        splitsize = self.switcher.get(detaillevel, 700)

        if(file is not None):
            splits = splitPDF(file, splitsize, 0)
        else:
            splits = splitText(text, splitsize, 0)
        return splits
    
