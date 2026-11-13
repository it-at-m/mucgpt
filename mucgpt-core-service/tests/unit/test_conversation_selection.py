from contextlib import asynccontextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from fastapi import HTTPException, Request
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from api.api_models import ChatCompletionMessage, ChatCompletionRequest
from api.routers import chat_router
from core.auth_models import AuthenticationResult
from core.persistance_helpers import PersistanceHelpers
from database.database_models import Chat, Document


@pytest.fixture
def catalog(monkeypatch):
    engine = create_engine("sqlite://")
    Chat.__table__.create(engine)
    with Session(engine) as session:
        session.add_all(
            [
                Chat(
                    conversation_id="owned", user_id="owner", document_ids=["previous"]
                ),
                Chat(
                    conversation_id="foreign",
                    user_id="other",
                    document_ids=["previous"],
                ),
                Chat(
                    conversation_id="retired",
                    user_id="owner",
                    deleted_at=datetime.now(UTC),
                    document_ids=["previous"],
                ),
            ]
        )
        session.commit()

    @asynccontextmanager
    async def scope():
        with Session(engine) as session, session.begin():
            yield Mock(execute=AsyncMock(side_effect=session.execute))

    factory = Mock(side_effect=scope, begin=scope)
    monkeypatch.setattr(PersistanceHelpers, "_session_factory", factory)
    yield engine
    engine.dispose()


def request(conversation_id="owned", *, persist=True, ids=()):
    return ChatCompletionRequest(
        conversation_id=conversation_id,
        persist=persist,
        stream=False,
        messages=[ChatCompletionMessage(role="user", content="Question")],
        document_ids=list(ids),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("ids", [[], [str(uuid4())]])
async def test_agui_saves_validated_selection_and_explicit_empty(
    catalog, monkeypatch, ids
):
    selection = [
        SimpleNamespace(id=document_id, filename="Policy.pdf") for document_id in ids
    ]
    monkeypatch.setattr(chat_router.ModelRegistry, "get_model", Mock())
    monkeypatch.setattr(
        chat_router, "get_documents_for_agent", AsyncMock(return_value=selection)
    )
    monkeypatch.setattr(
        chat_router, "get_messages_for_agent", AsyncMock(return_value=[])
    )
    monkeypatch.setattr(
        chat_router, "get_temperature_from_request", Mock(return_value=0.5)
    )

    async def events(**_):
        if False:
            yield

    agent = Mock(
        run_without_streaming=AsyncMock(return_value="answer"),
        run_agui_with_streaming=events,
    )
    monkeypatch.setattr(chat_router, "init_agent", AsyncMock(return_value=agent))
    owner = AuthenticationResult(user_id="owner", token="test", department="test")
    await chat_router.ag_ui_chat_endpoint(
        request(ids=ids), owner, Request({"type": "http", "headers": []})
    )
    metadata = await PersistanceHelpers.get_conversations_for_user("owner")
    assert (
        next(row for row in metadata if row["conversation_id"] == "owned")[
            "document_ids"
        ]
        == ids
    )
    with Session(catalog) as session:
        assert session.get(Chat, "owned").document_names == {
            document_id: "Policy.pdf" for document_id in ids
        }
        assert session.get(Chat, "foreign").document_ids == ["previous"]


@pytest.mark.asyncio
@pytest.mark.parametrize("conversation_id", ["foreign", "retired", "missing"])
async def test_selection_write_does_not_claim_foreign_missing_or_retired_rows(
    catalog, conversation_id
):
    with pytest.raises(HTTPException) as error:
        await chat_router._save_document_selection(
            request(conversation_id), "owner", []
        )
    assert error.value.status_code == 403
    with Session(catalog) as session:
        row = session.get(Chat, conversation_id)
        assert row is None or row.document_ids == ["previous"]


@pytest.mark.asyncio
async def test_stateless_request_does_not_change_saved_selection(catalog):
    await chat_router._save_document_selection(request(persist=False), "owner", [])
    with Session(catalog) as session:
        assert session.get(Chat, "owned").document_ids == ["previous"]


@pytest.mark.asyncio
async def test_deleted_document_keeps_filename_until_detached(catalog):
    Document.__table__.create(catalog)
    document_id = str(uuid4())
    with Session(catalog) as session:
        session.add(
            Document(
                id=document_id,
                user_id="owner",
                slot=0,
                filename="Policy.pdf",
                mime_type="application/pdf",
                original_size=5,
                storage_key=f"/{document_id}.txt",
                status="processing",
            )
        )
        session.commit()
    await chat_router._save_document_selection(
        request(), "owner", [document_id], {document_id: "Policy.pdf"}
    )
    with Session(catalog) as session:
        session.delete(session.get(Document, document_id))
        session.commit()
    metadata = await PersistanceHelpers.get_conversations_for_user("owner")
    owned = next(row for row in metadata if row["conversation_id"] == "owned")
    assert owned["document_ids"] == [document_id]
    assert owned["document_names"] == {document_id: "Policy.pdf"}
    await chat_router._save_document_selection(request(), "owner", [])
    with Session(catalog) as session:
        assert session.get(Chat, "owned").document_names == {}
