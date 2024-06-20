from typing import Any, AsyncGenerator, Optional, Sequence
import asyncio
from langchain.prompts import (
    ChatPromptTemplate,
    MessagesPlaceholder,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate
)
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory
from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler
from langchain_core.messages import AIMessage
from langchain_community.callbacks import get_openai_callback
from langchain_core.runnables.base import RunnableSerializable

from core.datahelper import Requestinfo
from core.modelhelper import num_tokens_from_message, num_tokens_from_messages
from core.datahelper import Repository
from core.types.Config import ApproachConfig
from core.types.Chunk import Chunk, ChunkInfo
from core.types.LlmConfigs import LlmConfigs
from core.types.AzureChatGPTConfig import AzureChatGPTConfig

class ChatApproach():

    def __init__(self, llm: RunnableSerializable, config: ApproachConfig,  model_info: AzureChatGPTConfig, repo: Repository, chatgpt_model: str):
        self.llm = llm
        self.config = config
        self.model_info = model_info
        self.repo = repo
        self.chatgpt_model = chatgpt_model

    async def run_until_final_call(self, history: "Sequence[dict[str, str]]", llm: RunnableSerializable, system_message: Optional[str]) -> Any:
        user_q, conversation = self.init_conversation(history, llm, system_message)
        chat_coroutine = conversation.acall({"question": user_q})
        return (chat_coroutine)
    
    async def run_with_streaming(self, history: 'list[dict[str, str]]',max_tokens: int, temperature: float, system_message: Optional[str], department: Optional[str]) -> AsyncGenerator[dict, None]:
        handler = AsyncIteratorCallbackHandler()
        config: LlmConfigs = {
            "llm_max_tokens": max_tokens,
            "llm_api_key": self.model_info["openai_api_key"],
            "llm_temperature": temperature,
            "llm_streaming": True,
            "llm_callbacks": [handler],
        }
        llm = self.llm.with_config(configurable=config)
        chat_coroutine =  await self.run_until_final_call(history, llm=llm, system_message=system_message)
        task = asyncio.create_task(chat_coroutine)
        result = ""
        position = 0


        async for event in handler.aiter():
            result += str(event)
            yield Chunk(type="C", message= event, order=position)
            position += 1

        await task
        if task.exception():
            if "Rate limit" in str(task.exception()):
                yield Chunk(type="E",message= "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen.", order=position) 
            else:
                yield Chunk(type="E",message= task.exception(), order=position)
        
        else:
            history[-1]["bot"] = result
            system_message_tokens = 0
            if(system_message and  system_message.strip() !=""):
                system_message_tokens = num_tokens_from_message(system_message,self.chatgpt_model) 
            if self.config["log_tokens"]:
                self.repo.addInfo(Requestinfo( 
                    tokencount = num_tokens_from_messages(history,self.chatgpt_model) + system_message_tokens,
                    department = department,
                    messagecount=  len(history),
                    method = "Chat"))
            
            info = ChunkInfo(requesttokens=num_tokens_from_message(history[-1]["user"],self.chatgpt_model), streamedtokens=num_tokens_from_message(result,self.chatgpt_model))
            yield Chunk(type="I", message=info, order=position)
    
    def run_without_streaming(self, history: "Sequence[dict[str, str]]", max_tokens: int, temperature: float, system_message: Optional[str], department: Optional[str]) -> str:
        config: LlmConfigs = {
            "llm_max_tokens": max_tokens,
            "llm_api_key": self.model_info["openai_api_key"],
            "llm_temperature": temperature,
            "llm_streaming": False,
        }
        llm = self.llm.with_config(configurable=config)
        user_q, conversation = self.init_conversation(history, llm, system_message)
        with get_openai_callback() as cb:
            ai_message: AIMessage = conversation.invoke({"question": user_q})
        total_tokens = cb.total_tokens
      
        info = ChunkInfo(requesttokens=cb.prompt_tokens, streamedtokens=cb.completion_tokens)
        if self.config["log_tokens"]:
            self.repo.addInfo(Requestinfo( 
                tokencount = total_tokens,
                department = department,
                messagecount=  1,
                method = "Brainstorm"))
        return ai_message["chat_history"][-1].content

    def init_conversation(self, history, llm, system_message):
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
        for conversation in messages:
            if("user" in conversation and conversation["user"]):
                userMsg = conversation["user"]
                memory.chat_memory.add_user_message(userMsg)
            if("bot" in conversation and conversation["bot"]):
                aiMsg = conversation["bot"]
                memory.chat_memory.add_ai_message(aiMsg)