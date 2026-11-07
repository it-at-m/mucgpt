"""Mapping of LLM-provider exceptions onto a stable, machine-readable error
contract.

The frontend translates the returned ``code`` into a localized, human-readable
message (``common.errors.provider.*``). The technical ``detail`` is meant for a
"details" view and server logs only — it must never be shown as the primary
chat error text.
"""

import json
import logging
from typing import Any, Final

import openai
from pydantic import BaseModel, Field

# Stable error codes. Part of the API contract with the frontend —
# do not rename a code; extend the i18n mapping instead.
CONTENT_FILTER: Final[str] = "content_filter"
RATE_LIMITED: Final[str] = "rate_limited"
AUTHENTICATION: Final[str] = "authentication"
PERMISSION_DENIED: Final[str] = "permission_denied"
MODEL_NOT_FOUND: Final[str] = "model_not_found"
CONTEXT_LENGTH_EXCEEDED: Final[str] = "context_length_exceeded"
REQUEST_TIMEOUT: Final[str] = "request_timeout"
CONNECTION_ERROR: Final[str] = "connection_error"
SERVER_ERROR: Final[str] = "server_error"
UNKNOWN: Final[str] = "unknown"

# Provider error `code`s that mean a content-policy violation. Azure emits
# "content_filter", the OpenAI API uses "content_policy_violation".
_CONTENT_FILTER_CODES: Final[tuple[str, str]] = (
    "content_filter",
    "content_policy_violation",
)

_DETAIL_MAX_LENGTH: Final[int] = 2000

PROVIDER_ERROR_CODES: Final[frozenset[str]] = frozenset(
    (
        CONTENT_FILTER,
        RATE_LIMITED,
        AUTHENTICATION,
        PERMISSION_DENIED,
        MODEL_NOT_FOUND,
        CONTEXT_LENGTH_EXCEEDED,
        REQUEST_TIMEOUT,
        CONNECTION_ERROR,
        SERVER_ERROR,
        UNKNOWN,
    )
)


class ProviderErrorPayload(BaseModel):
    """Machine-readable chat/provider error carried to the frontend.

    Contract (stable within the 1.x line):
    - v1 chat: ``ChatCompletionChunk.error`` / ``ChatCompletionResponse.error``
      on chunks/responses with ``finish_reason="error"``.
    - v2 AG-UI: ``RunErrorEvent(code=code, message=detail, metadata={"detail": detail})``.

    ``code`` is one of ``PROVIDER_ERROR_CODES``; the frontend maps it to a
    localized user message. ``detail`` is the technical error body for the
    details popout — never shown as the primary error text.
    """

    code: str = Field(..., description="Stable error code from PROVIDER_ERROR_CODES")
    detail: str = Field(
        ..., description="Technical error details (for the details view / logs)"
    )
    status_code: int | None = Field(
        None, description="HTTP status returned by the provider, if any"
    )


def _provider_code(ex: Any) -> str | None:
    """Extract the provider error code from an openai-style exception.

    The openai SDK exposes the provider code via ``ex.code`` on some exception
    types and via the response body on others (Azure: ``body.error.code``).
    """
    code = getattr(ex, "code", None)
    if isinstance(code, str) and code:
        return code
    body = getattr(ex, "body", None)
    if isinstance(body, dict):
        error = body.get("error")
        source: Any = error if isinstance(error, dict) else body
        code = source.get("code")
        if isinstance(code, str) and code:
            return code
    return None


def _status_code(ex: Any) -> int | None:
    status = getattr(ex, "status_code", None)
    if isinstance(status, int) and not isinstance(status, bool):
        return status
    return None


def _mentions_context_length(ex: Exception) -> bool:
    text = str(ex).lower()
    return (
        "context length" in text
        or "context_length" in text
        or " maximum context " in text
        or "context_length_exceeded" in text
    )


