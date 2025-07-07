import time
import uuid
from typing import AsyncGenerator, List, Optional

from langchain_community.callbacks import get_openai_callback
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables.base import RunnableSerializable

from api.api_models import (
    ChatCompletionChoice,
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionDelta,
    ChatCompletionMessage,
    ChatCompletionResponse,
    Usage,
)
from api.api_models import (
    ChatCompletionMessage as InputMessage,
)
from api.exception import llm_exception_handler
from core.logtools import getLogger

logger = getLogger(name="mucgpt-core-chat")


class Chat:
    """Chat with a llm via multiple steps."""

    def __init__(self, llm: RunnableSerializable):
        self.llm = llm

    async def run_with_streaming(
        self,
        messages: List[InputMessage],
        temperature: float,
        max_output_tokens: int,
        model: str,
        department: Optional[str],
    ) -> AsyncGenerator[dict, None]:
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
        # configure llm
        config = {
            "llm_max_tokens": max_output_tokens,
            "llm_temperature": temperature,
            "llm_streaming": True,
            "llm": model,
        }
        llm = self.llm.with_config(configurable=config)
        # convert OpenAI messages to langchain messages
        msgs = []
        for m in messages:
            if m.role == "system":
                msgs.append(SystemMessage(m.content))
            elif m.role == "user":
                msgs.append(HumanMessage(m.content))
            else:
                msgs.append(AIMessage(m.content))
        # prepare OpenAI stream metadata
        id_ = str(uuid.uuid4())
        created = int(time.time())
        # go over events
        try:
            async for event in llm.astream(msgs):
                chunk = ChatCompletionChunk(
                    id=id_,
                    object="chat.completion.chunk",
                    created=created,
                    choices=[
                        ChatCompletionChunkChoice(
                            delta=ChatCompletionDelta(content=event.content),
                            index=0,
                            finish_reason=None,
                        )
                    ],
                )
                yield chunk.model_dump_json()
        except Exception as ex:
            error_msg = llm_exception_handler(ex=ex, logger=logger)
            # include error message in delta content
            chunk = ChatCompletionChunk(
                id=id_,
                object="chat.completion.chunk",
                created=created,
                choices=[
                    ChatCompletionChunkChoice(
                        delta=ChatCompletionDelta(content=error_msg),
                        index=0,
                        finish_reason="error",
                    )
                ],
            )
            yield chunk.model_dump_json()
        # end of stream signal
        end_chunk = ChatCompletionChunk(
            id=id_,
            object="chat.completion.chunk",
            created=created,
            choices=[
                ChatCompletionChunkChoice(
                    delta=ChatCompletionDelta(), index=0, finish_reason="stop"
                )
            ],
        )
        yield end_chunk.model_dump_json()

    def run_without_streaming(
        self,
        messages: List[InputMessage],
        temperature: float,
        max_output_tokens: int,
        model: str,
        department: Optional[str],
    ) -> ChatCompletionResponse:
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
        # configure llm
        config = {
            "llm_max_tokens": max_output_tokens,
            "llm_temperature": temperature,
            "llm_streaming": False,
        }
        llm = self.llm.with_config(configurable=config)
        # convert OpenAI messages to langchain messages
        msgs = []
        for m in messages:
            if m.role == "system":
                msgs.append(SystemMessage(m.content))
            elif m.role == "user":
                msgs.append(HumanMessage(m.content))
            else:
                msgs.append(AIMessage(m.content))

        with get_openai_callback() as cb:
            ai_message: AIMessage = llm.invoke(msgs)
            # use callback metrics
            usage = Usage(
                prompt_tokens=cb.prompt_tokens,
                completion_tokens=cb.completion_tokens,
                total_tokens=cb.total_tokens,
            )
        response = ChatCompletionResponse(
            id=str(uuid.uuid4()),
            object="chat.completion",
            created=int(time.time()),
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=ChatCompletionMessage(
                        role="assistant", content=ai_message.content
                    ),
                    finish_reason="stop",
                )
            ],
            usage=usage,
        )
        logger.info("Chat completed with total tokens %s", usage.total_tokens)
        return response
