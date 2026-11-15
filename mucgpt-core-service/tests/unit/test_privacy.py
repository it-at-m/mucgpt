"""Image payload redaction helpers for privacy-sensitive trace sinks."""

from types import SimpleNamespace

from core.privacy import (
    BINARY_PLACEHOLDER,
    IMAGE_PLACEHOLDER,
    otel_image_mask,
    redact_image_data_uris_in_text,
    redact_image_payloads,
)

DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg"
LONG_DATA_URI = "data:image/png;base64," + "A" * 100


def test_structured_redaction_replaces_data_uris():
    payload = {
        "role": "user",
        "content": [
            {"type": "text", "text": "What does this form require?"},
            {
                "type": "image_url",
                "image_url": {"url": DATA_URI, "detail": "auto"},
            },
        ],
        "nested": {"raw": (b"\x89PNG\r\n\x1a\n", "text")},
    }

    redacted = redact_image_payloads(payload)

    assert redacted["content"][0]["text"] == "What does this form require?"
    assert redacted["content"][1]["image_url"]["url"] == IMAGE_PLACEHOLDER
    assert redacted["content"][1]["image_url"]["detail"] == "auto"
    assert redacted["nested"]["raw"][0] == BINARY_PLACEHOLDER
    assert redacted["nested"]["raw"][1] == "text"


def test_managed_references_and_media_tokens_survive():
    payload = [
        "mucgpt-image://11111111-1111-4111-8111-111111111111",
        "@@@langfuseMedia:type=image/png|id=abc|source=base64_data_uri@@@",
    ]

    assert redact_image_payloads(payload) == payload


def test_plain_text_is_not_mangled():
    text = "Read docs at https://example.com and data:image/png later"
    assert redact_image_payloads(text) == text


def test_tuple_and_scalars_preserved():
    value = {"count": 5, "flag": True, "none": None, "url": DATA_URI}
    redacted = redact_image_payloads(value)
    assert redacted["count"] == 5
    assert redacted["flag"] is True
    assert redacted["none"] is None
    assert redacted["url"] == IMAGE_PLACEHOLDER


def test_text_redaction_handles_embedded_data_uris():
    text = f'{{"prompt": [{DATA_URI}, "describe"]}}'

    redacted = redact_image_data_uris_in_text(text)

    assert DATA_URI not in redacted
    assert IMAGE_PLACEHOLDER in redacted
    assert '"describe"' in redacted


def test_text_redaction_leaves_uri_without_base64_payload():
    text = "the spec mentions data:image/png;base64, explicitly"
    assert redact_image_data_uris_in_text(text) == text


def _spans(*attribute_sets):
    from langfuse.types import OtelSpanIdentifier

    return {
        OtelSpanIdentifier(trace_id=i + 1, span_id=i + 1): SimpleNamespace(
            attributes=attributes
        )
        for i, attributes in enumerate(attribute_sets)
    }


def test_otel_mask_patches_only_affected_attributes():
    mask = otel_image_mask()
    result = mask(
        params=SimpleNamespace(
            spans=_spans(
                {
                    "gen_ai.prompt.0.content": f'{{"content": "{LONG_DATA_URI}"}}',
                    "safe": "plain text",
                    "tokens": 42,
                },
                {"clean": "nothing to redact"},
            )
        )
    )

    identifiers = list(result.span_patches)
    assert len(identifiers) == 1
    patch = result.span_patches[identifiers[0]]
    redacted = patch.set_attributes["gen_ai.prompt.0.content"]
    assert LONG_DATA_URI not in redacted
    assert IMAGE_PLACEHOLDER in redacted
    assert patch.set_attributes.get("safe") is None
    assert list(patch.delete_attributes) == []


def test_otel_mask_returns_none_without_matches():
    mask = otel_image_mask()
    result = mask(
        params=SimpleNamespace(
            spans=_spans({"safe": "plain", "num": 1}, {"seq": ["a", "b"]})
        )
    )
    assert result is None


def test_otel_mask_redacts_string_sequences():
    mask = otel_image_mask()
    result = mask(
        params=SimpleNamespace(
            spans=_spans({"messages": ["hello", DATA_URI, "bye"]})
        )
    )
    [patch] = result.span_patches.values()
    assert patch.set_attributes["messages"] == [
        "hello",
        IMAGE_PLACEHOLDER,
        "bye",
    ]


def test_otel_mask_ignores_non_string_sequences():
    mask = otel_image_mask()
    result = mask(
        params=SimpleNamespace(spans=_spans({"nums": [1, 2, 3]}))
    )
    assert result is None
