import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.api_models import (
    ChatCompletionMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ConversationConflict,
    CreateAssistantRequest,
    CreateAssistantResult,
)
from api.exception import llm_exception_handler
from config.settings import get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
from database.conversation_repo import ConflictError, ConversationRepository
from database.session import get_db_session
from init_app import init_agent

logger = getLogger()
router = APIRouter(prefix="/v1")


def _storable_messages(
    messages: list[ChatCompletionMessage],
) -> list[tuple[str, str]]:
    """Return (role, content) pairs to persist: user/assistant turns only.

    System messages are chat configuration rather than conversation content,
    so they are not stored.
    """
    return [(m.role, m.content) for m in messages if m.role in ("user", "assistant")]


def get_temperature_from_request(request: ChatCompletionRequest) -> float:
    """Convert creativity to temperature based on the selected model.

    Args:
        request: The chat completion request

    Returns:
        The temperature value to use for the LLM call
    """
    # If creativity is provided, convert it to temperature based on the model
    if request.creativity:
        settings = get_settings()
        # Find the model configuration
        model_config = next(
            (m for m in settings.MODELS if m.llm_name == request.model), None
        )

        if model_config:
            try:
                return model_config.get_temperature_for_creativity(request.creativity)
            except ValueError:
                logger.warning(
                    f"Invalid creativity level '{request.creativity}', using default 'medium'"
                )
                return model_config.get_temperature_for_creativity("medium")
        else:
            # Model not found, use default mapping
            logger.warning(
                f"Model '{request.model}' not found in configuration, using default temperature mapping"
            )
            default_temps = {
                "low": 0.0,
                "medium": 0.5,
                "high": 1.0,
            }
            return default_temps.get(request.creativity, 0.5)

    # Fall back to temperature if provided (backward compatibility)
    if request.temperature is not None:
        return request.temperature

    # Default temperature
    return 0.5


@router.post(
    "/chat/completions",
    summary="Create chat completion",
    description="OpenAI-compatible endpoint for chat completions",
    response_model=ChatCompletionResponse,
    responses={
        200: {"description": "Successful Response"},
        409: {
            "model": ConversationConflict,
            "description": (
                "Optimistic-concurrency conflict: the conversation was modified "
                "by another client since the revision this request was based on. "
                "No model call is made and nothing is persisted; the client "
                "should reload the conversation and retry."
            ),
        },
        500: {"description": "Internal Server Error"},
    },
)
async def chat_completions(
    request: ChatCompletionRequest,
    user_info: AuthenticationResult = Depends(authenticate_user),
    session: AsyncSession = Depends(get_db_session),
) -> StreamingResponse | ChatCompletionResponse:
    """
    OpenAI-compatible chat completion endpoint (streaming or non-streaming).

    When ``conversation_id`` is supplied, the incoming user message and the
    produced assistant message are persisted to that conversation. Without it,
    the request is fully stateless (unchanged legacy behavior).

    Optimistic concurrency: when ``conversation_revision`` is also supplied, the
    history sync is rejected with **HTTP 409** (``ConversationConflict`` body) if
    the stored conversation has advanced past that revision — before any model
    call, so a stale cross-device turn neither overwrites newer history nor
    spends a generation. The new revision is returned to the client:
      - non-streaming: ``conversation_revision`` on the response body;
      - streaming: a final SSE event
        ``data: {"object": "conversation.revision", "conversation_revision": <int>}``
        emitted after the terminal ``finish_reason: "stop"`` chunk (and only on a
        successful turn — failed/aborted streams emit no revision event).
    """
    # TODO: init_agent currently rebuilds the tool collection and LangChain agent
    # for every message, even within the same chat. Consider introducing a
    # user-scoped tool/runtime cache while keeping assistant/chat-specific
    # enabled tools, prompts, data sources, and policy state request-scoped.
    ae = await init_agent(user_info=user_info)

    # Resolve persistence target. A client-supplied conversation_id is created
    # on first use (the id is the client-generated UUID), so chats become
    # persistent without a separate create call. The client remains the source
    # of truth for the conversation, so each turn we sync the durable copy to
    # the request history (this also mirrors client-side rollback/regenerate
    # edits for free), then append the assistant turn once it is produced.
    conversation_id = request.conversation_id
    repo: ConversationRepository | None = None
    if conversation_id:
        repo = ConversationRepository(session)
        conversation = await repo.get_for_user(conversation_id, user_info.user_id)
        if conversation is None:
            # First turn: auto-create under the client-supplied id.
            await repo.create(
                user_id=user_info.user_id,
                conversation_id=conversation_id,
                model=request.model,
                assistant_id=request.assistant_id,
            )
        # Sync the stored history to the (authoritative) request history,
        # including the incoming user turn, before invoking the agent. The
        # optimistic-concurrency precondition runs here, before any model call:
        # a stale cross-device turn is rejected with 409 and nothing is written
        # or generated. Mapping ConflictError here (outside the main try/except
        # below) keeps the 409 from being reconverted into a 500.
        try:
            await repo.replace_messages(
                conversation_id,
                user_info.user_id,
                _storable_messages(request.messages),
                expected_revision=request.conversation_revision,
            )
        except ConflictError as conflict:
            await session.rollback()
            raise HTTPException(
                status_code=409,
                detail=ConversationConflict(
                    current_revision=conflict.current_revision,
                    expected_revision=conflict.expected_revision,
                ).model_dump(),
            )
        await session.commit()

    try:
        # Convert creativity to temperature
        temperature = get_temperature_from_request(request)

        # Use enabled_tools from request if provided, otherwise use no tool
        enabled_tools = request.enabled_tools or []

        # Structured data sources for request context
        data_sources = (
            [source.model_dump() for source in request.data_sources]
            if request.data_sources
            else None
        )
        if request.stream:
            gen = ae.run_with_streaming(
                messages=request.messages,
                temperature=temperature,
                model=request.model,
                user_info=user_info,
                enabled_tools=enabled_tools,
                assistant_id=request.assistant_id,
                data_sources=data_sources,
            )

            async def sse_generator():
                assistant_content: list[str] = []
                stream_failed = False
                new_revision: int | None = None
                try:
                    async for chunk in gen:
                        # Accumulate assistant text deltas for persistence.
                        if repo is not None:
                            for choice in chunk.get("choices", []):
                                # A failed generation surfaces as an error chunk
                                # carrying the user-facing error text; never store
                                # that as a real assistant turn.
                                if choice.get("finish_reason") == "error":
                                    stream_failed = True
                                delta = choice.get("delta") or {}
                                content = delta.get("content")
                                if isinstance(content, str):
                                    assistant_content.append(content)
                        yield f"data: {json.dumps(chunk)}\n\n"
                finally:
                    # Persist the assembled assistant message once the stream
                    # ends (also runs if the client disconnects mid-stream, so
                    # whatever arrived is saved). Skip persistence when the run
                    # surfaced an error so failed generations are not written to
                    # the durable log and echoed back on the next sync. No yield
                    # here: this also runs under GeneratorExit (client gone),
                    # where yielding would raise.
                    if repo is not None and assistant_content and not stream_failed:
                        await repo.append_message(
                            conversation_id,
                            user_info.user_id,
                            role="assistant",
                            content="".join(assistant_content),
                        )
                        await session.commit()
                        new_revision = await repo.current_revision(
                            conversation_id, user_info.user_id
                        )

                # Emit the post-turn revision as a final event. Reached only on
                # normal completion: a client disconnect propagates GeneratorExit
                # past the finally and skips this, so we never yield into a
                # closing generator. Gated by new_revision (set only on a
                # successful, persisted turn).
                if new_revision is not None:
                    yield (
                        "data: "
                        + json.dumps(
                            {
                                "object": "conversation.revision",
                                "conversation_revision": new_revision,
                            }
                        )
                        + "\n\n"
                    )

            return StreamingResponse(sse_generator(), media_type="text/event-stream")
        else:
            response = await ae.run_without_streaming(
                messages=request.messages,
                temperature=temperature,
                model=request.model,
                user_info=user_info,
                enabled_tools=enabled_tools,
                assistant_id=request.assistant_id,
                data_sources=data_sources,
            )
            # Only persist genuine assistant turns: run_without_streaming can
            # return a normal-looking response whose finish_reason is "error"
            # (the fallback error payload), which must not enter the chat log.
            if (
                repo is not None
                and response.choices
                and response.choices[0].finish_reason != "error"
            ):
                await repo.append_message(
                    conversation_id,
                    user_info.user_id,
                    role="assistant",
                    content=response.choices[0].message.content,
                )
                await session.commit()
                # Surface the post-turn revision so the client can send it as the
                # precondition on its next turn.
                response.conversation_revision = await repo.current_revision(
                    conversation_id, user_info.user_id
                )
            return response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Exception in /chat/completions")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)


