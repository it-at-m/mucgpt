import asyncio
from typing import Any, AsyncGenerator, Optional, Sequence, Tuple

from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory
from langchain.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    MessagesPlaceholder,
    SystemMessagePromptTemplate,
)
from langchain_community.callbacks import get_openai_callback
from langchain_core.messages import AIMessage
from langchain_core.runnables.base import RunnableSerializable

from chat.chatresult import ChatResult
from core.datahelper import Repository, Requestinfo
from core.modelhelper import num_tokens_from_message, num_tokens_from_messages
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

    async def create_coroutine(self, history: "Sequence[dict[str, str]]", llm: RunnableSerializable, system_message: Optional[str]) -> Any:
        """Calls the llm in streaming mode

        Args:
            history (Sequence[dict[str, str]]): given set of messages
            llm (RunnableSerializable): the llm
            system_message (Optional[str]): the system message

        Returns:
            Any: A Coroutine streaming the chat results 
        """
        user_q, conversation = self.init_conversation(history, llm, system_message)
        chat_coroutine = conversation.acall({"question": user_q})
        return (chat_coroutine)
    
    async def run_with_streaming(self, history: 'list[dict[str, str]]',max_tokens: int, temperature: float, system_message: Optional[str], department: Optional[str]) -> AsyncGenerator[Chunk, None]:
        """call the llm in streaming mode

        Args:
            history (list[dict[str, str]]): the history,user and ai messages 
            max_tokens (int): max_tokens to generate
            temperature (float): temperature of the llm
            system_message (Optional[str]): the system message
            department (Optional[str]): from which department comes the call

        Returns:
            AsyncGenerator[Chunks, None]: a generator returning chunks of messages

        Yields:
            Iterator[AsyncGenerator[Chunks, None]]: Chunks of chat messages. n messages with content. One final message with infos about the consumed tokens.
        """
        # configure
        handler = AsyncIteratorCallbackHandler()
        config: LlmConfigs = {
            "llm_max_tokens": max_tokens,
            "llm_temperature": temperature,
            "llm_streaming": True,
            "llm_callbacks": [handler],
        }
        llm = self.llm.with_config(configurable=config)
        
        # create coroutine
        chat_coroutine =  await self.create_coroutine(history, llm=llm, system_message=system_message)
        task = asyncio.create_task(chat_coroutine)
        result = ""
        position = 0

        # go over events
        async for event in handler.aiter():
            result += str(event)
            yield Chunk(type="C", message= event, order=position)
            position += 1

        # await till we have collected all events
        await task
        
        # handle exceptions
        if task.exception():
            if "Rate limit" in str(task.exception()):
                yield Chunk(type="E",message= "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen.", order=position) 
            else:
                yield Chunk(type="E",message= task.exception(), order=position)
        
        else:
            history[-1]["bot"] = result
            system_message_tokens = 0
            if(system_message and  system_message.strip() !=""):
                system_message_tokens = num_tokens_from_message(system_message,"gpt-35-turbo")  #TODO
            if self.config["log_tokens"]:
                self.repo.addInfo(Requestinfo( 
                    tokencount = num_tokens_from_messages(history,"gpt-35-turbo") + system_message_tokens, #TODO richtiges Modell und tokenizer auswählen
                    department = department,
                    messagecount=  len(history),
                    method = "Chat"))
            
            info = ChunkInfo(requesttokens=num_tokens_from_message(history[-1]["user"],"gpt-35-turbo"), streamedtokens=num_tokens_from_message(result,"gpt-35-turbo")) #TODO
            yield Chunk(type="I", message=info, order=position)
    
    def run_without_streaming(self, history: "Sequence[dict[str, str]]", max_tokens: int, temperature: float, system_message: Optional[str], department: Optional[str]) -> ChatResult:
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
        user_q, conversation = self.init_conversation(history, llm, system_message)
        
        with get_openai_callback() as cb:
            ai_message: AIMessage = conversation.invoke({"question": user_q})
        total_tokens = cb.total_tokens
      
        if self.config["log_tokens"]:
            self.repo.addInfo(Requestinfo( 
                tokencount = total_tokens,
                department = department,
                messagecount=  1,
                method = "Brainstorm"))
        return ChatResult(content=ai_message["chat_history"][-1].content)

    def init_conversation(self, history: "Sequence[dict[str, str]]", llm: RunnableSerializable, system_message:str) -> Tuple[str, Any]:
        """transform the history into langchain format, initates the llm with the messages

        Args:
            history (Sequence[dict[str, str]]): the previous chat messages
            llm (RunnableSerializable): the llm
            system_message (str): the system message

        Returns:
            Tuple[str, Any]: (user query, the configured llm with memory)
        """
        user_q =   history[-1]["user"]
        messages = [
                # The `variable_name` here is what must align with memory
                MessagesPlaceholder(variable_name="chat_history"),
                HumanMessagePromptTemplate.from_template("{question}")
            ]
        if(system_message and  system_message.strip() !=""):
            messages.insert(0, 
                    SystemMessagePromptTemplate.from_template(
                        system_message
                    ))
        prompt = ChatPromptTemplate(
            messages=messages
        )
        # Notice that we `return_messages=True` to fit into the MessagesPlaceholder
        # Notice that `"chat_history"` aligns with the MessagesPlaceholder name.
        memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
        ## initialize memory with our own chat model.
        self.init_mem(history[:-1],memory=memory)
        conversation = LLMChain(
            llm=llm,
            prompt=prompt,
            memory=memory
        )
        
        return user_q,conversation


    def init_mem(self, messages:"Sequence[dict[str, str]]", memory: ConversationBufferMemory) :
        """initialises memory with chat messages

        Args:
            messages (Sequence[dict[str, str]]): history of messages, are converted into langchain format
            memory (ConversationBufferMemory): a memory for the messages
        """
        for conversation in messages:
            if("user" in conversation and conversation["user"]):
                userMsg = conversation["user"]
                memory.chat_memory.add_user_message(userMsg)
            if("bot" in conversation and conversation["bot"]):
                aiMsg = conversation["bot"]
                memory.chat_memory.add_ai_message(aiMsg)