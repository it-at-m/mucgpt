from typing import Any, Optional
from langchain.chains import LLMChain

from langchain.prompts import PromptTemplate
from langchain.chains import SequentialChain
from langchain_community.callbacks import get_openai_callback
from core.datahelper import Repository
from core.types.Config import ApproachConfig
from core.datahelper import Requestinfo
from langchain_core.language_models.chat_models import BaseChatModel

class Brainstorm():
    """
    Simple brainstorm implementation. One shot generation of certain markdown files
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

    def __init__(self, llm: BaseChatModel, config: ApproachConfig, repo: Repository):
        self.llm = llm
        self.config = config
        self.repo = repo
    
    def getBrainstormPrompt(self) -> PromptTemplate:
        return PromptTemplate(input_variables=["topic"], template=self.user_mindmap_prompt)

    def getTranslationPrompt(self) -> PromptTemplate:
        return PromptTemplate(input_variables=["language", "brainstorm"], template=self.user_translate_prompt)


    async def run(self, topic: str, language: str, department: Optional[str]) -> Any:
        brainstormChain = LLMChain(llm=self.llm, prompt=self.getBrainstormPrompt(), output_key="brainstorm")
        translationChain = LLMChain(llm=self.llm, prompt=self.getTranslationPrompt(), output_key="translation")
        overall_chain = SequentialChain(
            chains=[brainstormChain, translationChain], 
            input_variables=["language", "topic"],
            output_variables=["brainstorm","translation"])
            

        with get_openai_callback() as cb:
            result = await overall_chain.acall({"topic": topic, "language": language})
        total_tokens = cb.total_tokens

        chat_translate_result = result['translation']     
        #Falls Erklärungen um das Markdown außen rum existieren.
        if("```" in str(chat_translate_result)):
            splitted = str(chat_translate_result).split("```")
            if(len(splitted) == 3):
                chat_translate_result = splitted[1]

        
        if self.config["log_tokens"]:
            self.repo.addInfo(Requestinfo( 
                tokencount = total_tokens,
                department = department,
                messagecount=  1,
                method = "Brainstorm"))

        return {"answer": chat_translate_result} 
    
