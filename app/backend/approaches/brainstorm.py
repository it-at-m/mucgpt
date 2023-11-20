from typing import Any, Dict
from langchain import LLMChain

import openai
from langchain.chat_models import AzureChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import SequentialChain
from core.datahelper import Repository
from core.types.Config import ApproachConfig

from approaches.approach import Approach

class Brainstorm(Approach):
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

    def __init__(self, chatgpt_deployment: str, chatgpt_model: str, config: ApproachConfig, repo: Repository):
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model
        self.config = config
        self.repo = repo
    
    def getBrainstormPrompt(self) -> PromptTemplate:
        return PromptTemplate(input_variables=["topic"], template=self.user_mindmap_prompt)

    def getTranslationPrompt(self) -> PromptTemplate:
        return PromptTemplate(input_variables=["language", "brainstorm"], template=self.user_translate_prompt)


    async def run(self, topic: str, overrides: "dict[str, Any]") -> Any:
        language = overrides.get("language")
        verbose = True
        llm = AzureChatOpenAI(
            model=self.chatgpt_model,
            temperature=overrides.get("temperature") or 0.9,
            max_tokens=4096,
            n=1,
            deployment_name= self.chatgpt_deployment,
            openai_api_key=openai.api_key,
            openai_api_base=openai.api_base,
            openai_api_version=openai.api_version,
            openai_api_type=openai.api_type
        )
        brainstormChain = LLMChain(llm=llm, prompt=self.getBrainstormPrompt(), output_key="brainstorm", verbose=verbose)
        translationChain = LLMChain(llm=llm, prompt=self.getTranslationPrompt(), output_key="translation", verbose=verbose)
        overall_chain = SequentialChain(
            chains=[brainstormChain, translationChain], 
            input_variables=["language", "topic"],
            output_variables=["brainstorm","translation"],
            verbose=verbose)

        result = await overall_chain.acall({"topic": topic, "language": language})
        chat_translate_result = result['translation']     
        #Falls Erklärungen um das Markdown außen rum existieren.
        if("```" in str(chat_translate_result)):
            splitted = str(chat_translate_result).split("```")
            if(len(splitted) == 3):
                chat_translate_result = splitted[1]
        #msg_to_display = '\n\n'.join([str(message) for message in messages])

        return {"answer": chat_translate_result} 
    
