from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from starlette.requests import Request

from api.api_models import ChatCompletionRequest
from api.routers import chat_router
from core import document_service, virtual_file_system_helper
from core.auth_models import AuthenticationResult
from core.document_service import (
    DocumentSelection,
    DocumentUnavailableError,
    InvalidDocumentSelectionError,
)
from database import document_catalog, document_repo


@pytest.fixture
def user_info():
    return AuthenticationResult(user_id="owner", token="test", department="shared")


def completion_request(**kwargs):
    return ChatCompletionRequest(
        messages=[{"role": "user", "content": "Read the attachment"}],
        conversation_id="conversation",
        **kwargs,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("fields", [{}, {"document_ids": []}])
async def test_empty_selection_skips_catalog(monkeypatch, user_info, fields):
    factory = MagicMock(side_effect=AssertionError("No catalog access expected"))
    monkeypatch.setattr(
        document_catalog.DocumentCatalogManager, "get_session_factory", factory
    )
    assert (
        await virtual_file_system_helper.get_documents_for_agent(
            completion_request(**fields), user_info
        )
        == []
    )
    factory.assert_not_called()


@pytest.mark.parametrize("document_ids", [None, "an-id", [123]])
def test_document_ids_require_a_list_of_strings(document_ids):
    with pytest.raises(ValidationError):
        completion_request(document_ids=document_ids)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error, status_code",
    [
        (None, None),
        (InvalidDocumentSelectionError("Invalid IDs"), 400),
        (DocumentUnavailableError("Documents unavailable"), 404),
    ],
)
async def test_selection_uses_authenticated_service_and_closes_session(
    monkeypatch, user_info, error, status_code
):
    session_context = MagicMock()
    session = session_context.__aenter__.return_value
    factory = MagicMock(return_value=session_context)
    monkeypatch.setattr(
        document_catalog.DocumentCatalogManager,
        "get_session_factory",
        MagicMock(return_value=factory),
    )
    repository = MagicMock()
    monkeypatch.setattr(document_repo, "DocumentRepository", repository)
    documents = (SimpleNamespace(id="authorized-id", path="/documents/authorized.txt"),)
    resolver = AsyncMock(
        return_value=DocumentSelection(documents=documents, unavailable_ids=()),
        side_effect=error,
    )
    service = MagicMock(
        return_value=SimpleNamespace(resolve_selected_documents=resolver)
    )
    monkeypatch.setattr(document_service, "DocumentService", service)
    request = completion_request(document_ids=["requested-id"])

    if error:
        with pytest.raises(HTTPException) as exc:
            await virtual_file_system_helper.get_documents_for_agent(request, user_info)
        assert exc.value.status_code == status_code
        assert exc.value.detail == str(error)
    else:
        assert await virtual_file_system_helper.get_documents_for_agent(
            request, user_info
        ) == list(documents)

    repository.assert_called_once_with(session)
    service.assert_called_once_with(repository.return_value)
    resolver.assert_awaited_once_with(user_info, request.document_ids)
    session_context.__aexit__.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", ["v1", "v2"])
@pytest.mark.parametrize("persist", [False, True])
@pytest.mark.parametrize("rejected", [False, True])
async def test_endpoints_resolve_before_persistence_and_pass_authorized_selection(
    monkeypatch, user_info, endpoint, persist, rejected
):
    request = completion_request(document_ids=["requested-id"], persist=persist)
    documents = [SimpleNamespace(id="authorized-id")]
    calls = []

    async def resolve(*args):
        calls.append("selection")
        assert args == (request, user_info)
        if rejected:
            raise HTTPException(status_code=404, detail="Documents unavailable")
        return documents

    async def prepare(*args):
        calls.append("persistence")
        return request.messages

    monkeypatch.setattr(chat_router.ModelRegistry, "get_model", MagicMock())
    monkeypatch.setattr(chat_router, "get_documents_for_agent", resolve)
    monkeypatch.setattr(chat_router, "get_messages_for_agent", prepare)
    save = AsyncMock()
    monkeypatch.setattr(chat_router, "_save_document_selection", save)
    agent = MagicMock(run_without_streaming=AsyncMock(return_value="response"))
    init = AsyncMock(return_value=agent)
    monkeypatch.setattr(chat_router, "init_agent", init)
    if endpoint == "v1":
        result = chat_router.chat_endpoint(request, user_info)
    else:
        result = chat_router.ag_ui_chat_endpoint(
            request, user_info, Request({"type": "http", "headers": []})
        )

    if rejected:
        with pytest.raises(HTTPException) as exc:
            await result
        assert exc.value.status_code == 404
        assert calls == ["selection"]
        init.assert_not_awaited()
        save.assert_not_awaited()
    else:
        await result
        assert calls == ["selection", "persistence"]
        save.assert_awaited_once_with(request, user_info.user_id, ["authorized-id"])
        init.assert_awaited_once_with(
            user_info=user_info,
            model_name=request.model,
            persist=persist,
            document_selection=documents,
        )
