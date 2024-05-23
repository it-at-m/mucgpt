from typing import Any, AsyncGenerator, Callable, Optional, Sequence

from core.datahelper import Requestinfo
from core.modelhelper import num_tokens_from_message, num_tokens_from_messages
from core.datahelper import Repository
from core.types.Config import ApproachConfig
from core.types.Chunk import Chunk, ChunkInfo
from langchain.prompts import (
    ChatPromptTemplate,
    MessagesPlaceholder,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate
)

from langchain_core.language_models.chat_models import BaseChatModel
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory
from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler

import asyncio

class SimpleChatApproach():

    def __init__(self, createLLM: Callable[[int, float, AsyncIteratorCallbackHandler], BaseChatModel], config: ApproachConfig, repo: Repository, chatgpt_model: str):
        self.createLLM = createLLM
        self.config = config
        self.repo = repo
        self.chatgpt_model = chatgpt_model

    async def run_until_final_call(self, history: "Sequence[dict[str, str]]", llm: BaseChatModel, system_message: Optional[str]) -> Any:
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
        self.initializeMemory(history[:-1],memory=memory)
        conversation = LLMChain(
            llm=llm,
            prompt=prompt,
            memory=memory
        )

        chat_coroutine = conversation.acall({"question": user_q})
        return (chat_coroutine)
    

    async def run_with_streaming(self, history: 'list[dict[str, str]]',max_tokens: int, temperature: float, system_message: Optional[str], department: Optional[str]) -> AsyncGenerator[dict, None]:
        handler = AsyncIteratorCallbackHandler()
        llm = self.createLLM(max_tokens, temperature, handler)
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
            if self.config["log_tokens"]:
                self.repo.addInfo(Requestinfo( 
                    tokencount = num_tokens_from_messages(history,self.chatgpt_model) + num_tokens_from_message(system_message,self.chatgpt_model),
                    department = department,
                    messagecount=  len(history),
                    method = "Chat"))
            
            info = ChunkInfo(requesttokens=num_tokens_from_message(history[-1]["user"],self.chatgpt_model), streamedtokens=num_tokens_from_message(result,self.chatgpt_model))
            yield Chunk(type="I", message=info, order=position)


    def initializeMemory(self, messages:"Sequence[dict[str, str]]", memory: ConversationBufferMemory) :
        for conversation in messages:
            if("user" in conversation and conversation["user"]):
                userMsg = conversation["user"]
                memory.chat_memory.add_user_message(userMsg)
            if("bot" in conversation and conversation["bot"]):
                aiMsg = conversation["bot"]
                memory.chat_memory.add_ai_message(aiMsg)