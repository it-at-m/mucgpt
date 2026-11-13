"""Shared helpers for tests that call router endpoints directly."""

from typing import Any
from unittest.mock import AsyncMock

from starlette.requests import Request


def request_with_body(body: Any) -> Request:
    """A Request whose JSON body is ``body`` (no ASGI receive needed).

    The chat endpoint parses the raw body itself (legacy envelope or native
    AG-UI run input), so direct endpoint tests supply the body here.
    """
    request = Request({"type": "http", "headers": []})
    request.json = AsyncMock(return_value=body)
    return request
