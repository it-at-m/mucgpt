import asyncio
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.runnables import RunnableConfig
from langfuse import observe, propagate_attributes

from api.api_models import (
    AssistantDraftRequest,
    AssistantDraftResult,
    ChatCompletionMessage,
    ChatTitleRequest,
    ChatTitleResult,
)
from api.exception import llm_exception_handler
from config.langfuse_provider import LangfuseProvider
from config.model_provider import ModelProvider
from config.settings import InternalTaskModelStrength, Settings, get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.llm_helpers import (
    extract_department_prefix,
    extract_message_content,
    hash_user_id,
    to_langchain_messages,
)
from core.logtools import getLogger

logger = getLogger()
router = APIRouter(prefix="/v1")


PROMPTS_DIR = Path(__file__).resolve().parents[2] / "create_assistant"


async def _invoke_internal_generation(
    *,
    model_name: str,
    temperature: float,
    messages: list[ChatCompletionMessage],
    user_info: AuthenticationResult,
    trace_tags: list[str],
    run_name: str,
) -> str:
    callbacks = []
    langfuse_handler = LangfuseProvider.get_callback_handler()
    if langfuse_handler:
        callbacks.append(langfuse_handler)

    request_config = RunnableConfig(
        run_name=run_name,
        callbacks=callbacks if callbacks else None,  # type: ignore[arg-type]
        configurable={
            "llm": model_name,
            "llm_temperature": temperature,
            "llm_streaming": False,
            "user_info": user_info,
            "llm_user": extract_department_prefix(user_info.department),
        },
    )

    llm = ModelProvider.get_model().with_config(request_config)
    with propagate_attributes(
        user_id=hash_user_id(user_info.user_id if user_info else None),
        tags=trace_tags,
    ):
        ai_message = await llm.ainvoke(to_langchain_messages(messages))

    return extract_message_content(ai_message.content)


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

    return await _invoke_internal_generation(
        model_name=model_name,
        temperature=temperature,
        messages=messages,
        user_info=user_info,
        trace_tags=trace_tags,
        run_name=run_name,
    )


def _get_internal_task_model(
    settings: Settings, strength: InternalTaskModelStrength
) -> str:
    """Return the preferred model for an internal generation task."""

    if not settings.MODELS:
        logger.error("No models configured for internal generation tasks")
        raise HTTPException(
            status_code=500,
            detail="No models configured for internal generation tasks",
        )

    model = next(
        (
            configured_model
            for configured_model in settings.MODELS
            if configured_model.model_info.internal_task_model_strength == strength
        ),
        settings.MODELS[0],
    )
    return model.llm_name


def _read_prompt_file(filename: str) -> str:
    """Read a prompt template from the prompts directory.

    Kept small and synchronous because files are local and tiny.
    """

    path = PROMPTS_DIR / filename
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:  # pragma: no cover - misconfiguration
        logger.error("Prompt file not found: %s", path)
        raise HTTPException(
            status_code=500,
            detail=f"Prompt configuration missing: {filename}",
        ) from exc


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

    model_name = _get_internal_task_model(settings, InternalTaskModelStrength.STRONG)

    try:
        logger.info("assistant-draft: reading prompt templates")
        system_prompt_system = _read_prompt_file("prompt_for_systemprompt.md")
        description_system = _read_prompt_file("prompt_for_description_from_seed.md")
        title_system = _read_prompt_file("prompt_for_title_from_seed.md")

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

    model_name = _get_internal_task_model(settings, InternalTaskModelStrength.WEAK)

    # Chat title prompt lives next to other assistant-generation prompts for now.
    # If you prefer, move it to a dedicated folder later.
    try:
        system_prompt = _read_prompt_file("prompt_for_chat_title.md")
    except HTTPException:
        # Fallback: hard-coded German instructions matching previous frontend prompt
        logger.warning(
            "prompt_for_chat_title.md missing, falling back to built-in prompt"
        )
        system_prompt = (
            "Du bist ein Assistent, der kurze und aussagekräftige Titel für "
            "Chatverläufe erstellt.\n\n"
            "Erstelle anhand der vorherigen Nutzerfrage und Antwort einen kurzen "
            "Chatnamen, der das Hauptthema der Unterhaltung zusammenfasst.\n\n"
            "Richtlinien:\n"
            "- Maximal 4 Wörter\n"
            "- Sei spezifisch und beschreibend, nicht generisch\n"
            "- Erfasse die zentrale Absicht oder das konkrete Problem\n"
            '- Vermeide Füllwörter wie "Frage zu" oder "Diskussion über"\n'
            "- Schreibe in natürlicher deutscher Titelschreibweise\n"
            "- Schreibe Substantive und Eigennamen groß\n"
            "- Schreibe nicht alles klein\n"
            "- Verwende kein CamelCase und klebe keine Wörter zusammen\n"
            "- Verwende deutsche Umlaute direkt, also ä, ö, ü und ß\n"
            "- Verwende keine Anführungszeichen, kein Markdown, keine Satzzeichen und keine Zeilenumbrüche\n"
            "- Gib nur den Chatnamen aus, nichts anderes\n"
        )

    messages: list[ChatCompletionMessage] = []
    messages.append(ChatCompletionMessage(role="system", content=system_prompt))
    if request.system_message:
        messages.append(
            ChatCompletionMessage(role="system", content=request.system_message)
        )
    messages.append(ChatCompletionMessage(role="user", content=request.query))
    messages.append(ChatCompletionMessage(role="assistant", content=request.answer))

    try:
        logger.info("chat-title: generating title")
        raw_title = await _invoke_internal_generation(
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
