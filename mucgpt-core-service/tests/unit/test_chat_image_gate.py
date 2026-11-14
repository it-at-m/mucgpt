"""Unit tests for the chat image binding gate (chat_router)."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from api.api_models import ChatCompletionMessage, ChatCompletionRequest
from api.routers import chat_router
from core.auth_models import AuthenticationResult
from database.image_repo import (
    ImageAlreadyBoundError,
    ImageConversationUnavailableError,
    ImageUnavailableError,
)

MANAGED_URL = "mucgpt-image://11111111-1111-4111-8111-111111111111"
USER = AuthenticationResult(
    user_id="owner",
    user_name="owner",
    token="t",
    department="TEAM/1",
    roles=[],
)


def image_request(*urls: str, persist: bool = True) -> ChatCompletionRequest:
    request = ChatCompletionRequest(
        messages=[ChatCompletionMessage(role="user", content="Describe this")],
        conversation_id="conv-1",
        persist=persist,
    )
    request.messages[-1]._media_blocks = [
        {"type": "image_url", "image_url": {"url": url}} for url in urls
    ]
    return request


def enabled_settings(enabled: bool):
    return SimpleNamespace(image_input=SimpleNamespace(enabled=enabled))


@pytest.mark.asyncio
async def test_request_without_media_blocks_is_a_noop():
    request = ChatCompletionRequest(
        messages=[ChatCompletionMessage(role="user", content="plain text")],
        conversation_id="conv-1",
    )
    with patch.object(chat_router, "bind_chat_images", AsyncMock()) as binder:
        await chat_router.bind_or_verify_chat_images(request, USER)
    binder.assert_not_awaited()


@pytest.mark.asyncio
async def test_inline_data_urls_are_not_treated_as_managed_images():
    request = image_request("data:image/png;base64,QUJD")
    with patch.object(chat_router, "bind_chat_images", AsyncMock()) as binder:
        await chat_router.bind_or_verify_chat_images(request, USER)
    binder.assert_not_awaited()


@pytest.mark.asyncio
async def test_disabled_image_input_fails_closed():
    request = image_request(MANAGED_URL)
    with (
        patch.object(chat_router, "get_settings", lambda: enabled_settings(False)),
        pytest.raises(HTTPException) as exc,
    ):
        await chat_router.bind_or_verify_chat_images(request, USER)
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_persisted_request_binds_and_stateless_verifies():
    request = image_request(MANAGED_URL, persist=True)
    with (
        patch.object(chat_router, "get_settings", lambda: enabled_settings(True)),
        patch.object(
            chat_router, "bind_chat_images", AsyncMock(return_value=1)
        ) as binder,
    ):
        await chat_router.bind_or_verify_chat_images(request, USER)
    binder.assert_awaited_once_with(USER, "conv-1", ["11111111-1111-4111-8111-111111111111"])

    stateless = image_request(MANAGED_URL, persist=False)
    with (
        patch.object(chat_router, "get_settings", lambda: enabled_settings(True)),
        patch.object(
            chat_router, "verify_unbound_chat_images", AsyncMock(return_value=1)
        ) as verifier,
    ):
        await chat_router.bind_or_verify_chat_images(stateless, USER)
    verifier.assert_awaited_once_with(
        USER, ["11111111-1111-4111-8111-111111111111"]
    )


@pytest.mark.asyncio
async def test_repository_errors_map_to_http_failures():
    cases = [
        (ImageUnavailableError("gone"), 404),
        (ImageAlreadyBoundError("bound elsewhere"), 409),
        (ImageConversationUnavailableError("no chat"), 403),
    ]
    for error, status in cases:
        request = image_request(MANAGED_URL)
        with (
            patch.object(chat_router, "get_settings", lambda: enabled_settings(True)),
            patch.object(chat_router, "bind_chat_images", AsyncMock(side_effect=error)),
            pytest.raises(HTTPException) as exc,
        ):
            await chat_router.bind_or_verify_chat_images(request, USER)
        assert exc.value.status_code == status
