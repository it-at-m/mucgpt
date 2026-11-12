from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain.agents.middleware import ModelRequest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.runtime import Runtime

from agent import middleware
from agent.middleware import ContextMiddleware, RequestContext
from core.document_service import SelectedDocument


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize("assistant_id", [None, "assistant"])
async def test_document_context_reaches_effective_prompt_without_state_changes(
    monkeypatch, asynchronous, assistant_id
):
    model = FakeListChatModel(responses=["ok"])
    monkeypatch.setattr(middleware.ModelRegistry, "get_model", lambda *_: model)
    monkeypatch.setattr(
        middleware.ModelRegistry,
        "normalize_model_settings",
        lambda _, settings: settings,
    )
    monkeypatch.setattr(middleware, "_annotate_span_with_policy_state", MagicMock())
    policy = MagicMock()
    policy.select_tools.return_value = []
    policy.modify_system_message.side_effect = lambda request: request
    policy.amodify_system_message = AsyncMock(side_effect=lambda request: request)
    monkeypatch.setattr(middleware, "get_policy_for_state", lambda _: policy)
    request = ModelRequest(
        model=model,
        messages=[HumanMessage(content="Question")],
        system_message=SystemMessage(content="Effective assistant prompt"),
        tools=[],
        state={"messages": []},
        runtime=Runtime(context=RequestContext(assistant_id=assistant_id)),
    )
    handler = AsyncMock() if asynchronous else MagicMock()
    settings = SimpleNamespace(documents=SimpleNamespace(preview_max_chars=16))
    get_settings = MagicMock(return_value=settings)
    monkeypatch.setattr(middleware, "get_settings", get_settings)
    get_prompt = MagicMock(return_value="Document instructions from Langfuse")
    monkeypatch.setattr(middleware.PromptPool, "get_prompt", get_prompt)
    document = SelectedDocument(
        id="12345678-1234-4234-8234-123456789abc",
        filename="Policy.pdf",
        mime_type="application/pdf",
        original_size=1,
        text_length=50000,
        preview="Selected preview",
        preview_kind="text",
        path="/documents/12345678-1234-4234-8234-123456789abc.txt",
        created_at=datetime.now(UTC),
    )
    selection = [document]
    context = ContextMiddleware(document_selection=selection)
    selection.clear()
    get_settings.assert_called_once_with()
    get_prompt.assert_called_once_with("document_instructions")
    for _ in range(2):
        if asynchronous:
            await context.awrap_model_call(request, handler)
        else:
            context.wrap_model_call(request, handler)
        effective = handler.call_args.args[0]
        assert "Effective assistant prompt" in effective.system_message.text
        assert "Document instructions from Langfuse" in effective.system_message.text
        assert effective.system_message.text.count("Selected preview") == 1
        assert document.path in effective.system_message.text
        assert "not included" not in effective.system_message.text
        assert effective.messages == request.messages
        assert effective.state == request.state
    assert request.system_message is not None
    assert request.system_message.content == "Effective assistant prompt"


@pytest.mark.parametrize("selection", [None, []])
def test_empty_selection_skips_context_construction(monkeypatch, selection):
    get_settings = MagicMock(side_effect=AssertionError("No settings access expected"))
    monkeypatch.setattr(middleware, "get_settings", get_settings)
    get_prompt = MagicMock(side_effect=AssertionError("No prompt lookup expected"))
    monkeypatch.setattr(middleware.PromptPool, "get_prompt", get_prompt)
    assert ContextMiddleware(document_selection=selection).document_context == ""
    get_settings.assert_not_called()
    get_prompt.assert_not_called()
