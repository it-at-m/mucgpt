"""Tests for the temporary browser chat import (app/chat_migration)."""

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock, Mock, patch

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.store.memory import InMemoryStore
from sqlalchemy import Table, create_engine, select
from sqlalchemy.orm import Session

import init_app
from chat_migration.models import ConversationImportRequest
from chat_migration.service import ImportConflictError, import_chat
from core.auth_models import AuthenticationResult
from core.lf_prompts import ResolvedPrompt
from core.persistance_helpers import PersistanceHelpers
from database.database_models import Chat
from init_app import init_agent

LAST_EDITED = datetime(2025, 3, 1, 12, 0, tzinfo=UTC)


@pytest.fixture
def saver(monkeypatch):
    saver = InMemorySaver()
    monkeypatch.setattr(PersistanceHelpers, "_checkpointer", saver)
    return saver


@pytest.fixture
def chats(monkeypatch):
    """sqlite chats table behind PersistanceHelpers' session factory."""
    engine = create_engine("sqlite://")
    cast("Table", Chat.__table__).create(engine)

    @asynccontextmanager
    async def scope():
        with Session(engine) as session, session.begin():
            yield Mock(execute=AsyncMock(side_effect=session.execute))

    factory = Mock(side_effect=scope, begin=scope)
    monkeypatch.setattr(PersistanceHelpers, "_session_factory", factory)
    yield engine
    engine.dispose()


def _add_row(engine, conversation_id="chat-1", user_id="owner", assistant_id=None):
    with Session(engine) as session:
        session.add(
            Chat(
                conversation_id=conversation_id,
                user_id=user_id,
                assistant_id=assistant_id,
            )
        )
        session.commit()


def _row(engine, conversation_id="chat-1") -> Chat:
    with Session(engine) as session:
        return session.execute(
            select(Chat).where(Chat.conversation_id == conversation_id)
        ).scalar_one()


def _ownership(monkeypatch, *, owned: bool, claimable: bool = True):
    """Postgres upserts don't run on sqlite, so ownership is faked."""
    verify = AsyncMock(return_value=claimable)
    monkeypatch.setattr(
        PersistanceHelpers, "is_user_in_conversation", AsyncMock(return_value=owned)
    )
    monkeypatch.setattr(PersistanceHelpers, "verify_user_in_conversation", verify)
    return verify


def _request(**overrides) -> ConversationImportRequest:
    data = {
        "conversation_id": "chat-1",
        "title": "Kita Gebühren",
        "assistant_id": "assistant-1",
        "last_edited": LAST_EDITED,
        "turns": [
            {"user": "q1", "assistant": "a1"},
            {"user": "q2", "assistant": "a2"},
        ],
    }
    return ConversationImportRequest.model_validate({**data, **overrides})


async def _stored_messages(saver, conversation_id="chat-1"):
    checkpoint = await saver.aget_tuple(
        RunnableConfig(configurable={"thread_id": conversation_id})
    )
    assert checkpoint is not None
    return checkpoint.checkpoint["channel_values"]["messages"]


def _texts(messages):
    return [(type(m).__name__, m.text) for m in messages]


@pytest.mark.asyncio
async def test_new_chat_is_imported(monkeypatch, saver, chats):
    verify = _ownership(monkeypatch, owned=False)
    # the real claim creates the row, here it already sits in sqlite
    _add_row(chats)

    assert await import_chat(_request(), "owner") == "imported"

    verify.assert_awaited_once_with("owner", "chat-1", "assistant-1")
    history = await PersistanceHelpers.get_conversation_messages("chat-1")
    assert [(m.role, m.content) for m in history] == [
        ("user", "q1"),
        ("assistant", "a1"),
        ("user", "q2"),
        ("assistant", "a2"),
    ]
    stored = await _stored_messages(saver)
    assert not any(isinstance(m, SystemMessage) for m in stored)

    row = _row(chats)
    assert row.chat_title == "Kita Gebühren"
    assert row.assistant_id == "assistant-1"
    assert row.updated_at.replace(tzinfo=None) == LAST_EDITED.replace(tzinfo=None)


