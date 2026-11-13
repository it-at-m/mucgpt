"""Native AG-UI run input: parsing, negotiation, and mapping (issue #1448, Path A).

The v2 chat endpoint accepts two request shapes during the transition:

* the native AG-UI ``RunAgentInput`` — identified by a ``protocolVersion``
  member on the JSON body (a consumer implementing 1.0 declares it there), and
* MUCGPT's legacy chat envelope — the ``ChatCompletionRequest`` JSON the
  pre-AG-UI frontend sends, retired by a later hard cutover.

Both shapes converge on the same internal model, so every request-side gate
(model capability, conversation ownership, image binding, document selection)
runs identically under both shapes.

Wire-conformance notes (see docs.ag-ui.com, spec 1.0):

* ``protocolVersion`` is negotiated in-band; a foreign major line is rejected
  before ``RUN_STARTED`` (no stream exists, the transport error path applies).
* Unrecognised members of the input are stripped with a warning, never fatal
  (the processing model's asymmetry).
* Media content parts are resolved to OpenAI-style data-URL blocks for models
  with ``supports_vision``. This is a **deliberate, documented deviation** from
  the spec's "a producer MUST NOT fail the run over an unusable part" rule: a
  non-vision model receives a fail-closed 400 instead of a silently degraded
  run, because the rejection is a privacy-policy decision made before the run
  starts. Only the inline ``data`` source arm is accepted; ``url`` sources are
  refused (no authenticated image-content endpoint exists yet, and fetching
  arbitrary URLs server-side is an SSRF risk — #1398 owns the content
  endpoint), and ``file`` provider handles are skipped with a warning as the
  spec prescribes for unresolvable handles.
"""

import re
from dataclasses import dataclass, field
from typing import Any

from ag_ui.core import (
    PROTOCOL_VERSION,
    AssistantMessage,
    DeveloperMessage,
    ImagePart,
    ReasoningMessage,
    RunAgentInput,
    SystemMessage,
    TextPart,
    ToolMessage,
    UserMessage,
)
from fastapi import HTTPException
from pydantic import ValidationError

from api.api_models import (
    CanvasState,
    ChatCompletionMessage,
    ChatCompletionRequest,
    ChatDataSource,
)
from config.model_provider import ModelRegistry, ModelsConfigurationException
from config.settings import get_settings
from core.logtools import getLogger

logger = getLogger()

# The only AG-UI major line this service speaks. Newer minors of the line are
# served (additions are safe); other majors are rejected before the run starts.
_SUPPORTED_MAJOR = 1

_PROTOCOL_VERSION_PATTERN = re.compile(r"^(\d+)\.(\d+)$")

# MUCGPT-specific fields carried in forwardedProps under the "mucgpt"
# namespace. Unknown keys are stripped with a warning per the processing model.
_MUCGPT_PROPS = frozenset(
    {
        "model",
        "creativity",
        "reasoning_effort",
        "enabled_tools",
        "assistant_id",
        "persist",
        "document_ids",
        "canvas",
        "data_sources",
        "language",
    }
)

# Wire-level member names of RunAgentInput; anything else on the body is an
# unrecognised addition and is stripped with a warning.
_RUN_INPUT_WIRE_KEYS = frozenset(RunAgentInput.model_json_schema()["properties"])


def is_native_run_input(body: Any) -> bool:
    """A JSON body is native AG-UI iff it declares a ``protocolVersion``.

    The spec obliges a consumer implementing 1.0 to declare the version it
    speaks on the run input, so every AG-UI-native producer carries the member;
    the legacy MUCGPT envelope never did.
    """
    return isinstance(body, dict) and "protocolVersion" in body


def parse_run_agent_input(body: dict[str, Any]) -> RunAgentInput:
    """Validate a native run input with version negotiation.

    Raises HTTP 400 for protocol-version negotiation failures and 422 for
    malformed known fields, before any stream exists (transport error path).
    """
    raw_version = body.get("protocolVersion")
    if not isinstance(raw_version, str) or not (
        match := _PROTOCOL_VERSION_PATTERN.match(raw_version)
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Uninterpretable protocolVersion {raw_version!r}; "
                f"this service speaks AG-UI {PROTOCOL_VERSION} (major {_SUPPORTED_MAJOR})"
            ),
        )
    major, minor = int(match.group(1)), int(match.group(2))
    if major != _SUPPORTED_MAJOR:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported protocol major version {major} "
                f"(this service speaks AG-UI {PROTOCOL_VERSION})"
            ),
        )
    if (major, minor) > tuple(int(part) for part in PROTOCOL_VERSION.split(".")):
        # A newer minor of our own line is serveable by construction: additions
        # are safe, unrecognised material is stripped with a warning.
        logger.warning(
            "Run input declares newer AG-UI protocol minor %s (server speaks %s); "
            "serving under the server's version and stripping unknown additions",
            raw_version,
            PROTOCOL_VERSION,
        )

    try:
        run_input = RunAgentInput.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422, detail=f"Malformed AG-UI run input: {exc}"
        ) from exc

    unknown = set(body) - _RUN_INPUT_WIRE_KEYS
    if unknown:
        logger.warning(
            "Stripping unrecognised AG-UI run-input member(s) %s "
            "(input declares protocolVersion %s, server speaks %s)",
            sorted(unknown),
            raw_version,
            PROTOCOL_VERSION,
        )
    return run_input


