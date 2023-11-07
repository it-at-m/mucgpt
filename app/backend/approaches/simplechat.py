from typing import Any, AsyncGenerator, Sequence

import openai
from core.modelhelper import get_token_limit
from langchain.chat_models import AzureChatOpenAI
from langchain.prompts import (
    ChatPromptTemplate,
    MessagesPlaceholder,
    HumanMessagePromptTemplate,
)
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory
from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler
import asyncio


class SimpleChatApproach():

    def __init__(self, chatgpt_deployment: str, chatgpt_model: str):
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model
        
        self.chatgpt_token_limit = get_token_limit(chatgpt_model)

    async def run_until_final_call(self, history: "Sequence[dict[str, str]]", overrides: "dict[str, Any]", should_stream: bool = False, callbacks: "[]"=  []) -> Any:
        language = overrides.get("language")
        user_q =   history[-1]["user"]

        verbose = True
        llm = AzureChatOpenAI(
            model=self.chatgpt_model,
            temperature=overrides.get("temperature") or 0.7,
            max_tokens=4096,
            n=1,
            deployment_name= self.chatgpt_deployment,
            openai_api_key=openai.api_key,
            openai_api_base=openai.api_base,
            openai_api_version=openai.api_version,
            openai_api_type=openai.api_type,
            streaming=should_stream, 
            callbacks=callbacks,
        )
        prompt = ChatPromptTemplate(
            messages=[
                # The `variable_name` here is what must align with memory
                MessagesPlaceholder(variable_name="chat_history"),
                HumanMessagePromptTemplate.from_template("{question}")
            ]
        )
        # Notice that we `return_messages=True` to fit into the MessagesPlaceholder
        # Notice that `"chat_history"` aligns with the MessagesPlaceholder name.
        memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
        ## initialize memory with our own chat model.
        self.initializeMemory(history[:-1],memory=memory)
        conversation = LLMChain(
            llm=llm,
            prompt=prompt,
            verbose=True,
            memory=memory
        )

        extra_info = {}

        chat_coroutine = conversation.acall({"question": user_q})
        return (extra_info, chat_coroutine)
    
    async def run_without_streaming(self, history: 'list[dict[str, str]]', overrides: 'dict[str, Any]') -> 'dict[str, Any]':
        extra_info, chat_coroutine = await self.run_until_final_call(history, overrides, should_stream=False)
        chat_content = (await chat_coroutine)['text']
        extra_info["answer"] = chat_content
        return extra_info

    async def run_with_streaming(self, history: 'list[dict[str, str]]', overrides: 'dict[str, Any]') -> AsyncGenerator[dict, None]:
        handler = AsyncIteratorCallbackHandler()
        extra_info, chat_coroutine =  await self.run_until_final_call(history, overrides, should_stream=True, callbacks=[handler])
        yield extra_info
        asyncio.create_task(chat_coroutine)
        async for event in handler.aiter():
            yield event

    def initializeMemory(self, messages:"Sequence[dict[str, str]]", memory: ConversationBufferMemory) :
        for conversation in messages:
            if("user" in conversation and conversation["user"]):
                userMsg = conversation["user"]
                memory.chat_memory.add_user_message(userMsg)
            if("bot" in conversation and conversation["bot"]):
                aiMsg = conversation["bot"]
                memory.chat_memory.add_ai_message(aiMsg)