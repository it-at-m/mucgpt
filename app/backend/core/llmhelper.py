

from typing import Callable
from langchain_openai import AzureChatOpenAI
from langchain_core.language_models.chat_models import BaseChatModel
from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler

def getAzureChatGPT(chatgpt_model: str,
                    max_tokens: int,
                    n: int,
                    openai_api_key: str,
                    openai_api_base: str,
                    openai_api_version: str,
                    openai_api_type: str,
                    temperature: float) -> BaseChatModel:
    return AzureChatOpenAI(
                model=chatgpt_model,
                max_tokens=max_tokens,
                n=n,
                deployment_name= "chat",
                openai_api_key=openai_api_key,
                azure_endpoint=openai_api_base,
                openai_api_version=openai_api_version,
                openai_api_type=openai_api_type,
                temperature=temperature
        )

def createAzureChatGPT(chatgpt_model: str,
                    n: int,
                    openai_api_key: str,
                    openai_api_base: str,
                    openai_api_version: str,
                    openai_api_type: str,) -> Callable[[AsyncIteratorCallbackHandler], BaseChatModel]:
    return lambda max_tokens, temperature, callback : AzureChatOpenAI(
            model=chatgpt_model,
            max_tokens=max_tokens,
            n=n,
            deployment_name= "chat",
            openai_api_key=openai_api_key,
            azure_endpoint=openai_api_base,
            openai_api_version=openai_api_version,
            openai_api_type=openai_api_type,
            temperature=temperature,
            streaming=True,
            callbacks= [callback] if callback else []
        )