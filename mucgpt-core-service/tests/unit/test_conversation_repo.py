"""Unit tests for ConversationRepository against in-memory SQLite.

No model endpoint or network involved — pure persistence-layer validation.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.conversation_repo import (
    ConversationDeletedError,
    ConversationRepository,
)
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
async def test_soft_delete_retains_row_and_messages_and_enforces_ownership(db_session: AsyncSession) -> None:
    repo = ConversationRepository(db_session)
    conv = await repo.create(
        user_id=USER_A, messages=[("user", "a"), ("assistant", "b")]
    )
    await db_session.commit()

    # Cross-user delete is refused.
    assert await repo.delete(conv.id, USER_B) is False

    assert await repo.delete(conv.id, USER_A) is True
    await db_session.commit()

    # The chat reads as gone from every normal path...
    assert await repo.get_for_user(conv.id, USER_A) is None
    assert all(c.id != conv.id for c in await repo.list_for_user(USER_A))

    # ...but soft delete retains the row and its messages (hidden with the
    # parent; the retention sweep removes both together later).
    tombstoned = await repo._get_any(conv.id, USER_A)
    assert tombstoned is not None and tombstoned.deleted_at is not None
    remaining = await db_session.scalar(
        select(func.count()).select_from(Message)
    )
    assert remaining == 2


@pytest.mark.asyncio
async def test_delete_is_idempotent_and_preserves_first_timestamp(db_session: AsyncSession) -> None:
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A, title="temp")
    await db_session.commit()

    assert await repo.delete(conv.id, USER_A) is True
    await db_session.commit()
    first_ts = (await repo._get_any(conv.id, USER_A)).deleted_at

    # Deleting an already-tombstoned chat is a no-op that still returns True and
    # does not re-stamp deleted_at (so the retention/cursor window is stable).
    assert await repo.delete(conv.id, USER_A) is True
    await db_session.commit()
    assert (await repo._get_any(conv.id, USER_A)).deleted_at == first_ts


@pytest.mark.asyncio
async def test_create_with_tombstoned_id_is_rejected_not_resurrected(db_session: AsyncSession) -> None:
    repo = ConversationRepository(db_session)
    await repo.create(
        user_id=USER_A, conversation_id="ghost", messages=[("user", "hi")]
    )
    await db_session.commit()
    assert await repo.delete("ghost", USER_A) is True
    await db_session.commit()

    with pytest.raises(ConversationDeletedError):
        await repo.create(user_id=USER_A, conversation_id="ghost")

    # Nothing was written: the row stays tombstoned with its original message.
    still = await repo._get_any("ghost", USER_A)
    assert still is not None and still.deleted_at is not None
    assert [m.content for m in still.messages] == ["hi"]

    # A brand-new id is unaffected by the guard.
    fresh = await repo.create(user_id=USER_A, conversation_id="brand-new")
    await db_session.commit()
    assert fresh.id == "brand-new"


@pytest.mark.asyncio
async def test_writes_to_tombstoned_id_fail_closed(db_session: AsyncSession) -> None:
    repo = ConversationRepository(db_session)
    conv = await repo.create(user_id=USER_A, messages=[("user", "hi")])
    await db_session.commit()
    assert await repo.delete(conv.id, USER_A) is True
    await db_session.commit()

    # Both writes go through get_for_user, which now hides the tombstone, so a
    # deleted chat can never be appended to or rewritten.
    assert await repo.replace_messages(conv.id, USER_A, [("user", "x")]) is None
    assert (
        await repo.append_message(conv.id, USER_A, role="user", content="x")
        is None
    )


@pytest.mark.asyncio
async def test_list_deleted_for_user_filters_and_respects_since(db_session: AsyncSession) -> None:
    repo = ConversationRepository(db_session)
    live = await repo.create(user_id=USER_A, conversation_id="live")
    c1 = await repo.create(user_id=USER_A, conversation_id="d1")
    c2 = await repo.create(user_id=USER_A, conversation_id="d2")
    other = await repo.create(user_id=USER_B, conversation_id="d-other")
    await db_session.commit()

    # Stamp explicit, distinct timestamps: func.now() on SQLite is only
    # second-granularity, so two deletes in one test can collide and make the
    # `since` cursor flake. Setting them directly keeps the ordering crisp.
    t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    (await repo._get_any("d1", USER_A)).deleted_at = t0
    (await repo._get_any("d2", USER_A)).deleted_at = t0 + timedelta(minutes=5)
    (await repo._get_any("d-other", USER_B)).deleted_at = t0
    await db_session.flush()
    await db_session.commit()
    assert live.id and c1.id and c2.id and other.id  # silence unused warnings

    # Full feed: only the user's tombstones, oldest-deleted first; live + other
    # user's tombstone never leak.
    deleted = await repo.list_deleted_for_user(USER_A)
    assert [c.id for c in deleted] == ["d1", "d2"]

    # since-cursor: only tombstones strictly newer than the cursor come back.
    newer = await repo.list_deleted_for_user(USER_A, since=t0)
    assert [c.id for c in newer] == ["d2"]
