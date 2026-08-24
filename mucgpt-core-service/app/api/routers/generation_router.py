import asyncio

from fastapi import APIRouter, Depends, HTTPException
from langfuse import observe

from api.api_models import (
    AssistantDraftRequest,
    AssistantDraftResult,
    ChatCompletionMessage,
    ChatTitleRequest,
    ChatTitleResult,
)
from api.exception import llm_exception_handler
from config.settings import InternalTaskModelStrength, get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.llm_helpers import (
    get_internal_task_model,
    invoke_internal_generation,
    read_prompt_file,
)
from core.logtools import getLogger

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
@observe(name="assistant-draft-generation", capture_input=False, capture_output=False)
async def generate_assistant_draft(
    request: AssistantDraftRequest,
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> AssistantDraftResult:
    """Generate a full assistant draft from a short prompt seed."""

    settings = get_settings()

    try:
        model_name = get_internal_task_model(settings, InternalTaskModelStrength.STRONG)
        logger.info("assistant-draft: reading prompt templates")
        system_prompt_system = read_prompt_file("prompt_for_systemprompt.md")
        description_system = read_prompt_file("prompt_for_description_from_seed.md")
        title_system = read_prompt_file("prompt_for_title_from_seed.md")

        base_user_content = "Funktion: " + request.prompt_seed

        logger.info("assistant-draft: running llm calls in parallel")
        generated_system_prompt, description, title = await asyncio.gather(
            _invoke_assistant_draft_part(
                model_name=model_name,
                temperature=1.0,
                messages=[
                    ChatCompletionMessage(role="system", content=system_prompt_system),
                    ChatCompletionMessage(role="user", content=base_user_content),
                ],
                user_info=user_info,
                trace_tags=["assistant-draft", "system-prompt"],
                run_name="assistant-draft-system-prompt",
            ),
            _invoke_assistant_draft_part(
                model_name=model_name,
                temperature=1.0,
                messages=[
                    ChatCompletionMessage(role="system", content=description_system),
                    ChatCompletionMessage(role="user", content=base_user_content),
                ],
                user_info=user_info,
                trace_tags=["assistant-draft", "description"],
                run_name="assistant-draft-description",
            ),
            _invoke_assistant_draft_part(
                model_name=model_name,
                temperature=1.0,
                messages=[
                    ChatCompletionMessage(role="system", content=title_system),
                    ChatCompletionMessage(role="user", content=base_user_content),
                ],
                user_info=user_info,
                trace_tags=["assistant-draft", "title"],
                run_name="assistant-draft-title",
            ),
        )

        logger.info("assistant-draft: returning finished draft")
        return AssistantDraftResult(
            title=title,
            description=description,
            system_prompt=generated_system_prompt,
        )
    except Exception as e:  # pragma: no cover - integration
        logger.exception("Exception in /generations/assistant-draft")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)


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

    settings = get_settings()
    system_prompt = read_prompt_file("prompt_for_chat_title.md")

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
        ChatCompletionMessage(role="system", content=system_prompt),
        ChatCompletionMessage(role="user", content="\n\n".join(conversation_parts)),
    ]

    try:
        model_name = get_internal_task_model(settings, InternalTaskModelStrength.WEAK)
        logger.info("chat-title: generating title")
        raw_title = await invoke_internal_generation(
            model_name=model_name,
            temperature=0.0,
            messages=messages,
            user_info=user_info,
            trace_tags=["chat-title"],
            run_name="chat-title-generation",
        )
        normalized = _normalize_chat_title(raw_title)
        if not normalized:
            normalized = _normalize_chat_title(request.query) or "New Chat"

        return ChatTitleResult(title=normalized)
    except Exception as e:  # pragma: no cover - integration
        logger.exception("Exception in /generations/chat-title")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)
