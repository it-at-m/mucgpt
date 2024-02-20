from typing import Any, AsyncGenerator, Optional, Sequence

import openai
from core.datahelper import Requestinfo
from core.modelhelper import num_tokens_from_message, num_tokens_from_messages
from core.modelhelper import get_token_limit
from core.datahelper import Repository
from core.types.Config import ApproachConfig
from core.types.Chunk import Chunk, ChunkInfo
from langchain_community.chat_models import AzureChatOpenAI
from langchain.prompts import (
    ChatPromptTemplate,
    MessagesPlaceholder,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate
)
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory
from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler
import asyncio
from openai import RateLimitError


class SimpleChatApproach():

    def __init__(self, chatgpt_deployment: str, chatgpt_model: str, config: ApproachConfig, repo: Repository):
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model
        self.config = config
        self.repo = repo
        
        self.chatgpt_token_limit = get_token_limit(chatgpt_model)

    async def run_until_final_call(self, history: "Sequence[dict[str, str]]", overrides: "dict[str, Any]", should_stream: bool = False, callbacks: "[]"=  []) -> Any:
        user_q =   history[-1]["user"]
        llm = AzureChatOpenAI(
            model=self.chatgpt_model,
            temperature=overrides.get("temperature") or 0.7,
            max_tokens=overrides.get("max_tokens") or 4096,
            n=1,
            deployment_name= self.chatgpt_deployment,
            openai_api_key=openai.api_key,
            openai_api_base=openai.api_base,
            openai_api_version=openai.api_version,
            openai_api_type=openai.api_type,
            streaming=should_stream, 
            callbacks=callbacks,
        )
        messages = [
                # The `variable_name` here is what must align with memory
                MessagesPlaceholder(variable_name="chat_history"),
                HumanMessagePromptTemplate.from_template("{question}")
            ]
        if(overrides.get("system_message") and  overrides.get("system_message").strip() !=""):
            messages.insert(0, 
                    SystemMessagePromptTemplate.from_template(
                        overrides.get("system_message")
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
    

    async def run_with_streaming(self, history: 'list[dict[str, str]]', overrides: 'dict[str, Any]', department: Optional[str]) -> AsyncGenerator[dict, None]:
        handler = AsyncIteratorCallbackHandler()
        chat_coroutine =  await self.run_until_final_call(history, overrides, should_stream=True, callbacks=[handler])
        task = asyncio.create_task(chat_coroutine)
        result = ""
        position = 0


        async for event in handler.aiter():
            result += str(event)
            yield Chunk(type="C", message= event, order=position)
            position += 1

        await task
        if task.exception():
            if isinstance(task.exception(), RateLimitError):
                yield Chunk(type="E",message= "Fehler: Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen.", order=position) 
            else:
                yield Chunk(type="E",message= task.exception(), order=position)
        
        else:
            history[-1]["bot"] = result
            if self.config["log_tokens"]:
                self.repo.addInfo(Requestinfo( 
                    tokencount = num_tokens_from_messages(history,self.chatgpt_model),
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