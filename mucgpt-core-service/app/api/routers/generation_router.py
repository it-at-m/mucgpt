from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from api.api_models import (
    AssistantDraftRequest,
    AssistantDraftResult,
    ChatCompletionMessage,
    ChatCompletionResponse,
    ChatTitleRequest,
    ChatTitleResult,
)
from api.exception import llm_exception_handler
from config.settings import InternalTaskModelStrength, Settings, get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
from init_app import init_agent

logger = getLogger()
router = APIRouter(prefix="/v1")


PROMPTS_DIR = Path("create_assistant")


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
async def generate_assistant_draft(
    request: AssistantDraftRequest,
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> AssistantDraftResult:
    """Generate a full assistant draft from a short prompt seed."""

    ae = await init_agent(user_info=user_info)
    settings = get_settings()

    model_name = _get_internal_task_model(settings, InternalTaskModelStrength.STRONG)

    try:
        logger.info("assistant-draft: reading system prompt generator")
        system_message = _read_prompt_file("prompt_for_systemprompt.md")
        messages: list[ChatCompletionMessage] = [
            ChatCompletionMessage(role="system", content=system_message),
            ChatCompletionMessage(
                role="user", content="Funktion: " + request.system_prompt
            ),
        ]

        logger.info("assistant-draft: creating system prompt")
        system_prompt_resp: ChatCompletionResponse = ae.run_without_streaming(
            messages=messages,
            temperature=1.0,
            model=model_name,
            user_info=user_info,
        )
        generated_system_prompt = system_prompt_resp.choices[0].message.content

        logger.info("assistant-draft: reading description prompt")
        system_message = _read_prompt_file("prompt_for_description.md")
        messages = [
            ChatCompletionMessage(role="system", content=system_message),
            ChatCompletionMessage(
                role="user",
                content="Systempromt: ```" + generated_system_prompt + "```",
            ),
        ]

        logger.info("assistant-draft: creating description")
        description_resp: ChatCompletionResponse = ae.run_without_streaming(
            messages=messages,
            temperature=1.0,
            model=model_name,
            user_info=user_info,
        )
        description = description_resp.choices[0].message.content

        logger.info("assistant-draft: reading title prompt")
        system_message = _read_prompt_file("prompt_for_title.md")
        messages = [
            ChatCompletionMessage(role="system", content=system_message),
            ChatCompletionMessage(
                role="user",
                content=(
                    "Systempromt: ```"
                    + generated_system_prompt
                    + "```\nBeschreibung: ```"
                    + description
                    + "```"
                ),
            ),
        ]

        logger.info("assistant-draft: creating title")
        title_resp: ChatCompletionResponse = ae.run_without_streaming(
            messages=messages,
            temperature=1.0,
            model=model_name,
            user_info=user_info,
        )
        title = title_resp.choices[0].message.content

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

    ae = await init_agent(user_info=user_info)
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
        completion: ChatCompletionResponse = ae.run_without_streaming(
            messages=messages,
            temperature=0.0,
            model=model_name,
            user_info=user_info,
        )
        raw_title = completion.choices[0].message.content
        normalized = _normalize_chat_title(raw_title)
        if not normalized:
            normalized = _normalize_chat_title(request.query) or "New Chat"

        return ChatTitleResult(title=normalized)
    except Exception as e:  # pragma: no cover - integration
        logger.exception("Exception in /generations/chat-title")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)
