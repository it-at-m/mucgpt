"""Unit tests for ConversationRepository against in-memory SQLite.

No model endpoint or network involved — pure persistence-layer validation.
"""

import pytest
from sqlalchemy import func, select

from database.conversation_repo import ConversationRepository
from database.models import Message

USER_A = "user-a"
USER_B = "user-b"


@pytest.mark.asyncio
async def test_create_without_messages(db_session):
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A, title="First")
    await db_session.commit()

    assert conv.id
    assert conv.user_id == USER_A
    assert conv.title == "First"
    assert conv.favorite is False
    assert conv.messages == []


@pytest.mark.asyncio
async def test_create_with_initial_messages(db_session):
    repo = ConversationRepository(db_session)
    conv = await repo.create(
        user_id=USER_A,
        title="Seeded",
        messages=[("system", "be nice"), ("user", "hi"), ("assistant", "hello")],
    )
    await db_session.commit()

    fetched = await repo.get_for_user(conv.id, USER_A)
    assert [(m.sequence, m.role) for m in fetched.messages] == [
        (0, "system"),
        (1, "user"),
        (2, "assistant"),
    ]


@pytest.mark.asyncio
async def test_list_for_user_orders_by_updated_desc_and_isolates(db_session):
    repo = ConversationRepository(db_session)
    c1 = await repo.create(user_id=USER_A, title="A1")
    c2 = await repo.create(user_id=USER_A, title="A2")
    await repo.create(user_id=USER_B, title="B1")
    await db_session.commit()

    # Touch c1 so it becomes most-recently-updated.
    await repo.append_message(c1.id, USER_A, role="user", content="ping")
    await db_session.commit()

    listed = await repo.list_for_user(USER_A)
    assert [c.title for c in listed] == ["A1", "A2"]
    # User B's conversation is never visible to user A.
    assert all(c.user_id == USER_A for c in listed)
    assert {c.id for c in listed} == {c1.id, c2.id}


@pytest.mark.asyncio
async def test_get_for_user_cross_user_returns_none(db_session):
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A, title="secret")
    await db_session.commit()

    assert await repo.get_for_user(conv.id, USER_B) is None
    assert await repo.get_for_user("does-not-exist", USER_A) is None


@pytest.mark.asyncio
async def test_append_message_sequences_are_monotonic(db_session):
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A)
    await db_session.commit()

    for i in range(4):
        msg = await repo.append_message(
            conv.id, USER_A, role="user", content=f"m{i}"
        )
        assert msg is not None
    await db_session.commit()

    fetched = await repo.get_for_user(conv.id, USER_A)
    assert [m.sequence for m in fetched.messages] == [0, 1, 2, 3]


@pytest.mark.asyncio
async def test_append_message_cross_user_returns_none(db_session):
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A)
    await db_session.commit()

    assert (
        await repo.append_message(conv.id, USER_B, role="user", content="x") is None
    )


@pytest.mark.asyncio
async def test_update_meta(db_session):
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A, title="old")
    await db_session.commit()

    updated = await repo.update_meta(conv.id, USER_A, title="new", favorite=True)
    await db_session.commit()
    assert updated.title == "new"
    assert updated.favorite is True

    # favorite=None leaves the value unchanged (PATCH semantics).
    again = await repo.update_meta(conv.id, USER_A, title="newer", favorite=None)
    assert again.title == "newer"
    assert again.favorite is True

    assert await repo.update_meta(conv.id, USER_B, title="hacked") is None


@pytest.mark.asyncio
async def test_delete_cascades_messages_and_enforces_ownership(db_session):
    repo = ConversationRepository(db_session)
    conv = await repo.create(
        user_id=USER_A, messages=[("user", "a"), ("assistant", "b")]
    )
    await db_session.commit()

    # Cross-user delete is refused.
    assert await repo.delete(conv.id, USER_B) is False

    assert await repo.delete(conv.id, USER_A) is True
    await db_session.commit()

    assert await repo.get_for_user(conv.id, USER_A) is None
    remaining = await db_session.scalar(
        select(func.count()).select_from(Message)
    )
    assert remaining == 0
