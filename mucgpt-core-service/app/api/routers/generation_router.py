import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from langfuse import get_client, observe, propagate_attributes

from api.api_models import (
    AssistantDraftRequest,
    AssistantDraftResult,
    ChatCompletionMessage,
    ChatTitleRequest,
    ChatTitleResult,
)
from api.exception import llm_error_payload, payload_to_message
from config.settings import InternalTaskModelStrength, get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.llm_helpers import (
    get_internal_task_model,
    hash_user_id,
    invoke_internal_generation,
    read_prompt_file_with_metadata,
)
from core.logtools import getLogger
from core.persistance_helpers import PersistanceHelpers

logger = getLogger()
router = APIRouter(prefix="/v1")


@observe(
    name="assistant-draft-part-generation",
    capture_input=False,
    capture_output=False,
)
async def _invoke_assistant_draft_part(
    *,
    model_name: str,
    temperature: float,
    messages: list[ChatCompletionMessage],
    user_info: AuthenticationResult,
    trace_tags: list[str],
    run_name: str,
    langfuse_prompt: Any | None = None,
) -> str:
    """Trace wrapper for assistant-draft sub-generations.

    Keeps the three parallel draft calls grouped under one parent endpoint trace.
    """

    return await invoke_internal_generation(
        model_name=model_name,
        temperature=temperature,
        messages=messages,
        user_info=user_info,
        trace_tags=trace_tags,
        run_name=run_name,
        langfuse_prompt=langfuse_prompt,
    )


def _normalize_chat_title(value: str) -> str:
    """Normalize a generated chat title to a short, readable form.

    Mirrors the previous frontend behavior to keep titles consistent.
    """

    max_words = 4
    max_length = 48

    # Basic cleanup and tokenization
    words = (
        value.replace('"', "")
        .replace("'", "")
        .translate({ord(c): " " for c in "!#$%&()*+,./:;<=>?@[]^_`{|}~"})
        .split()
    )

    words = [w for w in words if w]
    words = words[:max_words]

    title = " ".join(words)
    if len(title) > max_length:
        title = title[:max_length].rstrip()

    return title


