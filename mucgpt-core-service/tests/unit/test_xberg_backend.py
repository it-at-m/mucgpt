"""Unit tests for XbergBackend response handling."""

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from config.settings import ParserBackendType
from parsing import xberg


def _backend(monkeypatch: pytest.MonkeyPatch, transport) -> xberg.XbergBackend:
    settings = xberg.get_settings().model_copy(
        update={"parser_backend": ParserBackendType.XBERG, "xberg_url": "http://xberg.test"}
    )
    monkeypatch.setattr(xberg, "get_settings", lambda: settings)
    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        xberg.httpx, "AsyncClient", lambda: real_client(transport=transport)
    )
    return xberg.XbergBackend()


def _upload() -> MagicMock:
    file = MagicMock()
    file.filename = "doc.pdf"
    file.content_type = "application/pdf"
    file.read = AsyncMock(return_value=b"PDF")
    return file


def _transport(handler) -> httpx.MockTransport:
    return httpx.MockTransport(handler)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("payload", "expected"),
    [
        ({"results": [{"content": "alpha"}, {"content": "beta"}]}, "alpha\n\nbeta"),
        ({"results": [{"content": "a"}, {"other": 1}, {}]}, "a"),  # empty contents dropped
        ([{"content": "legacy"}, {"content": "list"}], "legacy\n\nlist"),  # old shape
        ({}, ""),  # no results at all
        (
            {"results": [{"content": "ok"}], "errors": ["partial failure"]},
            "ok",
        ),  # errors logged, results kept
    ],
)
async def test_parse_payload_shapes(monkeypatch, payload, expected):
    backend = _backend(
        monkeypatch, _transport(lambda request: httpx.Response(200, json=payload))
    )
    file = _upload()

    result = await backend.parse(file)

    assert result == expected


@pytest.mark.asyncio
async def test_parse_unexpected_payload_shape_returns_empty(monkeypatch):
    backend = _backend(
        monkeypatch,
        _transport(lambda request: httpx.Response(200, json=42)),
    )

    assert await backend.parse(_upload()) == ""


@pytest.mark.asyncio
async def test_parse_error_response_raises(monkeypatch):
    backend = _backend(
        monkeypatch,
        _transport(lambda request: httpx.Response(500, text="boom")),
    )

    with pytest.raises(httpx.HTTPStatusError):
        await backend.parse(_upload())
