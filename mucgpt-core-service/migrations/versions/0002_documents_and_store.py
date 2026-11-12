"""Create document catalog and LangGraph store tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0002_documents_and_store"
down_revision: str | None = "0001_core_persistence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # These columns are part of the chat metadata model but were introduced
    # after the initial core persistence migration.
    op.execute(
        "ALTER TABLE chats ADD COLUMN IF NOT EXISTS "
        "document_ids json NOT NULL DEFAULT '[]'"
    )
    op.execute(
        "ALTER TABLE chats ADD COLUMN IF NOT EXISTS "
        "document_names json NOT NULL DEFAULT '{}'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id varchar NOT NULL,
            user_id varchar NOT NULL,
            slot integer NOT NULL,
            filename varchar NOT NULL,
            mime_type varchar NOT NULL,
            original_size integer NOT NULL,
            text_length integer,
            preview varchar,
            preview_kind varchar,
            storage_key varchar NOT NULL,
            status varchar NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT documents_pkey PRIMARY KEY (id),
            CONSTRAINT uq_documents_user_slot UNIQUE (user_id, slot),
            CONSTRAINT ck_documents_slot CHECK (slot >= 0 AND slot < 10),
            CONSTRAINT ck_documents_status CHECK (
                status IN ('processing', 'ready', 'deleting')
            ),
            CONSTRAINT ck_documents_original_size CHECK (original_size >= 0),
            CONSTRAINT ck_documents_ready_metadata CHECK (
                status != 'ready'
                OR (
                    text_length IS NOT NULL
                    AND text_length > 0
                    AND preview IS NOT NULL
                    AND preview_kind IS NOT NULL
                    AND preview_kind = 'initial_excerpt'
                )
            )
        )
        """
    )

    # Keep the pinned LangGraph store schema under Alembic control instead of
    # allowing every application pod to run setup() with schema privileges.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS store_migrations (
            v integer PRIMARY KEY
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS store (
            prefix text NOT NULL,
            key text NOT NULL,
            value jsonb NOT NULL,
            created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (prefix, key)
        )
        """
    )
    op.execute(
        """
        ALTER TABLE store
        ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
        ADD COLUMN IF NOT EXISTS ttl_minutes integer
        """
    )

    # LangGraph's store migration versions are internal to the dependency and
    # must be marked applied after reproducing its schema changes.
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS store_prefix_idx "
            "ON store USING btree (prefix text_pattern_ops)"
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_store_expires_at ON store (expires_at) "
            "WHERE expires_at IS NOT NULL"
        )

    for version in range(4):
        op.execute(
            "INSERT INTO store_migrations (v) VALUES "
            f"({version}) ON CONFLICT (v) DO NOTHING"
        )


def downgrade() -> None:
    raise RuntimeError(
        "Cannot safely downgrade core document/store persistence: this migration "
        "adopts pre-Alembic tables and may contain production data."
    )