@router.post(
    "/generations/assistant-draft",
    summary="Generate an assistant draft from a prompt seed",
    description=(
        "Generate a complete assistant system prompt, title, and description from a short prompt seed. "
        "This endpoint performs only LLM-based text generation and does not persist data."
    ),
    response_model=AssistantDraftResult,
)
async def generate_assistant_draft(
    request: AssistantDraftRequest,
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> AssistantDraftResult:
    """Generate a full assistant draft from a short prompt seed."""

    langfuse = get_client()
    trace_id = langfuse.create_trace_id()
    with langfuse.start_as_current_observation(
        name="assistant-draft-generation",
        input=request.prompt_seed,
        trace_context={"trace_id": trace_id},
    ) as observation:
        with propagate_attributes(
            user_id=hash_user_id(user_info.user_id),
            tags=["assistant-draft"],
            trace_name="assistant-draft-generation",
        ):
            settings = get_settings()

            try:
                model_name = get_internal_task_model(
                    settings, InternalTaskModelStrength.STRONG
                )
                system_prompt_system = read_prompt_file_with_metadata(
                    "assistant_systemprompt.md"
                )
                description_system = read_prompt_file_with_metadata(
                    "assistant_description.md"
                )
                title_system = read_prompt_file_with_metadata("assistant_name.md")

                base_user_content = "Funktion: " + request.prompt_seed

                generated_system_prompt, description, title = await asyncio.gather(
                    _invoke_assistant_draft_part(
                        model_name=model_name,
                        temperature=1.0,
                        messages=[
                            ChatCompletionMessage(
                                role="system", content=system_prompt_system.content
                            ),
                            ChatCompletionMessage(
                                role="user", content=base_user_content
                            ),
                        ],
                        user_info=user_info,
                        trace_tags=["assistant-draft", "system-prompt"],
                        run_name="assistant-draft-system-prompt",
                        langfuse_prompt=system_prompt_system.langfuse_prompt,
                    ),
                    _invoke_assistant_draft_part(
                        model_name=model_name,
                        temperature=1.0,
                        messages=[
                            ChatCompletionMessage(
                                role="system", content=description_system.content
                            ),
                            ChatCompletionMessage(
                                role="user", content=base_user_content
                            ),
                        ],
                        user_info=user_info,
                        trace_tags=["assistant-draft", "description"],
                        run_name="assistant-draft-description",
                        langfuse_prompt=description_system.langfuse_prompt,
                    ),
                    _invoke_assistant_draft_part(
                        model_name=model_name,
                        temperature=1.0,
                        messages=[
                            ChatCompletionMessage(
                                role="system", content=title_system.content
                            ),
                            ChatCompletionMessage(
                                role="user", content=base_user_content
                            ),
                        ],
                        user_info=user_info,
                        trace_tags=["assistant-draft", "title"],
                        run_name="assistant-draft-title",
                        langfuse_prompt=title_system.langfuse_prompt,
                    ),
                )

                result = AssistantDraftResult(
                    title=title,
                    description=description,
                    system_prompt=generated_system_prompt,
                )
                observation.update(output=result.model_dump())
                return result
            except Exception as e:  # pragma: no cover - integration
                logger.exception("Exception in /generations/assistant-draft")
                payload = llm_error_payload(ex=e, logger=logger)
                raise HTTPException(status_code=500, detail=payload_to_message(payload))


@router.post(
    "/generations/chat-title",
    summary="Generate a chat title from the last turn",
    description=(
        "Generate a short, descriptive chat title based on the latest user "
        "question and assistant answer."
    ),
    response_model=ChatTitleResult,
)
async def generate_chat_title(
    request: ChatTitleRequest,
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> ChatTitleResult:
    """Generate and normalize a chat title from the last user/assistant turn."""

    langfuse = get_client()
    trace_id = langfuse.create_trace_id()
    with langfuse.start_as_current_observation(
        name="chat-title-generation",
        input={"query": request.query, "answer": request.answer},
        trace_context={"trace_id": trace_id},
    ) as observation:
        with propagate_attributes(
            user_id=hash_user_id(user_info.user_id),
            tags=["chat-title"],
            session_id=request.conversation_id,
            trace_name="chat-title-generation",
        ):
            settings = get_settings()
            system_prompt = read_prompt_file_with_metadata("chat_title.md")

            conversation_parts = []
            if request.system_message:
                conversation_parts.append(f"System-Prompt:\n{request.system_message}")
            conversation_parts.extend(
                [
                    f"Nutzernachricht:\n{request.query}",
                    f"Assistentenantwort:\n{request.answer}",
                ]
            )
            messages: list[ChatCompletionMessage] = [
                ChatCompletionMessage(role="system", content=system_prompt.content),
                ChatCompletionMessage(
                    role="user", content="\n\n".join(conversation_parts)
                ),
            ]

            try:
                model_name = get_internal_task_model(
                    settings, InternalTaskModelStrength.WEAK
                )
                raw_title = await invoke_internal_generation(
                    model_name=model_name,
                    temperature=0.0,
                    messages=messages,
                    user_info=user_info,
                    trace_tags=["chat-title"],
                    run_name="chat-title-generation",
                    langfuse_prompt=system_prompt.langfuse_prompt,
                )
                normalized = _normalize_chat_title(raw_title)
                if not normalized:
                    normalized = _normalize_chat_title(request.query) or "New Chat"

                # Persist the title, scoped to the requesting user. A False result means
                # the conversation already exists and belongs to someone else.
                title_persisted = (
                    await PersistanceHelpers.set_chat_title_for_conversation(
                        conversation_id=request.conversation_id,
                        user_id=user_info.user_id,
                        title=normalized,
                    )
                )
                if not title_persisted:
                    logger.warning(
                        "chat-title: user %s may not set the title for conversation %s",
                        user_info.user_id,
                        request.conversation_id,
                    )
                    raise HTTPException(
                        status_code=403,
                        detail="Not allowed to modify this conversation",
                    )

                result = ChatTitleResult(title=normalized)
                observation.update(output=result.model_dump())
                return result
            except HTTPException:
                raise
            except Exception as e:  # pragma: no cover - integration
                logger.exception("Exception in /generations/chat-title")
                payload = llm_error_payload(ex=e, logger=logger)
                raise HTTPException(status_code=500, detail=payload_to_message(payload))