@pytest.mark.asyncio
async def test_existing_assistant_id_is_kept(monkeypatch, saver, chats):
    _ownership(monkeypatch, owned=True)
    _add_row(chats, assistant_id="original")

    assert await import_chat(_request(), "owner") == "imported"

    assert _row(chats).assistant_id == "original"


@pytest.mark.asyncio
async def test_chat_with_checkpoint_is_skipped(monkeypatch, saver, chats):
    verify = _ownership(monkeypatch, owned=True)
    _add_row(chats)
    await import_chat(_request(), "owner")
    title_before = _row(chats).chat_title

    result = await import_chat(
        _request(title="Other", turns=[{"user": "x", "assistant": "y"}]), "owner"
    )

    assert result == "skipped"
    # no claim, so the history order is not touched either
    verify.assert_not_awaited()
    assert _texts(await _stored_messages(saver))[0] == ("HumanMessage", "q1")
    assert _row(chats).chat_title == title_before


@pytest.mark.asyncio
async def test_foreign_or_deleted_id_is_rejected(monkeypatch, saver, chats):
    _ownership(monkeypatch, owned=False, claimable=False)

    with pytest.raises(ImportConflictError):
        await import_chat(_request(), "owner")

    assert (
        await saver.aget_tuple(RunnableConfig(configurable={"thread_id": "chat-1"}))
        is None
    )


@pytest.mark.asyncio
async def test_owned_row_without_checkpoint_is_imported(monkeypatch, saver, chats):
    # e.g. a retry after the checkpoint write failed, or a title-only row
    verify = _ownership(monkeypatch, owned=True)
    _add_row(chats)

    assert await import_chat(_request(), "owner") == "imported"

    verify.assert_not_awaited()
    assert len(await _stored_messages(saver)) == 4


class _RecordingModel(GenericFakeChatModel):
    """Fake model that remembers what it was sent."""

    seen: list = []

    def bind_tools(self, tools, **kwargs):
        return self

    async def _agenerate(self, messages, *args, **kwargs):
        self.seen.append(list(messages))
        return await super()._agenerate(messages, *args, **kwargs)


@pytest.mark.asyncio
@patch("agent.tools.tools.ToolCollection.get_tools", new_callable=AsyncMock)
async def test_imported_chat_can_be_continued(
    mock_get_tools, monkeypatch, saver, chats
):
    _ownership(monkeypatch, owned=True)
    _add_row(chats)
    await import_chat(_request(), "owner")

    model = _RecordingModel(messages=iter([AIMessage("a3")]))
    model.seen = []
    mock_get_tools.return_value = []
    monkeypatch.setattr(
        "config.model_provider.ModelRegistry.get_model", lambda *_a, **_k: model
    )
    monkeypatch.setattr(
        "agent.deep_agent.PromptPool.get_resolved_prompt",
        lambda _name, _folder=None: ResolvedPrompt(content="default instruction"),
    )
    monkeypatch.setattr(init_app.FileStoreManager, "get_store", InMemoryStore)
    user = AuthenticationResult(token="token", user_id="owner", department="dep")
    config = RunnableConfig(configurable={"thread_id": "chat-1", "user_info": user})

    executor = await init_agent(user)
    await executor.agent.graph.ainvoke(
        {"messages": [SystemMessage("assistant prompt"), HumanMessage("q3")]},
        config=config,
    )

    sent = _texts(model.seen[-1])
    assert sent[-6:] == [
        ("SystemMessage", "assistant prompt"),
        ("HumanMessage", "q1"),
        ("AIMessage", "a1"),
        ("HumanMessage", "q2"),
        ("AIMessage", "a2"),
        ("HumanMessage", "q3"),
    ]
