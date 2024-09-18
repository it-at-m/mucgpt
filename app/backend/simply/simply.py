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
    
    
    def simply(self, topic:str,language:str,history: List[ChatTurn], temperature: float, system_message: Optional[str], department: Optional[str], llm_name:str) -> ChatResult:
        config: LlmConfigs = {
            "llm_temperature": temperature,
            "llm_streaming": False,
        }
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
        return ChatResult(content=ai_message.content)


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