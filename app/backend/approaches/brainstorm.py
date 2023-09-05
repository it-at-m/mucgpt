from typing import Any
from langchain import LLMChain

import openai
from langchain.chat_models import AzureChatOpenAI
from langchain.prompts.chat import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)
from langchain.chains import SequentialChain

from approaches.approach import Approach

class Brainstorm(Approach):
    """
    Simple brainstorm implementation. One shot generation of certain markdown files
    """
    system_sum_prompt = """You are a helpful assistant. """
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

    system_translate_prompt = """Agiere als Übersetzer, du übersetzt kommentarlos jeden Text in die Sprache {language}. Verstanden?"""
    user_translate_prompt = """
    Übersetze den folgenden Text in {language}.

    Text: 
    {brainstorm}"""

    def __init__(self, chatgpt_deployment: str, chatgpt_model: str):
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model
    
    def getBrainstormPrompt(self) -> ChatPromptTemplate:
        system_message_prompt = SystemMessagePromptTemplate.from_template(self.system_sum_prompt)
        human_message_prompt = HumanMessagePromptTemplate.from_template(input_variables=["topic"], template=self.user_mindmap_prompt)
        return ChatPromptTemplate.from_messages([system_message_prompt, human_message_prompt])

    def getTranslationPrompt(self) -> ChatPromptTemplate:
        system_message_prompt = SystemMessagePromptTemplate.from_template(input_variables=["language"], template= self.system_translate_prompt)
        human_message_prompt = HumanMessagePromptTemplate.from_template(input_variables=["language", "brainstorm"], template=self.user_translate_prompt)
        return ChatPromptTemplate.from_messages([system_message_prompt, human_message_prompt])


    def run(self, topic: str, overrides: "dict[str, Any]") -> Any:
        language = overrides.get("language")
        verbose = True
        llm = AzureChatOpenAI(
            model=self.chatgpt_model,
            temperature=overrides.get("temperature") or 0.7,
            max_tokens=1024,
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

        result = overall_chain({"topic": topic, "language": language})
        chat_translate_result = result['translation']     
        #Falls Erklärungen um das Markdown außen rum existieren.
        if("```" in str(chat_translate_result)):
            splitted = str(chat_translate_result).split("```")
            if(len(splitted) == 3):
                chat_translate_result = splitted[1]
        #msg_to_display = '\n\n'.join([str(message) for message in messages])

        return {"data_points": [], "answer": chat_translate_result, "thoughts": f"Searched for:<br>{topic}<br><br>Conversations:<br>"} #+ msg_to_display.replace('\n', '<br>')}
    
