"""ContextMiddleware image hydration gating and copy semantics."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain.agents.middleware import ModelRequest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.runtime import Runtime

from agent.middleware import (
    ContextMiddleware,
    RequestContext,
    _ahydrate_image_request,
    _hydrate_image_request,
)
from core.image_hydration import ImageHydrationError, ImageHydrator

MANAGED_URL = "mucgpt-image://11111111-1111-4111-8111-111111111111"
DATA_URI = "data:image/png;base64,aGVsbG8="


@pytest.fixture(autouse=True)
def vision_registry(monkeypatch: pytest.MonkeyPatch):
    from config.model_provider import ModelRegistry

    monkeypatch.setattr(
        ModelRegistry, "get_model", lambda model_name=None, logger=None: object()
    )
    monkeypatch.setattr(
        ModelRegistry,
        "is_vision_model",
        lambda model_name=None: model_name == "vision-model",
    )


def managed_message():
    return HumanMessage(
        content=[
            {"type": "text", "text": "hi"},
            {"type": "image_url", "image_url": {"url": MANAGED_URL}},
        ]
    )


def make_hydrator():
    hydrator = MagicMock(spec=ImageHydrator)
    hydrator.hydrate_messages = AsyncMock(
        side_effect=lambda messages: [
            (
                message.model_copy(
                    update={
                        "content": [
                            block
                            for block in message.content
                            if block.get("type") != "image_url"
                        ]
                        + [
                            {
                                "type": "image_url",
                                "image_url": {"url": DATA_URI},
                            }
                        ]
                    }
                )
                if isinstance(message.content, list)
                else message
            )
            for message in messages
        ]
    )
    return hydrator


def make_request(context: RequestContext | None):
    return ModelRequest(
        model=FakeListChatModel(responses=["ok"]),
        messages=[managed_message()],
        tools=[],
        state={"messages": []},
        runtime=Runtime(context=context),
    )


@pytest.mark.asyncio
async def test_hydration_replaces_references_on_a_copy():
    context = RequestContext(
        model_name="vision-model",
        image_hydrator=make_hydrator(),
    )
    request = make_request(context)
    original = request.messages[0]

    hydrated = await _ahydrate_image_request(request)

    hydrated_message = hydrated.messages[0]
    assert hydrated_message.content[1]["image_url"]["url"] == DATA_URI
    # The graph-state message object keeps the managed reference.
    assert original.content[1]["image_url"]["url"] == MANAGED_URL


@pytest.mark.asyncio
async def test_hydration_fails_closed_for_non_vision_models():
    context = RequestContext(
        model_name="text-model",
        image_hydrator=make_hydrator(),
    )
    request = make_request(context)

    with pytest.raises(ImageHydrationError, match="does not support image input"):
        await _ahydrate_image_request(request)


@pytest.mark.asyncio
async def test_hydration_fails_closed_without_hydrator_context():
    request = make_request(RequestContext(model_name="vision-model"))

    with pytest.raises(ImageHydrationError, match="not available"):
        await _ahydrate_image_request(request)


@pytest.mark.asyncio
async def test_hydration_skips_text_only_requests():
    request = ModelRequest(
        model=FakeListChatModel(responses=["ok"]),
        messages=[HumanMessage(content="plain")],
        tools=[],
        state={"messages": []},
        runtime=Runtime(context=RequestContext()),
    )

    hydrated = await _ahydrate_image_request(request)
    assert hydrated.messages[0].content == "plain"


def test_sync_model_calls_fail_closed_on_managed_images():
    request = make_request(None)

    with pytest.raises(ImageHydrationError, match="unavailable"):
        _hydrate_image_request(request)


def test_sync_model_calls_pass_through_text_only():
    request = ModelRequest(
        model=FakeListChatModel(responses=["ok"]),
        messages=[HumanMessage(content="plain")],
        tools=[],
        state={"messages": []},
        runtime=Runtime(context=None),
    )

    hydrated = _hydrate_image_request(request)
    assert hydrated.messages[0].content == "plain"


@pytest.mark.asyncio
async def test_contextmiddleware_awaits_hydration_before_handler():
    """End-to-end through awrap_model_call: handler sees the data URI."""
    handler = AsyncMock()
    context = RequestContext(
        model_name="vision-model",
        langfuse_prompt=None,
        image_hydrator=make_hydrator(),
    )
    request = ModelRequest(
        model=FakeListChatModel(responses=["ok"]),
        messages=[managed_message()],
        system_message=SystemMessage(content="system"),
        tools=[],
        state={"messages": []},
        runtime=Runtime(context=context),
    )
    middleware = ContextMiddleware(state_schema=type("S", (), {}))
    middleware.document_context = ""

    await middleware.awrap_model_call(request, handler)

    effective = handler.call_args.args[0]
    assert effective.messages[0].content[1]["image_url"]["url"] == DATA_URI
