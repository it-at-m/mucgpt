from operator import itemgetter
from typing import Optional

from langchain.prompts import PromptTemplate
from langchain.schema.output_parser import StrOutputParser
from langchain_community.callbacks import get_openai_callback
from langchain_core.runnables.base import RunnableSerializable

from brainstorm.BrainstormResult import BrainstormResult
from core.datahelper import Repository, Requestinfo
from core.types.Config import ApproachConfig
from core.types.LlmConfigs import LlmConfigs


class Brainstorm:
    """
    Simple brainstorm implementation. One shot generation of certain markdown files. Translates the result into a target language.
    """
    user_mindmap_prompt = """
      In a markdown file (MD) plan out a mind map on the topic {topic}. Follow the format in this example. Write it in a code snippet I can copy from directly. Provide only code, no description. Include the exact format I used below.
    Example markdown format:

    # Central topic

    ## Main topic 1

    ### Subtopic 1

    – Subtopic 1

    – Subtopic 2

    – Subtopic 3

    ### Subtopic 2

    – Subtopic 1

    – Subtopic 2

    – Subtopic 3

    ## Main topic 2

    ### Subtopic 1

    – Subtopic 1

    – Subtopic 2

    – Subtopic 3"""

    user_translate_prompt = """
    Übersetze den folgenden Text in {language}. Beinhalte die Markdown Formatierung bei.

    Text: 
    {brainstorm}"""

    def __init__(self, llm: RunnableSerializable, config: ApproachConfig, repo: Repository):
        self.llm = llm
        self.config = config
        self.repo = repo
    
    def getBrainstormPrompt(self) -> PromptTemplate:
        """Returns the brainstrom prompt template
        Returns:
            PromptTemplate: prompt template, has an input variable topic
        """
        return PromptTemplate(input_variables=["topic"], template=self.user_mindmap_prompt)

    def getTranslationPrompt(self) -> PromptTemplate:
        """Returns the translation prompt, translates the output of the brainstorming to a given langugage

        Returns:
            PromptTemplate: prompt template for translation, uses the target language and the brainstorm output as an input
        """
        return PromptTemplate(input_variables=["language", "brainstorm"], template=self.user_translate_prompt)


    async def brainstorm(self, topic: str, language: str, department: Optional[str], llm_name:str) -> BrainstormResult:
        """Generates ideas for a given topic structured in markdown, translates the result into the target language 

        Args:
            topic (str): topic of the brainstorming
            language (str): target language
            department (Optional[str]): department, who is responsible for the call
            llm_name (str): the choosen llm

        Returns:
            BrainstormResult: the structured markdown with ideas about the topic
        """
        # configure
        config: LlmConfigs = {
            "llm": llm_name
        }
        llm = self.llm.with_config(configurable=config)
        # get prompts
        brainstorm_prompt = self.getBrainstormPrompt()
        translation_prompt = self.getTranslationPrompt()
        # construct chains
        brainstormChain =  brainstorm_prompt |llm | StrOutputParser()
        translationChain = translation_prompt |llm | StrOutputParser()
        # build complete chain
        overall_chain = ({"brainstorm": brainstormChain,"language": itemgetter("language") }| translationChain )
        
        with get_openai_callback() as cb:
            result = await overall_chain.ainvoke({"topic": topic, "language": language})
        total_tokens = cb.total_tokens
        translation = self.cleanup(str(result))

        if self.config["log_tokens"]:
            self.repo.addInfo(Requestinfo( 
                tokencount = total_tokens,
                department = department,
                messagecount=  1,
                method = "Brainstorm",
                model = llm_name))
        return BrainstormResult(answer=translation)

    def cleanup(self, chat_translate_result: str) -> str:
        """removes leading explanation

        Args:
            chat_translate_result (str): the result of the brainstorming, sometimes has leading explanation before the markdown part

        Returns:
            str: _description_ the result of the brainstorming without leading explanations
        """
        if("```" in chat_translate_result):
            splitted = str(chat_translate_result).split("```")
            if(len(splitted) == 3):
                chat_translate_result = splitted[1]
        return chat_translate_result
    
