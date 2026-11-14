import hashlib
import re
from collections.abc import Sequence
from typing import Any, Protocol

from fastapi import HTTPException
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langfuse import propagate_attributes
from pydantic import BaseModel

from config.langfuse_provider import LangfuseProvider
from config.model_provider import ModelRegistry
from config.settings import Settings
from core.auth_models import AuthenticationResult
from core.lf_prompts import PromptPool, ResolvedPrompt
from core.logtools import getLogger

logger = getLogger()


class MessageLike(Protocol):
    @property
    def role(self) -> str: ...

    @property
    def content(self) -> str: ...


def to_langchain_messages(messages: Sequence[MessageLike]) -> list[BaseMessage]:
    """Convert API-style messages to LangChain message objects.

    A message carrying ``_media_blocks`` (AG-UI image parts resolved to
    OpenAI-style data-URL blocks by the run-input mapper, see
    ``api.ag_ui_input``) is converted to a multimodal HumanMessage whose
    content is a content-block list.
    """
    converted: list[BaseMessage] = []
    for message in messages:
        media_blocks = getattr(message, "_media_blocks", None)
        if message.role == "system":
            converted.append(SystemMessage(message.content))
        elif message.role == "user":
            if media_blocks:
                converted.append(
                    HumanMessage(
                        content=[
                            {"type": "text", "text": message.content},
                            *media_blocks,
                        ]
                    )
                )
            else:
                converted.append(HumanMessage(message.content))
        else:
            converted.append(AIMessage(message.content))
    return converted


def hash_user_id(user_id: str | None) -> str | None:
    """Return a deterministic SHA-256 hash for user IDs used in tracing."""
    if not user_id:
        return None
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()


def extract_department_prefix(department: str | None) -> str | None:
    """Return leading alphabetic prefix of an organization unit (e.g., TEAM from TEAM/3)."""
    if not department:
        return None
    match = re.match(r"[A-Za-z]+", department)
    return match.group(0) if match else None


def extract_message_content(content: Any) -> str:
    """Normalize LLM output content to plain string."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(str(part) for part in content if part is not None).strip()
    if content is None:
        return ""
    return str(content)


def get_internal_task_model(settings: Settings, strength: str) -> str:
    """Return the preferred configured model for an internal LLM task."""

    if not settings.models:
        logger.error("No models configured for internal generation tasks")
        raise HTTPException(
            status_code=500,
            detail="No models configured for internal generation tasks",
        )

    model = next(
        (
            configured_model
            for configured_model in settings.models
            if configured_model.model_info.internal_task_model_strength == strength
        ),
        settings.models[0],
    )
    return model.id


def read_prompt_file(filename: str, folder_name: str | None = None) -> str:
    """Read a default prompt, preferring the Langfuse-backed pool with local fallback."""

    return read_prompt_file_with_metadata(filename, folder_name).content


def read_prompt_file_with_metadata(
    filename: str, folder_name: str | None = None
) -> ResolvedPrompt:
    """Read a prompt and retain Langfuse metadata for generation trace linking."""

    name = filename.rsplit(".", 1)[0]
    try:
        return PromptPool.get_resolved_prompt(name, folder_name)
    except KeyError as exc:  # pragma: no cover - misconfiguration
        logger.error("Prompt file not found: %s", filename)
        raise HTTPException(
            status_code=500,
            detail=f"Prompt configuration missing: {filename}",
        ) from exc


def _internal_request_config(
    *,
    model_name: str,
    temperature: float,
    user_info: AuthenticationResult,
    run_name: str,
) -> RunnableConfig:
    callbacks = []
    langfuse_handler = LangfuseProvider.get_callback_handler()
    if langfuse_handler:
        callbacks.append(langfuse_handler)

    return RunnableConfig(
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


async def invoke_internal_generation(
    *,
    model_name: str,
    temperature: float,
    messages: Sequence[MessageLike],
    user_info: AuthenticationResult,
    trace_tags: list[str],
    run_name: str,
    langfuse_prompt: Any | None = None,
) -> str:
    """Invoke an internal model for text generation with tracing metadata."""

    run_config = _internal_request_config(
        model_name=model_name,
        temperature=temperature,
        user_info=user_info,
        run_name=run_name,
    )
    model_settings: dict[str, Any] = {
        "temperature": temperature,
        "stream": False,
    }
    llm_user = extract_department_prefix(user_info.department)
    if llm_user is not None:
        model_settings["user"] = llm_user
    model = ModelRegistry.get_model(model_name)
    model_settings = ModelRegistry.normalize_model_settings(model, model_settings)
    llm = model.bind(**model_settings)
    with propagate_attributes(
        user_id=hash_user_id(user_info.user_id),
        tags=trace_tags,
        prompt=langfuse_prompt,
    ):
        ai_message = await llm.ainvoke(
            to_langchain_messages(messages), config=run_config
        )

    return extract_message_content(ai_message.content)


async def invoke_internal_structured_generation[StructuredOutputT: BaseModel](
    *,
    model_name: str,
    temperature: float,
    messages: Sequence[MessageLike],
    user_info: AuthenticationResult,
    trace_tags: list[str],
    run_name: str,
    schema: type[StructuredOutputT],
    langfuse_prompt: Any | None = None,
) -> StructuredOutputT:
    """Invoke an internal model and validate its response against a Pydantic schema."""

    run_config = _internal_request_config(
        model_name=model_name,
        temperature=temperature,
        user_info=user_info,
        run_name=run_name,
    )
    model_settings: dict[str, Any] = {
        "temperature": temperature,
        "stream": False,
    }
    llm_user = extract_department_prefix(user_info.department)
    if llm_user is not None:
        model_settings["user"] = llm_user
    model = ModelRegistry.get_model(model_name)
    model_settings = ModelRegistry.normalize_model_settings(model, model_settings)
    # Structured output via tool calling. Reasoning models (e.g. Mistral Large,
    # GLM) return thinking content blocks next to the tool call; the stock
    # structured-output parser expects string content and crashes on those
    # lists, so the tool call is extracted from the raw response instead.
    llm = model.bind_tools([schema], **model_settings)
    with propagate_attributes(
        user_id=hash_user_id(user_info.user_id),
        tags=trace_tags,
        prompt=langfuse_prompt,
    ):
        response = await llm.ainvoke(to_langchain_messages(messages), config=run_config)
        tool_calls = getattr(response, "tool_calls", None) or []
        if not tool_calls:
            raise ValueError(
                f"{run_name}: model {model_name} returned no tool call "
                f"(content type: {type(response.content).__name__})"
            )
        return schema.model_validate(tool_calls[0]["args"])
