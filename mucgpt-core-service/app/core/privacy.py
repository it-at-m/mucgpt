"""Recursive redaction of image payloads for privacy-sensitive sinks.

Image input is an explicit per-model data-protection opt-in, and tracing it
is a *separate* opt-in (``image_input.langfuse_media_enabled``). When media
tracing is disabled, these helpers guarantee that no image bytes reach the
observability backend even though hydrated data URIs flow through the model
call: the SDK-level ``mask`` redacts structured attributes before they are
serialized, and ``mask_otel_spans`` is the fail-closed export backstop for
raw/third-party OTel span attributes.

Text and safe metadata (including managed ``mucgpt-image://`` references and
native Langfuse media tokens) are preserved so traces stay debuggable.
"""

import re
from typing import Any

IMAGE_DATA_URI_PATTERN = re.compile(
    r"data:image/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+"
)

IMAGE_PLACEHOLDER = "[image omitted from tracing]"
BINARY_PLACEHOLDER = "[binary data omitted from tracing]"


def redact_image_payloads(value: Any) -> Any:
    """Return a deep copy with inline image payloads replaced by placeholders.

    Strict redaction for structured SDK data: strings that *start with* a
    data URI are replaced wholesale (placeholders elsewhere would mangle
    legitimate text), while nested structures are traversed and rebuilt.
    """
    if isinstance(value, str):
        if value.startswith("data:image/"):
            return IMAGE_PLACEHOLDER
        return value
    if isinstance(value, bytes | bytearray):
        return BINARY_PLACEHOLDER
    if isinstance(value, dict):
        return {key: redact_image_payloads(item) for key, item in value.items()}
    if isinstance(value, list):
        return [redact_image_payloads(item) for item in value]
    if isinstance(value, tuple):
        return tuple(redact_image_payloads(item) for item in value)
    return value


def redact_image_data_uris_in_text(text: str) -> str:
    """Replace embedded image data URIs inside arbitrary text with placeholders.

    Used for OTel span attributes, which may carry JSON-encoded provider
    payloads where a data URI appears mid-string.
    """
    return IMAGE_DATA_URI_PATTERN.sub(IMAGE_PLACEHOLDER, text)


def _redact_attribute_value(value: Any) -> Any | None:
    """Return the redacted value for an OTel attribute, or None if unchanged.

    Only string-valued attributes (including homogeneous string sequences)
    can carry image data URIs; other scalar types pass through untouched.
    """
    if isinstance(value, str):
        if IMAGE_DATA_URI_PATTERN.search(value):
            return redact_image_data_uris_in_text(value)
        return None
    if isinstance(value, list | tuple):
        if all(isinstance(item, str) for item in value):
            redacted = [redact_image_data_uris_in_text(item) for item in value]
            if redacted != list(value):
                return redacted
        return None
    return None


def otel_image_mask():
    """Build the fail-closed export-stage mask for OTel span attributes.

    Deterministic, exception-free, and network-free: it only inspects the
    provided read-only attribute snapshots and returns sparse patches. A
    ``None`` result leaves the batch unchanged.
    """
    from langfuse.types import MaskOtelSpansResult, OtelSpanPatch

    def mask_otel_spans(*, params) -> Any:
        patches: dict[Any, OtelSpanPatch] = {}
        for identifier, span in params.spans.items():
            attributes = getattr(span, "attributes", None) or {}
            replacements: dict[str, Any] = {}
            for key, value in attributes.items():
                redacted = _redact_attribute_value(value)
                if redacted is not None:
                    replacements[key] = redacted
            if replacements:
                patches[identifier] = OtelSpanPatch(set_attributes=replacements)
        if not patches:
            return None
        return MaskOtelSpansResult(span_patches=patches)

    return mask_otel_spans