def _mucgpt_props(run_input: RunAgentInput) -> dict[str, Any]:
    """Return the namespaced forwardedProps payload, stripping unknown keys."""
    forwarded = run_input.forwarded_props
    if not isinstance(forwarded, dict):
        return {}
    mucgpt = forwarded.get("mucgpt")
    if not isinstance(mucgpt, dict):
        if mucgpt is not None:
            logger.warning(
                "Ignoring forwardedProps.mucgpt of type %s (expected object)",
                type(mucgpt).__name__,
            )
        return {}
    unknown = set(mucgpt) - _MUCGPT_PROPS
    if unknown:
        logger.warning(
            "Stripping unrecognised forwardedProps.mucgpt member(s): %s",
            sorted(unknown),
        )
    return {key: value for key, value in mucgpt.items() if key in _MUCGPT_PROPS}


def _flatten_user_content(
    message: UserMessage,
) -> tuple[str, list[ImagePart]]:
    """Flatten a user message's content parts to text plus pending image parts.

    ``TextPart``s are concatenated in order; image parts are returned for the
    vision gate to bind (see ``bind_media_parts``).
    """
    if isinstance(message.content, str):
        return message.content, []
    text_chunks: list[str] = []
    image_parts: list[ImagePart] = []
    for part in message.content:
        if isinstance(part, TextPart):
            text_chunks.append(part.text)
        elif isinstance(part, ImagePart):
            image_parts.append(part)
        else:
            # Audio/video/document parts have no mapped representation yet;
            # refused together with the other unusable parts (fail-closed
            # policy, see module docstring) at the vision gate.
            image_parts.append(part)  # type: ignore[arg-type]
    return "".join(text_chunks), image_parts


def _strip_history_message(message: Any, reason: str) -> None:
    logger.warning(
        "Stripping %s (id=%s) from AG-UI run input history: %s",
        type(message).__name__,
        getattr(message, "id", None),
        reason,
    )


def to_chat_completion_request(
    run_input: RunAgentInput,
) -> tuple[ChatCompletionRequest, dict[int, list[Any]]]:
    """Map a native run input onto the internal chat request.

    Returns the internal request and the pending media parts keyed by message
    index; ``bind_media_parts`` resolves them after the model-capability gate.
    All MUCGPT specifics arrive in ``forwardedProps.mucgpt`` (D2).
    """
    mucgpt = _mucgpt_props(run_input)

    messages: list[ChatCompletionMessage] = []
    pending_media: dict[int, list[Any]] = {}
    for ag_message in run_input.messages or []:
        if isinstance(ag_message, SystemMessage):
            messages.append(
                ChatCompletionMessage(role="system", content=ag_message.content)
            )
        elif isinstance(ag_message, DeveloperMessage):
            messages.append(
                ChatCompletionMessage(role="system", content=ag_message.content)
            )
        elif isinstance(ag_message, UserMessage):
            text, image_parts = _flatten_user_content(ag_message)
            index = len(messages)
            messages.append(ChatCompletionMessage(role="user", content=text))
            if image_parts:
                pending_media[index] = image_parts
        elif isinstance(ag_message, AssistantMessage):
            if ag_message.content is None:
                _strip_history_message(
                    ag_message, "contentless assistant messages are not supported"
                )
            else:
                messages.append(
                    ChatCompletionMessage(role="assistant", content=ag_message.content)
                )
        elif isinstance(ag_message, ToolMessage):
            # Frontend tools are not offered, so no frontend tool call can be
            # pending; a tool result in history has no mapped representation.
            _strip_history_message(
                ag_message, "frontend tool results are not supported"
            )
        elif isinstance(ag_message, ReasoningMessage):
            _strip_history_message(
                ag_message, "reasoning history is not replayed to the agent"
            )
        else:  # ActivityMessage and anything else: never travels back (spec)
            _strip_history_message(
                ag_message, "activity messages never travel back to the agent"
            )

    kwargs: dict[str, Any] = {
        "conversation_id": run_input.thread_id,
        "messages": messages,
        "model": mucgpt.get("model"),
        "creativity": mucgpt.get("creativity"),
        "reasoning_effort": mucgpt.get("reasoning_effort"),
        "enabled_tools": mucgpt.get("enabled_tools"),
        "assistant_id": mucgpt.get("assistant_id"),
        "persist": mucgpt.get("persist", True),
        "language": mucgpt.get("language"),
    }
    # Omitted document_ids means "no document feature"; an explicitly empty
    # list means "detach all previously selected documents" — preserve the
    # distinction through model_fields_set.
    if "document_ids" in mucgpt:
        kwargs["document_ids"] = mucgpt["document_ids"]
    if "canvas" in mucgpt:
        canvas = mucgpt["canvas"]
        kwargs["canvas"] = _parse_canvas(canvas) if canvas is not None else None
    if "data_sources" in mucgpt:
        data_sources = mucgpt["data_sources"]
        kwargs["data_sources"] = (
            _parse_data_sources(data_sources) if data_sources is not None else None
        )

    try:
        request = ChatCompletionRequest.model_validate(kwargs)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
    return request, pending_media


