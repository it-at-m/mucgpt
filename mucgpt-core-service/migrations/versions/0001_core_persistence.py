"""Create core-owned persistence tables and retire legacy orphan state."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_core_persistence"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # This first revision is deliberately safe for databases created before
    # Alembic was introduced. It both bootstraps fresh databases and adopts
    # existing core-owned tables without requiring a manual stamp operation.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "chats" not in tables:
        op.create_table(
            "chats",
            sa.Column("conversation_id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("assistant_id", sa.String(), nullable=True),
            sa.Column(
                "chat_title", sa.String(), server_default="New Chat", nullable=False
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("conversation_id"),
        )

    if "canvas_documents" not in tables:
        op.create_table(
            "canvas_documents",
            sa.Column("conversation_id", sa.String(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column(
                "revisions", postgresql.JSONB(astext_type=sa.Text()), nullable=True
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("conversation_id"),
        )

    chat_columns = {column["name"] for column in sa.inspect(bind).get_columns("chats")}
    if "deleted_at" not in chat_columns:
        op.add_column(
            "chats", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)
        )

    checkpoint_tables = {"checkpoints", "checkpoint_writes", "checkpoint_blobs"}
    if checkpoint_tables.issubset(set(sa.inspect(bind).get_table_names())):
        op.execute(
            "INSERT INTO chats (conversation_id, user_id, deleted_at) "
            "SELECT thread_id, '', now() FROM ("
            "SELECT thread_id FROM checkpoints UNION "
            "SELECT thread_id FROM checkpoint_writes UNION "
            "SELECT thread_id FROM checkpoint_blobs) AS legacy "
            "ON CONFLICT (conversation_id) DO NOTHING"
        )
        for table in ("checkpoints", "checkpoint_writes", "checkpoint_blobs"):
            op.execute(
                f"DELETE FROM {table} WHERE thread_id IN "
                "(SELECT conversation_id FROM chats WHERE user_id = '' AND deleted_at IS NOT NULL)"
            )


def downgrade() -> None:
    op.drop_table("canvas_documents")
    op.drop_table("chats")
