from unittest.mock import Mock

import pytest
from sqlalchemy.dialects import postgresql

from core.persistance_helpers import _ensure_chat_schema
from database.database_models import Base


@pytest.mark.unit
def test_ensure_chat_schema_adds_only_missing_columns(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection = Mock()
    connection.dialect = postgresql.dialect()
    monkeypatch.setattr(Base.metadata, "create_all", Mock())
    monkeypatch.setattr(
        "core.persistance_helpers.inspect",
        Mock(
            return_value=Mock(
                get_columns=Mock(return_value=[{"name": "conversation_id"}])
            )
        ),
    )

    _ensure_chat_schema(connection)

    Base.metadata.create_all.assert_called_once()
    assert connection.exec_driver_sql.call_args_list == [
        (("ALTER TABLE chats ADD COLUMN IF NOT EXISTS user_id VARCHAR NOT NULL",),),
        (
            (
                "ALTER TABLE chats ADD COLUMN IF NOT EXISTS "
                "chat_title VARCHAR DEFAULT 'New Chat' NOT NULL",
            ),
        ),
        (
            (
                "ALTER TABLE chats ADD COLUMN IF NOT EXISTS "
                "created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL",
            ),
        ),
        (
            (
                "ALTER TABLE chats ADD COLUMN IF NOT EXISTS "
                "updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL",
            ),
        ),
    ]


@pytest.mark.unit
def test_ensure_chat_schema_does_not_alter_complete_table(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection = Mock()
    connection.dialect = postgresql.dialect()
    monkeypatch.setattr(Base.metadata, "create_all", Mock())
    monkeypatch.setattr(
        "core.persistance_helpers.inspect",
        Mock(
            return_value=Mock(
                get_columns=Mock(
                    return_value=[
                        {"name": "conversation_id"},
                        {"name": "user_id"},
                        {"name": "chat_title"},
                        {"name": "created_at"},
                        {"name": "updated_at"},
                    ]
                )
            )
        ),
    )

    _ensure_chat_schema(connection)

    connection.exec_driver_sql.assert_not_called()
