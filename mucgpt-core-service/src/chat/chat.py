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
        logger.info(
            "Chat streaming started with temperature %s, model %s, max_tokens %s",
            temperature,
            model,
            max_output_tokens,
        )
        logger.debug("Department context: %s", department)
        logger.debug("Input messages count: %s", len(messages))
        # Log message types for debugging
        msg_types = [f"{m.role} ({len(m.content)} chars)" for m in messages]
        logger.debug("Message types: %s", msg_types)

        # Log detailed message content (first 100 chars) for better debugging
        for i, m in enumerate(messages):
            truncated = m.content[:100] + "..." if len(m.content) > 100 else m.content
            logger.debug("Streaming message %d (%s): %s", i, m.role, truncated)

        # configure llm
        config = {
            "llm_max_tokens": max_output_tokens,
            "llm_temperature": temperature,
            "llm_streaming": True,
            "llm": model,
        }
        logger.debug("LLM config: %s", config)
        llm = self.llm.with_config(configurable=config)
        # convert OpenAI messages to langchain messages
        msgs = []
        logger.debug("Converting %d messages to langchain format", len(messages))
        for i, m in enumerate(messages):
            if m.role == "system":
                msgs.append(SystemMessage(m.content))
                logger.debug(
                    "Converted message %d: system message (%d chars)", i, len(m.content)
                )
            elif m.role == "user":
                msgs.append(HumanMessage(m.content))
                logger.debug(
                    "Converted message %d: user message (%d chars)", i, len(m.content)
                )
            else:
                msgs.append(AIMessage(m.content))
                logger.debug(
                    "Converted message %d: AI message (%d chars)", i, len(m.content)
                )

        # prepare OpenAI stream metadata
        id_ = str(uuid.uuid4())
        created = int(time.time())
        logger.debug("Stream ID: %s, created: %s", id_, created)

        chunk_count = 0
        content_length = 0

        # go over events
        try:
            logger.debug("Starting streaming response")
            async for event in llm.astream(msgs):
                chunk_count += 1
                chunk_content_length = len(event.content) if event.content else 0
                content_length += chunk_content_length

                if chunk_count % 50 == 0:  # Log periodically to avoid flooding
                    logger.debug(
                        "Streaming chunks: %s, content length: %s chars",
                        chunk_count,
                        content_length,
                    )
                elif chunk_count <= 3:  # Log first few chunks for debugging
                    logger.debug(
                        "Chunk %d content (%d chars): %s",
                        chunk_count,
                        chunk_content_length,
                        event.content[:50] + "..."
                        if event.content and len(event.content) > 50
                        else event.content,
                    )

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
                yield chunk.model_dump()

            logger.info(
                "Streaming completed successfully. Total chunks: %s, content length: %s chars",
                chunk_count,
                content_length,
            )

        except Exception as ex:
            logger.error("Streaming error: %s", str(ex), exc_info=True)
            error_msg = llm_exception_handler(ex=ex, logger=logger)
            logger.debug("Returning error message to client: %s", error_msg)

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
            yield chunk.model_dump()

        # end of stream signal
        logger.debug("Sending end-of-stream signal")
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
        yield end_chunk.model_dump()

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
        logger.info(
            "Non-streaming chat started with temperature %s, model %s, max_tokens %s",
            temperature,
            model,
            max_output_tokens,
        )
        logger.debug("Department context: %s", department)
        logger.debug("Input messages count: %s", len(messages))
        # Log message types for debugging
        msg_types = [f"{m.role} ({len(m.content)} chars)" for m in messages]
        logger.debug("Message types: %s", msg_types)

        # Log detailed message content (first 100 chars) for better debugging
        for i, m in enumerate(messages):
            truncated = m.content[:100] + "..." if len(m.content) > 100 else m.content
            logger.debug("Non-streaming message %d (%s): %s", i, m.role, truncated)

        # configure llm
        config = {
            "llm_max_tokens": max_output_tokens,
            "llm_temperature": temperature,
            "llm_streaming": False,
        }
        logger.debug("LLM config: %s", config)
        llm = self.llm.with_config(configurable=config)

        # convert OpenAI messages to langchain messages
        msgs = []
        logger.debug("Converting %d messages to langchain format", len(messages))
        for i, m in enumerate(messages):
            if m.role == "system":
                msgs.append(SystemMessage(m.content))
                logger.debug(
                    "Converted message %d: system message (%d chars)", i, len(m.content)
                )
            elif m.role == "user":
                msgs.append(HumanMessage(m.content))
                logger.debug(
                    "Converted message %d: user message (%d chars)", i, len(m.content)
                )
            else:
                msgs.append(AIMessage(m.content))
                logger.debug(
                    "Converted message %d: AI message (%d chars)", i, len(m.content)
                )

        try:
            logger.debug("Invoking LLM with %s messages", len(msgs))
            start_time = time.time()

            with get_openai_callback() as cb:
                ai_message: AIMessage = llm.invoke(msgs)
                # use callback metrics
                usage = Usage(
                    prompt_tokens=cb.prompt_tokens,
                    completion_tokens=cb.completion_tokens,
                    total_tokens=cb.total_tokens,
                )

            elapsed_time = time.time() - start_time
            logger.debug("LLM response received in %.2f seconds", elapsed_time)
            logger.debug("Response length: %s chars", len(ai_message.content))
            logger.debug(
                "Token usage - Prompt: %d, Completion: %d, Total: %d",
                cb.prompt_tokens,
                cb.completion_tokens,
                cb.total_tokens,
            )

            # Log a sample of the response for debugging
            sample_length = min(100, len(ai_message.content))
            logger.debug(
                "Response sample: %s%s",
                ai_message.content[:sample_length],
                "..." if len(ai_message.content) > sample_length else "",
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
            logger.info(
                "Chat completed with prompt tokens: %s, completion tokens: %s, total tokens: %s",
                usage.prompt_tokens,
                usage.completion_tokens,
                usage.total_tokens,
            )
            return response

        except Exception as ex:
            logger.error("Non-streaming chat error: %s", str(ex), exc_info=True)
            error_msg = llm_exception_handler(ex=ex, logger=logger)
            logger.debug("Returning error message to client: %s", error_msg)

            # Create response with error message
            response = ChatCompletionResponse(
                id=str(uuid.uuid4()),
                object="chat.completion",
                created=int(time.time()),
                choices=[
                    ChatCompletionChoice(
                        index=0,
                        message=ChatCompletionMessage(
                            role="assistant", content=error_msg
                        ),
                        finish_reason="error",
                    )
                ],
                usage=Usage(prompt_tokens=0, completion_tokens=0, total_tokens=0),
            )
            return response
