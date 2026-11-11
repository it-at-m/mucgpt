"""Create core-owned persistence and LangGraph checkpoint tables."""

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

    # This is the schema supplied by langgraph-checkpoint-postgres 3.2.0.
    # Keep it in Alembic so runtime Pods only need data access privileges.
    if "checkpoint_migrations" not in tables:
        op.create_table(
            "checkpoint_migrations",
            sa.Column("v", sa.Integer(), nullable=False),
            sa.PrimaryKeyConstraint("v"),
        )
    if "checkpoints" not in tables:
        op.create_table(
            "checkpoints",
            sa.Column("thread_id", sa.Text(), nullable=False),
            sa.Column("checkpoint_ns", sa.Text(), server_default="", nullable=False),
            sa.Column("checkpoint_id", sa.Text(), nullable=False),
            sa.Column("parent_checkpoint_id", sa.Text(), nullable=True),
            sa.Column("type", sa.Text(), nullable=True),
            sa.Column("checkpoint", postgresql.JSONB(), nullable=False),
            sa.Column(
                "metadata", postgresql.JSONB(), server_default="{}", nullable=False
            ),
            sa.PrimaryKeyConstraint("thread_id", "checkpoint_ns", "checkpoint_id"),
        )
    if "checkpoint_blobs" not in tables:
        op.create_table(
            "checkpoint_blobs",
            sa.Column("thread_id", sa.Text(), nullable=False),
            sa.Column("checkpoint_ns", sa.Text(), server_default="", nullable=False),
            sa.Column("channel", sa.Text(), nullable=False),
            sa.Column("version", sa.Text(), nullable=False),
            sa.Column("type", sa.Text(), nullable=False),
            sa.Column("blob", sa.LargeBinary(), nullable=True),
            sa.PrimaryKeyConstraint("thread_id", "checkpoint_ns", "channel", "version"),
        )
    if "checkpoint_writes" not in tables:
        op.create_table(
            "checkpoint_writes",
            sa.Column("thread_id", sa.Text(), nullable=False),
            sa.Column("checkpoint_ns", sa.Text(), server_default="", nullable=False),
            sa.Column("checkpoint_id", sa.Text(), nullable=False),
            sa.Column("task_id", sa.Text(), nullable=False),
            sa.Column("idx", sa.Integer(), nullable=False),
            sa.Column("channel", sa.Text(), nullable=False),
            sa.Column("type", sa.Text(), nullable=True),
            sa.Column("blob", sa.LargeBinary(), nullable=False),
            sa.Column("task_path", sa.Text(), server_default="", nullable=False),
            sa.PrimaryKeyConstraint(
                "thread_id", "checkpoint_ns", "checkpoint_id", "task_id", "idx"
            ),
        )

    checkpoint_tables = {"checkpoints", "checkpoint_writes", "checkpoint_blobs"}
    checkpoint_write_columns = {
        column["name"] for column in sa.inspect(bind).get_columns("checkpoint_writes")
    }
    if "task_path" not in checkpoint_write_columns:
        op.add_column(
            "checkpoint_writes",
            sa.Column("task_path", sa.Text(), server_default="", nullable=False),
        )

    # PostgreSQL requires concurrent index creation outside a transaction.
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS checkpoints_thread_id_idx "
            "ON checkpoints(thread_id)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS checkpoint_blobs_thread_id_idx "
            "ON checkpoint_blobs(thread_id)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS checkpoint_writes_thread_id_idx "
            "ON checkpoint_writes(thread_id)"
        )

    # AsyncPostgresSaver.setup() uses this table to track the vendor migrations.
    # Mark the schema above as complete so a third-party caller cannot rerun it.
    for version in range(10):
        op.execute(
            sa.text(
                "INSERT INTO checkpoint_migrations (v) VALUES (:version) "
                "ON CONFLICT (v) DO NOTHING"
            ).bindparams(version=version)
        )

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
    op.drop_table("checkpoint_writes")
    op.drop_table("checkpoint_blobs")
    op.drop_table("checkpoints")
    op.drop_table("checkpoint_migrations")
    op.drop_table("canvas_documents")
    op.drop_table("chats")
