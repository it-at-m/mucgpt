from typing import AsyncGenerator, List, Optional

from core.datahelper import Repository, Requestinfo
from core.helper import llm_exception_handler
from core.logtools import getLogger
from core.modelhelper import num_tokens_from_messages
from core.types.ChatRequest import ChatTurn
from core.types.ChatResult import ChatResult
from core.types.Chunk import Chunk, ChunkInfo
from core.types.Config import ApproachConfig
from core.types.LlmConfigs import LlmConfigs
from langchain_community.callbacks import get_openai_callback
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables.base import RunnableSerializable

logger = getLogger(name="mucgpt-backend-chat")


class Chat:
    """Chat with a llm via multiple steps."""

    def __init__(
        self, llm: RunnableSerializable, config: ApproachConfig, repo: Repository
    ):
        self.llm = llm
        self.config = config
        self.repo = repo

    async def run_with_streaming(
        self,
        history: List[ChatTurn],
        max_output_tokens: int,
        temperature: float,
        system_message: Optional[str],
        model: str,
        department: Optional[str],
    ) -> AsyncGenerator[Chunk, None]:
        """call the llm in streaming mode

        Args:
            history (List[ChatTurn]): the history,user and ai messages
            max_output_tokens (int): max_output_tokens to generate
            temperature (float): temperature of the llm
            system_message (Optional[str]): the system message
            department (Optional[str]): from which department comes the call
            model (str): the choosen model

        Returns:
            AsyncGenerator[Chunks, None]: a generator returning chunks of messages

        Yields:
            Iterator[AsyncGenerator[Chunks, None]]: Chunks of chat messages. n messages with content. One final message with infos about the consumed tokens.
        """
        logger.info("Chat streaming started with temperature %s", temperature)
        # configure
        config: LlmConfigs = {
            "llm_max_tokens": max_output_tokens,
            "llm_temperature": temperature,
            "llm_streaming": True,
            "llm": model,
        }
        llm = self.llm.with_config(configurable=config)
        msgs = self.init_messages(history=history, system_message=system_message)
        result = ""
        position = 0
        # go over events
        try:
            async for event in llm.astream(msgs):
                result += str(event.content)
                yield Chunk(type="C", message=event.content, order=position)
                position += 1
        except Exception as ex:
            msg = llm_exception_handler(ex=ex, logger=logger)
            yield Chunk(type="E", message=msg, order=position)
        # handle exceptions
        # TODO find ratelimits
        # TODO use callbacks https://clemenssiebler.com/posts/azure_openai_load_balancing_langchain_with_fallbacks/
        history[-1].bot = result
        streamed_tokens = num_tokens_from_messages([HumanMessage(result)], model)
        if self.config.log_tokens:
            self.repo.addInfo(
                Requestinfo(
                    tokencount=streamed_tokens,
                    department=department,
                    messagecount=len(history),
                    method="Chat",
                    model=model,
                )
            )

        info = ChunkInfo(
            requesttokens=num_tokens_from_messages([msgs[-1]], model),
            streamedtokens=streamed_tokens,
        )
        logger.info("Chat streaming with total tokens %s", streamed_tokens)
        yield Chunk(type="I", message=info, order=position)

    def run_without_streaming(
        self,
        history: List[ChatTurn],
        max_output_tokens: int,
        temperature: float,
        system_message: Optional[str],
        department: Optional[str],
        llm_name: str,
    ) -> ChatResult:
        """calls the llm in blocking mode, returns the full result

        Args:
            history (List[ChatTurn]): the history,user and ai messages
            max_output_tokens (int): max_output_tokens to generate
            temperature (float): temperature of the llm
            system_message (Optional[str]): the system message
            department (Optional[str]): from which department comes the call

        Returns:
            ChatResult: the generated text from the llm
        """
        logger.info("Chat started with temperature %s", temperature)
        config: LlmConfigs = {
            "llm_max_tokens": max_output_tokens,
            "llm_temperature": temperature,
            "llm_streaming": False,
        }
        llm = self.llm.with_config(configurable=config)
        msgs = self.init_messages(history=history, system_message=system_message)

        with get_openai_callback() as cb:
            ai_message: AIMessage = llm.invoke(msgs)
        total_tokens = cb.total_tokens

        if self.config.log_tokens:
            self.repo.addInfo(
                Requestinfo(
                    tokencount=total_tokens,
                    department=department,
                    messagecount=1,
                    method="Brainstorm",
                    model=llm_name,
                )
            )
        logger.info("Chat completed with total tokens %s", cb.total_tokens)
        return ChatResult(content=ai_message.content)

    def init_messages(self, history: List[ChatTurn], system_message: Optional[str]):
        """initialises memory with chat messages

        Args:
            messages (List[ChatTurn]): history of messages, are converted into langchain format
            system_message ( Optional[str]): the system message
        """
        langchain_messages = []
        if system_message and system_message.strip() != "":
            langchain_messages.append(SystemMessage(system_message))
        for conversation in history:
            if conversation.user:
                langchain_messages.append(HumanMessage(content=conversation.user))
            if conversation.bot:
                langchain_messages.append(AIMessage(content=conversation.bot))
        return langchain_messages
