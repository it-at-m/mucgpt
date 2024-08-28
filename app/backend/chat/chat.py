from typing import AsyncGenerator, Optional, Sequence

from langchain_community.callbacks import get_openai_callback
from langchain_core.messages import AIMessage
from langchain_core.runnables.base import RunnableSerializable
from langchain_core.messages import HumanMessage, SystemMessage

from chat.chatresult import ChatResult
from core.datahelper import Repository, Requestinfo
from core.modelhelper import num_tokens_from_messages
from core.types.Chunk import Chunk, ChunkInfo
from core.types.Config import ApproachConfig
from core.types.LlmConfigs import LlmConfigs


class Chat:
    """Chat with a llm via multiple steps.
    """

    def __init__(self, llm: RunnableSerializable, config: ApproachConfig, repo: Repository):
        self.llm = llm
        self.config = config
        self.repo = repo
    
    async def run_with_streaming(self, history: 'list[dict[str, str]]',max_tokens: int, temperature: float, system_message: Optional[str], model: str, department: Optional[str]) -> AsyncGenerator[Chunk, None]:
        """call the llm in streaming mode

        Args:
            history (list[dict[str, str]]): the history,user and ai messages 
            max_tokens (int): max_tokens to generate
            temperature (float): temperature of the llm
            system_message (Optional[str]): the system message
            department (Optional[str]): from which department comes the call
            model (str): the choosen model

        Returns:
            AsyncGenerator[Chunks, None]: a generator returning chunks of messages

        Yields:
            Iterator[AsyncGenerator[Chunks, None]]: Chunks of chat messages. n messages with content. One final message with infos about the consumed tokens.
        """
        # configure
        config: LlmConfigs = {
            "llm_max_tokens": max_tokens,
            "llm_temperature": temperature,
            "llm_streaming": True,
            "llm": model
        }
        llm = self.llm.with_config(configurable=config)
        msgs = self.init_messages(history = history, system_message=system_message)
        result = ""
        position = 0
        # go over events
        try:
            async for event in llm.astream(msgs):
                result += str(event.content)
                yield Chunk(type="C", message= event.content, order=position)
                position += 1
        except Exception as ex:
             yield Chunk(type="E",message= ex.exception(), order=position)
        # handle exceptions
        # TODO find ratelimits
        # TODO use callbacks https://clemenssiebler.com/posts/azure_openai_load_balancing_langchain_with_fallbacks/
        
        else:
            history[-1]["bot"] = result
            if self.config["log_tokens"]:
                self.repo.addInfo(Requestinfo( 
                    tokencount = num_tokens_from_messages(messages=msgs,model=model), #TODO richtiges Modell und tokenizer auswählen
                    department = department,
                    messagecount=  len(history),
                    method = "Chat"),
                    model = model)
            
            info = ChunkInfo(requesttokens=num_tokens_from_messages([msgs[-1]],model), streamedtokens=num_tokens_from_messages([HumanMessage(result)], model)) 
            yield Chunk(type="I", message=info, order=position)
    
    def run_without_streaming(self, history: "Sequence[dict[str, str]]", max_tokens: int, temperature: float, system_message: Optional[str], department: Optional[str], model_name:str) -> ChatResult:
        """calls the llm in blocking mode, returns the full result

        Args:
            history (list[dict[str, str]]): the history,user and ai messages 
            max_tokens (int): max_tokens to generate
            temperature (float): temperature of the llm
            system_message (Optional[str]): the system message
            department (Optional[str]): from which department comes the call

        Returns:
            ChatResult: the generated text from the llm
        """
        config: LlmConfigs = {
            "llm_max_tokens": max_tokens,
            "llm_temperature": temperature,
            "llm_streaming": False,
        }
        llm = self.llm.with_config(configurable=config)
        msgs = self.init_messages(history = history, system_message=system_message)
        
        with get_openai_callback() as cb:
            ai_message: AIMessage = llm.invoke(msgs)
        total_tokens = cb.total_tokens
      
        if self.config["log_tokens"]:
            self.repo.addInfo(Requestinfo( 
                tokencount = total_tokens,
                department = department,
                messagecount=  1,
                method = "Brainstorm"),
                model = model_name)
        return ChatResult(content=ai_message.content)


    def init_messages(self, history:"Sequence[dict[str, str]]", system_message:  Optional[str] ) :
        """initialises memory with chat messages

        Args:
            messages (Sequence[dict[str, str]]): history of messages, are converted into langchain format
            system_message ( Optional[str]): the system message
        """
        langchain_messages = []
        if(system_message and  system_message.strip() !=""):
             langchain_messages.append(SystemMessage(system_message))
        for conversation in history:
            if("user" in conversation and conversation["user"]):
                userMsg = conversation["user"]
                langchain_messages.append(HumanMessage(userMsg))
            if("bot" in conversation and conversation["bot"]):
                aiMsg = conversation["bot"]
                langchain_messages.append(AIMessage(aiMsg))
        return langchain_messages