@router.post(
    "/generate/assistant",
)
async def create_assistant(
    request: CreateAssistantRequest, user_info=Depends(authenticate_user)
) -> CreateAssistantResult:
    ae = await init_agent(user_info=user_info)
    try:
        logger.info("createAssistant: reading system prompt generator")
        with open("create_assistant/prompt_for_systemprompt.md", encoding="utf-8") as f:
            system_message = f.read()
        messages: list[ChatCompletionMessage] = [
            ChatCompletionMessage(role="system", content=system_message),
            ChatCompletionMessage(role="user", content="Funktion: " + request.input),
        ]
        logger.info("createAssistant: creating system prompt")
        system_prompt = await ae.run_without_streaming(
            messages=messages,
            temperature=1.0,
            model=request.model,
            user_info=user_info,
        )
        system_prompt = system_prompt.choices[0].message.content
        logger.info(system_prompt)
        logger.info("createAssistant: creating description prompt")
        with open("create_assistant/prompt_for_description.md", encoding="utf-8") as f:
            system_message = f.read()
        messages: list[ChatCompletionMessage] = [
            ChatCompletionMessage(role="system", content=system_message),
            ChatCompletionMessage(
                role="user", content="Systempromt: ```" + system_prompt + "```"
            ),
        ]
        logger.info("createAssistant: creating description")
        description = await ae.run_without_streaming(
            messages=messages,
            temperature=1.0,
            model=request.model,
            user_info=user_info,
        )
        description = description.choices[0].message.content
        logger.info("createAssistant: creating title prompt")
        with open("create_assistant/prompt_for_title.md", encoding="utf-8") as f:
            system_message = f.read()
        logger.info("createAssistant: creating title")
        messages: list[ChatCompletionMessage] = [
            ChatCompletionMessage(role="system", content=system_message),
            ChatCompletionMessage(
                role="user",
                content="Systempromt: ```"
                + system_prompt
                + "```\nBeschreibung: ```"
                + description
                + "```",
            ),
        ]
        title = await ae.run_without_streaming(
            messages=messages,
            temperature=1.0,
            model=request.model,
            user_info=user_info,
        )
        title = title.choices[0].message.content
        logger.info("createAssistant: returning finished")
        return CreateAssistantResult(
            title=title,
            description=description,
            system_prompt=system_prompt,
        )
    except Exception as e:
        logger.exception("Exception in /create_assistant")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)
