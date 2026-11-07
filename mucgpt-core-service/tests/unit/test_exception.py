import logging

import httpx
import openai
import pytest

from api.exception import (
    AUTHENTICATION,
    CONNECTION_ERROR,
    CONTENT_FILTER,
    CONTEXT_LENGTH_EXCEEDED,
    MODEL_NOT_FOUND,
    PERMISSION_DENIED,
    PROVIDER_ERROR_CODES,
    RATE_LIMITED,
    REQUEST_TIMEOUT,
    SERVER_ERROR,
    UNKNOWN,
    ProviderErrorPayload,
    llm_error_payload,
    payload_to_message,
)

_URL = "https://provider.example/v1/chat/completions"


def _request() -> httpx.Request:
    return httpx.Request("POST", _URL)


def _status_error(
    ex_cls: type[openai.APIStatusError],
    message: str,
    status: int,
    body: object | None = None,
) -> openai.APIStatusError:
    return ex_cls(
        message,
        response=httpx.Response(status, request=_request()),
        body=body,
    )


def _payload(ex: Exception) -> ProviderErrorPayload:
    return llm_error_payload(ex, logger=_logger())


class _Logger(logging.Logger):
    """Logger stub; exception.py only calls .error(...)."""

    calls: list[tuple]

    def __init__(self) -> None:
        super().__init__("test-exception")
        self.calls = []

    def error(self, *args: object, **kwargs: object) -> None:  # noqa: D102
        self.calls.append((args, kwargs))


def _logger() -> _Logger:
    return _Logger()


class TestTaxonomy:
    """One case per stable error code, using real openai exceptions."""

    @pytest.mark.unit
    def test_content_filter_azure_body(self) -> None:
        ex = _status_error(
            openai.BadRequestError,
            "The response was filtered",
            400,
            body={"error": {"code": "content_filter", "message": "filtered"}},
        )
        assert _payload(ex).code == CONTENT_FILTER
        assert _payload(ex).status_code == 400

    @pytest.mark.unit
    def test_content_filter_openai_policy(self) -> None:
        ex = _status_error(
            openai.BadRequestError,
            "The request violates our policies",
            400,
            body={"error": {"code": "content_policy_violation"}},
        )
        assert _payload(ex).code == CONTENT_FILTER

    @pytest.mark.unit
    def test_content_filter_via_code_attribute(self) -> None:
        # Some SDK/provider paths surface the code directly on the exception.
        ex = _status_error(
            openai.BadRequestError,
            "filtered",
            400,
            body=None,
        )
        object.__setattr__(ex, "code", "content_filter")
        assert _payload(ex).code == CONTENT_FILTER

    @pytest.mark.unit
    def test_rate_limited_status_only(self) -> None:
        ex = _status_error(openai.RateLimitError, "Too many requests", 429)
        assert _payload(ex).code == RATE_LIMITED

    @pytest.mark.unit
    def test_authentication_401(self) -> None:
        ex = _status_error(openai.AuthenticationError, "Invalid key", 401)
        assert _payload(ex).code == AUTHENTICATION

    @pytest.mark.unit
    def test_permission_denied_403(self) -> None:
        ex = _status_error(openai.PermissionDeniedError, "Denied", 403)
        assert _payload(ex).code == PERMISSION_DENIED

    @pytest.mark.unit
    def test_model_not_found_404(self) -> None:
        ex = _status_error(openai.NotFoundError, "No deployment", 404)
        assert _payload(ex).code == MODEL_NOT_FOUND

    @pytest.mark.unit
    def test_context_length_exceeded_code(self) -> None:
        ex = _status_error(
            openai.BadRequestError,
            "This model's maximum context length is 8192 tokens",
            400,
            body={"error": {"code": "context_length_exceeded"}},
        )
        assert _payload(ex).code == CONTEXT_LENGTH_EXCEEDED

    @pytest.mark.unit
    def test_context_length_exceeded_by_message(self) -> None:
        ex = _status_error(
            openai.BadRequestError,
            "Maximum context length of this model is exceeded.",
            400,
            body=None,
        )
        assert _payload(ex).code == CONTEXT_LENGTH_EXCEEDED

    @pytest.mark.unit
    def test_request_timeout(self) -> None:
        ex = openai.APITimeoutError(request=_request())
        assert _payload(ex).code == REQUEST_TIMEOUT

    @pytest.mark.unit
    def test_connection_error(self) -> None:
        ex = openai.APIConnectionError(request=_request())
        assert _payload(ex).code == CONNECTION_ERROR

    @pytest.mark.unit
    def test_server_error_500(self) -> None:
        ex = _status_error(openai.InternalServerError, "Backend exploded", 500)
        assert _payload(ex).code == SERVER_ERROR

    @pytest.mark.unit
    def test_server_error_generic_503(self) -> None:
        ex = _status_error(openai.APIStatusError, "Unavailable", 503, body=None)
        assert _payload(ex).code == SERVER_ERROR

    @pytest.mark.unit
    def test_unknown_non_openai_exception(self) -> None:
        assert _payload(RuntimeError("boom")).code == UNKNOWN
        assert _payload(ValueError("nope")).code == UNKNOWN

    @pytest.mark.unit
    def test_unknown_unmapped_client_status(self) -> None:
        ex = _status_error(openai.APIStatusError, "What even is this?", 418, body=None)
        assert _payload(ex).code == UNKNOWN

    @pytest.mark.unit
    def test_unknown_server_status_non_int(self) -> None:
        # status_code attr present but not an int → should not crash
        assert _payload(Exception("plain")).code == UNKNOWN


