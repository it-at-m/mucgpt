from typing import List

from langchain_community.llms.fake import FakeListLLM
from langchain_core.runnables import ConfigurableField
from langchain_core.runnables.base import RunnableSerializable
from langchain_openai import AzureChatOpenAI, ChatOpenAI

from core.types.Config import ModelsConfig


class ModelsConfigurationException(Exception):
    pass


def getModel(models: List[ModelsConfig], 
             max_tokens: int,
             n: int,
             temperature: float,
             streaming: bool) -> RunnableSerializable:
        """returns a configured llm, which can be later be parametrized during runtime

        Returns:
                RunnableSerializable: the configured llm
        """
        if len(models) == 0:
                raise ModelsConfigurationException("No models found in the configuration.json")
        default_model = models[0]
        if default_model.type == "AZURE":
                llm = AzureChatOpenAI(
                        deployment_name= default_model.deployment,
                        openai_api_key=default_model.api_key,
                        azure_endpoint=default_model.endpoint,
                        openai_api_version=default_model.api_version,
                        max_tokens=max_tokens,
                        n=n,
                        streaming=streaming,
                        temperature=temperature,
                        openai_api_type="azure",
                        )
        elif default_model.type == "OPENAI":
               llm = ChatOpenAI(
                        model=default_model.llm_name,
                        api_key=default_model.api_key,
                        base_url=default_model.endpoint,
                        max_tokens=max_tokens,
                        n=n,
                        streaming=streaming,
                        temperature=temperature,
            )
        else:
                raise ModelsConfigurationException(f"Unknown model type: {default_model.type}. Currently only `AZURE` and `OPENAI` are supported.")

        alternatives = {"fake" : FakeListLLM(responses=["Hi diggi"])}
        for model in models[1:]:
                if model.type == "AZURE":
                        alternative = AzureChatOpenAI(
                                deployment_name= model.deployment,
                                openai_api_key=model.api_key,
                                azure_endpoint=model.endpoint,
                                openai_api_version=model.api_version,
                                openai_api_type="azure",
                                max_tokens=max_tokens,
                                n=n,
                                streaming=streaming,
                                temperature=temperature,
                                )
                elif model.type == "OPENAI":
                        alternative = ChatOpenAI(
                                        model=model.llm_name,
                                        api_key=model.api_key,
                                        base_url=model.endpoint,
                                        max_tokens=max_tokens,
                                        n=n,
                                        streaming=streaming,
                                        temperature=temperature,
                        )
                alternatives[model.llm_name] = alternative
        llm = llm.configurable_fields(
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
                                default_key=models[0].llm_name,
                                **alternatives
                               )
        return llm
