"""Unit tests for ConversationRepository against in-memory SQLite.

No model endpoint or network involved — pure persistence-layer validation.
"""

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.conversation_repo import ConversationRepository
from database.models import Message

USER_A = "user-a"
USER_B = "user-b"


@pytest.mark.asyncio
async def test_create_without_messages(db_session: AsyncSession) -> None:
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A, title="First")
    await db_session.commit()

    assert conv.id
    assert conv.user_id == USER_A
    assert conv.title == "First"
    assert conv.favorite is False
    assert conv.messages == []


@pytest.mark.asyncio
async def test_create_with_initial_messages(db_session: AsyncSession) -> None:
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
async def test_list_for_user_orders_by_updated_desc_and_isolates(db_session: AsyncSession) -> None:
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
async def test_get_for_user_cross_user_returns_none(db_session: AsyncSession) -> None:
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A, title="secret")
    await db_session.commit()

    assert await repo.get_for_user(conv.id, USER_B) is None
    assert await repo.get_for_user("does-not-exist", USER_A) is None


@pytest.mark.asyncio
async def test_append_message_sequences_are_monotonic(db_session: AsyncSession) -> None:
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
async def test_append_message_retries_on_sequence_collision(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A concurrent writer that grabs the computed sequence first must not lose
    the turn: the insert collides on uq_message_sequence, then append_message
    recomputes and retries. Exercises the real SAVEPOINT rollback + in-memory
    collection cleanup path.
    """
    repo = ConversationRepository(db_session)
    conv = await repo.create(
        user_id=USER_A, messages=[("user", "u0"), ("assistant", "a1")]
    )
    await db_session.commit()  # real next sequence is now 2

    real_scalar = db_session.scalar
    calls = {"n": 0}

    async def flaky_scalar(*args: object, **kwargs: object) -> object:
        calls["n"] += 1
        if calls["n"] == 1:
            # Simulate a racing writer: hand back an already-used sequence so
            # the first INSERT collides on uq_message_sequence.
            return 1
        return await real_scalar(*args, **kwargs)

    monkeypatch.setattr(db_session, "scalar", flaky_scalar)

    msg = await repo.append_message(conv.id, USER_A, role="user", content="u2")
    await db_session.commit()

    assert msg is not None
    assert msg.sequence == 2  # recomputed after the collision
    assert calls["n"] >= 2  # collided once, then retried

    fetched = await repo.get_for_user(conv.id, USER_A)
    assert [(m.sequence, m.content) for m in fetched.messages] == [
        (0, "u0"),
        (1, "a1"),
        (2, "u2"),
    ]


@pytest.mark.asyncio
async def test_append_message_cross_user_returns_none(db_session: AsyncSession) -> None:
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A)
    await db_session.commit()

    assert (
        await repo.append_message(conv.id, USER_B, role="user", content="x") is None
    )


@pytest.mark.asyncio
async def test_create_with_client_supplied_id(db_session: AsyncSession) -> None:
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A, conversation_id="fixed-id-42")
    await db_session.commit()

    assert conv.id == "fixed-id-42"
    assert await repo.get_for_user("fixed-id-42", USER_A) is not None


@pytest.mark.asyncio
async def test_replace_messages_overwrites_and_resequences(db_session: AsyncSession) -> None:
    repo = ConversationRepository(db_session)
    conv = await repo.create(
        user_id=USER_A,
        messages=[("user", "u1"), ("assistant", "a1"), ("user", "u2")],
    )
    await db_session.commit()

    # Replace with a shorter history (mirrors a client-side rollback).
    replaced = await repo.replace_messages(
        conv.id, USER_A, [("user", "u1"), ("assistant", "a1-regenerated")]
    )
    await db_session.commit()
    assert replaced is not None

    fetched = await repo.get_for_user(conv.id, USER_A)
    assert [(m.sequence, m.role, m.content) for m in fetched.messages] == [
        (0, "user", "u1"),
        (1, "assistant", "a1-regenerated"),
    ]

    # A subsequent append continues from the new max sequence (no collision).
    appended = await repo.append_message(
        conv.id, USER_A, role="user", content="u2-again"
    )
    await db_session.commit()
    assert appended is not None and appended.sequence == 2


@pytest.mark.asyncio
async def test_replace_messages_cross_user_returns_none(db_session: AsyncSession) -> None:
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A, messages=[("user", "hi")])
    await db_session.commit()

    assert await repo.replace_messages(conv.id, USER_B, [("user", "x")]) is None
    # The original message is untouched.
    fetched = await repo.get_for_user(conv.id, USER_A)
    assert [m.content for m in fetched.messages] == ["hi"]


@pytest.mark.asyncio
async def test_update_meta(db_session: AsyncSession) -> None:
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
async def test_delete_cascades_messages_and_enforces_ownership(db_session: AsyncSession) -> None:
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