def _error_code(ex: Exception) -> str:
    """Classify an exception into one of the stable error codes."""
    if isinstance(ex, openai.APITimeoutError):
        return REQUEST_TIMEOUT
    if isinstance(ex, openai.APIConnectionError):
        return CONNECTION_ERROR
    if isinstance(ex, openai.APIStatusError):
        code = _provider_code(ex)
        if code in _CONTENT_FILTER_CODES:
            return CONTENT_FILTER
        if code == "context_length_exceeded" or _mentions_context_length(ex):
            return CONTEXT_LENGTH_EXCEEDED
        status = _status_code(ex) or 0
        if status == 429:
            return RATE_LIMITED
        if status == 401:
            return AUTHENTICATION
        if status == 403:
            return PERMISSION_DENIED
        if status == 404:
            return MODEL_NOT_FOUND
        if status >= 500:
            return SERVER_ERROR
        return UNKNOWN
    return UNKNOWN


def _detail(ex: Exception) -> str:
    """Build the technical detail string shown only in the details view."""
    lines: list[str] = []
    lines.append(f"exception: {type(ex).__module__}.{type(ex).__qualname__}")
    status = _status_code(ex)
    if status is not None:
        lines.append(f"status: {status}")
    provider_code = _provider_code(ex)
    if provider_code:
        lines.append(f"provider code: {provider_code}")
    request_id = getattr(ex, "request_id", None)
    if isinstance(request_id, str) and request_id:
        lines.append(f"request_id: {request_id}")
    message = str(ex)
    if message and message != f"{type(ex).__name__}()":
        lines.append(f"message: {message}")
    body = getattr(ex, "body", None)
    if body is not None:
        try:
            lines.append(f"body: {json.dumps(body, default=str)}")
        except Exception:  # pragma: no cover - defensive, bodies are JSON-like
            lines.append(f"body: {body!r}")
    text = "\n".join(line for line in lines if line)
    if len(text) > _DETAIL_MAX_LENGTH:
        text = text[:_DETAIL_MAX_LENGTH] + " …(truncated)"
    return text


def _fallback_detail(nested: Exception) -> ProviderErrorPayload:
    return ProviderErrorPayload(
        code=UNKNOWN,
        detail=f"internal error while mapping the exception: {nested}",
        status_code=None,
    )


def llm_error_payload(ex: Exception, logger: logging.Logger) -> ProviderErrorPayload:
    """Map the LLM-provider exception onto a stable error payload.

    Args:
        ex (Exception): the exception thrown by the provider/agent
        logger (Logger): the logger used for the technical detail

    Returns:
        ProviderErrorPayload: stable error contract for the frontend
    """
    try:
        payload = ProviderErrorPayload(
            code=_error_code(ex),
            detail=_detail(ex),
            status_code=_status_code(ex),
        )
        logger.error("Provider error details: %s", payload.detail)
        return payload
    except Exception as nested:  # pragma: no cover - defensive
        logger.error("Error while handling exception: %s", nested)
        return _fallback_detail(nested)


# Short, human-readable rendering of a payload used where only plain text is
# possible (HTTPException details of pre-stream failures and the generation
# endpoints). The frontend maps the code to a localized message when it can.
_ERROR_PHRASES: Final[dict[str, str]] = {
    CONTENT_FILTER: "The request was rejected by the content filter.",
    RATE_LIMITED: "The AI provider is currently rate limiting requests.",
    AUTHENTICATION: "The backend is not authorized to access the AI provider.",
    PERMISSION_DENIED: "The backend is not permitted to use the targeted model.",
    MODEL_NOT_FOUND: "The requested model is not available at the AI provider.",
    CONTEXT_LENGTH_EXCEEDED: (
        "The conversation is too long for the model's context window."
    ),
    REQUEST_TIMEOUT: "The AI provider did not respond in time.",
    CONNECTION_ERROR: "The AI provider could not be reached.",
    SERVER_ERROR: "The AI provider reported an internal error.",
    UNKNOWN: "An unexpected error occurred.",
}


def payload_to_message(payload: ProviderErrorPayload) -> str:
    """Render the payload as a short human-readable phrase for HTTP details."""
    base = _ERROR_PHRASES.get(payload.code, _ERROR_PHRASES[UNKNOWN])
    return f"{base} ({payload.code})"
