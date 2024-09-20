import re
from typing import List, Optional

from langchain_community.callbacks import get_openai_callback
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables.base import RunnableSerializable

from core.datahelper import Repository, Requestinfo
from core.types.ChatRequest import ChatTurn
from core.types.ChatResult import ChatResult
from core.types.Config import ApproachConfig
from core.types.LlmConfigs import LlmConfigs


class Simply:
    """Chat with a llm via multiple steps.
    """

    def __init__(self, llm: RunnableSerializable, config: ApproachConfig, repo: Repository):
        self.llm = llm
        self.config = config
        self.repo = repo
    
    
    def simply(self, temperature: float, department: Optional[str], llm_name:str, output_type:str, message:str, completeness:str) -> ChatResult:
        config: LlmConfigs = {
            "llm_temperature": temperature,
            "llm_streaming": False,
        }

        if output_type == "plain":
            prompt = self.build_prompt_plain(llm_name=llm_name, message=message, completeness=completeness)
            with open("simply/prompts/system_message_es.md", encoding="utf-8") as f:
                system_message = f.read()
        else:
            prompt = self.build_prompt_easy(llm_name=llm_name, message=message, completeness=completeness)
            with open("simply/prompts/system_message_ls.md", encoding="utf-8") as f:
                system_message = f.read()
    
        history : List[ChatTurn] = [ChatTurn(user=prompt)]

        llm = self.llm.with_config(configurable=config)
        msgs = self.init_messages(history = history, system_message=system_message)
        
        with get_openai_callback() as cb:
            ai_message: AIMessage = llm.invoke(msgs)
        total_tokens = cb.total_tokens
        if self.config.log_tokens:
            self.repo.addInfo(Requestinfo( 
                tokencount = total_tokens,
                department = department,
                messagecount=  1,
                method = "Simplyfied Language",
                model = llm_name))
        return ChatResult(content=self.extractText(ai_message.content, output_type))


    def init_messages(self, history:List[ChatTurn], system_message:  Optional[str] ) :
        """initialises memory with chat messages

        Args:
            messages (List[ChatTurn]): history of messages, are converted into langchain format
            system_message ( Optional[str]): the system message
        """
        langchain_messages = []
        if(system_message and  system_message.strip() !=""):
             langchain_messages.append(SystemMessage(system_message))
        for conversation in history:
            if(conversation.user):
                langchain_messages.append(HumanMessage(content=conversation.user))
            if(conversation.bot):
                langchain_messages.append(AIMessage(content=conversation.bot))
        return langchain_messages
    
    def build_prompt_plain(self, llm_name:str, message:str, completeness:str) -> str:
        with open("simply/prompts/rules_es.md", encoding="utf-8") as f:
            rules = f.read()
        if "mistral" in llm_name.lower():
            with open("simply/prompts/prompt_mistral_es.md", encoding="utf-8") as f:
                prompt = f.read()
        else:
            with open("simply/prompts/prompt_openai_es.md", encoding="utf-8") as f:
                prompt = f.read()
            
        return prompt.format(message=message, completeness=completeness, rules=rules)
    
    def build_prompt_easy(self, llm_name:str, message:str, completeness:str) -> str:
        with open("simply/prompts/rules_ls.md", encoding="utf-8") as f:
            rules = f.read()
        if "mistral" in llm_name.lower():
            with open("simply/prompts/prompt_mistral_ls.md", encoding="utf-8") as f:
                prompt = f.read()
        else:
            with open("simply/prompts/prompt_openai_ls.md", encoding="utf-8") as f:
                prompt = f.read()
            
        return prompt.format(message=message, completeness=completeness, rules=rules)
    
    def extractText(self, response: str, output_type:str)-> str :
        """Extract text between tags from response."""
        if output_type == "easy":
            result = re.findall(
                r"<leichtesprache>(.*?)</leichtesprache>", response, re.DOTALL
            )
        else:
            result = re.findall(
                r"<einfachesprache>(.*?)</einfachesprache>", response, re.DOTALL
            )
        result = "\n".join(result)
        return result.strip()