def _parse_canvas(raw: Any) -> CanvasState:
    if isinstance(raw, CanvasState):
        return raw
    try:
        return CanvasState.model_validate(raw)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422, detail=f"Malformed canvas in forwardedProps.mucgpt: {exc}"
        ) from exc


def _parse_data_sources(raw: Any) -> list[ChatDataSource]:
    if not isinstance(raw, list):
        raise HTTPException(
            status_code=422,
            detail="forwardedProps.mucgpt.data_sources must be a list",
        )
    try:
        return [ChatDataSource.model_validate(entry) for entry in raw]
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Malformed data_sources in forwardedProps.mucgpt: {exc}",
        ) from exc


def _media_block(part: Any) -> dict[str, Any]:
    """Resolve one AG-UI media part to an OpenAI-style content block."""
    source = part.source
    if source is None:
        raise HTTPException(status_code=400, detail="Media part without a source")
    if source.type == "file":
        # Provider handles cannot be resolved here (no provider-issued handle
        # is ever handed out by MUCGPT): skip the part with a warning, as the
        # spec prescribes for a handle the producer cannot use.
        logger.warning(
            "Skipping %s with file source %r: provider handles are not resolvable",
            type(part).__name__,
            getattr(source, "provider", None),
        )
        return {}
    if source.type != "data":
        # url sources are refused fail-closed: no authenticated image-content
        # endpoint exists yet (#1398) and fetching arbitrary URLs server-side
        # is an SSRF risk.
        raise HTTPException(
            status_code=400,
            detail=(
                "Only inline (data) image sources are supported; "
                f"{source.type} sources are not accepted"
            ),
        )
    mime_type = getattr(source, "mime_type", None)
    if not mime_type:
        raise HTTPException(
            status_code=400, detail="Inline media source without a mime_type"
        )
    if not isinstance(part, ImagePart):
        # Audio/video/document parts are not mapped yet — fail closed like an
        # unusable part rather than silently dropping content.
        raise HTTPException(
            status_code=400,
            detail=f"{type(part).__name__} parts are not supported",
        )
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime_type};base64,{source.value}"},
    }


def bind_media_parts(
    chat_request: ChatCompletionRequest,
    pending_media: dict[int, list[Any]],
    supports_vision: bool,
) -> None:
    """Bind pending image parts to their messages after the model gate.

    The fail-closed vision gate: a run requesting image input on a model
    without ``supports_vision`` is rejected before it starts. This is a
    deliberate deviation from the AG-UI "MUST NOT fail the run" rule — see the
    module docstring.
    """
    if not pending_media:
        return
    if not supports_vision:
        raise HTTPException(
            status_code=400,
            detail=(
                "The selected model does not support image input; remove the "
                "image attachment or choose a vision-capable model"
            ),
        )
    for index, parts in pending_media.items():
        blocks: list[dict[str, Any]] = []
        for part in parts:
            block = _media_block(part)
            if block:
                blocks.append(block)
        message = chat_request.messages[index]
        message._media_blocks = blocks


def supports_vision_for_model(model_name: str | None) -> bool:
    """Look up ``model_info.supports_vision`` for the requested model.

    Mirrors ``get_temperature_from_request``'s settings lookup: unknown models
    are treated as non-vision (the registry gate already rejected them).
    """
    try:
        model = ModelRegistry.get_model(model_name)
    except ModelsConfigurationException:
        return False
    settings = get_settings()
    entry = next((m for m in settings.models if m.id == model.model_name), None)
    return bool(entry.model_info.supports_vision) if entry else False


def resume_payloads(run_input: RunAgentInput) -> dict[str, Any] | None:
    """Map AG-UI ``resume[]`` entries to a LangGraph resume mapping (groundwork).

    LangGraph resumes multiple pending interrupts with a ``Command(resume=…)``
    keyed by interrupt id; each entry's ``payload`` is the tool's approved
    (or edited) argument payload. Interrupt/resume tool support itself is the
    follow-up tracked by #1093/#1085 — until an interrupting tool exists this
    mapping is dormant.
    """
    if not run_input.resume:
        return None
    return {entry.interrupt_id: entry.payload for entry in run_input.resume}


@dataclass
class ParsedChatRequest:
    """Endpoint-level parse result for both request shapes.

    ``run_id``/``resume_payloads`` are only set for the native AG-UI shape:
    the run echoes the input's ``runId`` on its boundary events, and
    ``resume[]`` is carried into the graph as a LangGraph ``Command(resume=…)``
    keyed by interrupt id (interrupt/resume groundwork for #1093/#1085).
    """

    request: ChatCompletionRequest
    pending_media: dict[int, list[Any]] = field(default_factory=dict)
    run_id: str | None = None
    resume_payloads: dict[str, Any] | None = None
