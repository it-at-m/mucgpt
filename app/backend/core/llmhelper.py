from langchain_community.llms.fake import FakeListLLM
from langchain_core.runnables import ConfigurableField
from langchain_core.runnables.base import RunnableSerializable
from langchain_openai import AzureChatOpenAI

from core.types.SupportedModels import SupportedModels


def getModel(chatgpt_model: str,
             max_tokens: int,
             n: int,
             api_key: str,
             api_base: str,
             api_version: str,
             api_type: str,
             temperature: float,
             streaming: bool) -> RunnableSerializable:
        """returns a configured llm, which can be later be parametrized during runtime

        Returns:
                RunnableSerializable: the configured llm
        """
        llm = AzureChatOpenAI(
                model=chatgpt_model,
                max_tokens=max_tokens,
                n=n,
                deployment_name= "chat",
                openai_api_key=api_key,
                azure_endpoint=api_base,
                openai_api_version=api_version,
                openai_api_type=api_type,
                temperature=temperature,
                streaming=streaming,
                ).configurable_fields(
                temperature=ConfigurableField(
                        id="llm_temperature",
                        name="LLM Temperature",
                        description="The temperature of the LLM",
                ),
                max_tokens= ConfigurableField(
                        id="llm_max_tokens",
                        name="LLM max Tokens",
                        description="The token Limit of the LLM",
                ),
                openai_api_key = ConfigurableField(
                        id="llm_api_key",
                        name="The api key",
                        description="The api key"),
                streaming = ConfigurableField(
                        id="llm_streaming",
                        name="Streaming",
                        description="Should the LLM Stream"),
                callbacks = ConfigurableField(
                        id="llm_callbacks",
                        name="Callbacks",
                        description="Callbacks for the llm")
                        
                ).configurable_alternatives(
                ConfigurableField(id="llm"),
                default_key=SupportedModels.AZURE_CHATGPT.value,
                fake= FakeListLLM(responses=["Hi diggi"]))
        return llm