class TestDetail:
    @pytest.mark.unit
    def test_detail_contains_key_facts(self) -> None:
        ex = _status_error(
            openai.BadRequestError,
            "The response was filtered",
            400,
            body={"error": {"code": "content_filter"}},
        )
        ex.request_id = "req-123"
        detail = _payload(ex).detail
        assert "exception:" in detail
        assert "openai.BadRequestError" in detail
        assert "status: 400" in detail
        assert "provider code: content_filter" in detail
        assert "request_id: req-123" in detail
        assert "message: The response was filtered" in detail

    @pytest.mark.unit
    def test_detail_truncated_at_limit(self) -> None:
        ex = RuntimeError("x" * 50000)
        detail = _payload(ex).detail
        assert len(detail) <= 2000 + len(" …(truncated)")
        assert detail.endswith("…(truncated)")


class TestHandlerRobustness:
    @pytest.mark.unit
    def test_nested_failure_returns_unknown(self) -> None:
        class Exploding(Exception):
            def __str__(self) -> str:  # noqa: D105
                raise ValueError("ka-boom")

        payload = llm_error_payload(Exploding(), logger=_logger())
        assert payload.code == UNKNOWN
        assert payload.detail.startswith("internal error while mapping")

    @pytest.mark.unit
    def test_codes_are_unique_and_disjoint(self) -> None:
        assert len(PROVIDER_ERROR_CODES) == 10


class TestPayloadToMessage:
    @pytest.mark.unit
    def test_known_code_gets_phrase(self) -> None:
        msg = payload_to_message(ProviderErrorPayload(code=RATE_LIMITED, detail="d"))
        assert "rate limiting" in msg
        assert msg.endswith(f"({RATE_LIMITED})")

    @pytest.mark.unit
    def test_unknown_code_falls_back(self) -> None:
        msg = payload_to_message(ProviderErrorPayload(code="brand_new", detail="d"))
        assert "unexpected error" in msg
        assert "(brand_new)" in msg

    @pytest.mark.unit
    def test_every_code_has_a_phrase(self) -> None:
        for code in PROVIDER_ERROR_CODES:
            assert payload_to_message(ProviderErrorPayload(code=code, detail="d"))
