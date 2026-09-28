from unittest.mock import AsyncMock, Mock

import pytest
from sqlalchemy.dialects import postgresql

from database.conversation_repo import ConversationRepository


def _compiled(statement) -> str:
    return str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_user_upsert_refreshes_only_the_owner() -> None:
    session = AsyncMock()
    session.execute.side_effect = [
        Mock(),
        Mock(scalar_one_or_none=Mock(return_value=True)),
    ]
    repository = ConversationRepository(session)

    assert await repository.verify_user_in_conversation("owner", "conversation")

    statement = session.execute.await_args_list[0].args[0]
    sql = _compiled(statement)
    assert "ON CONFLICT (conversation_id) DO UPDATE" in sql
    assert "WHERE chats.user_id = excluded.user_id" in sql
    assert "updated_at = now()" in sql


@pytest.mark.unit
@pytest.mark.asyncio
async def test_title_upsert_is_guarded_by_owner() -> None:
    session = AsyncMock()
    session.execute.return_value = Mock(
        scalar_one_or_none=Mock(return_value="conversation")
    )
    repository = ConversationRepository(session)

    assert await repository.set_chat_title_for_conversation(
        "conversation", "owner", "A title"
    )

    statement = session.execute.await_args.args[0]
    sql = _compiled(statement)
    assert "chat_title = excluded.chat_title" in sql
    assert "WHERE chats.user_id = excluded.user_id" in sql
    assert "RETURNING chats.conversation_id" in sql


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_is_scoped_to_owner() -> None:
    session = AsyncMock()
    session.execute.return_value = Mock(
        scalar_one_or_none=Mock(return_value="conversation")
    )
    repository = ConversationRepository(session)

    assert await repository.delete_conversation_mapping("conversation", "owner")

    sql = _compiled(session.execute.await_args.args[0])
    assert "DELETE FROM chats" in sql
    assert "chats.conversation_id = 'conversation'" in sql
    assert "chats.user_id = 'owner'" in sql
