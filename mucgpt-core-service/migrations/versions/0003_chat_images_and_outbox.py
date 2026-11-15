"""Create chat image catalog and deletion outbox tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0003_chat_images_and_outbox"
down_revision: str | Sequence[str] | None = "0002_documents_and_store"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_images (
            id varchar NOT NULL,
            owner_user_id varchar NOT NULL,
            bucket varchar NOT NULL,
            object_key varchar NOT NULL,
            mime_type varchar NOT NULL,
            size_bytes integer NOT NULL,
            sha256 varchar NOT NULL,
            original_filename varchar NOT NULL,
            width integer,
            height integer,
            status varchar NOT NULL,
            conversation_id varchar,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            ready_at timestamp with time zone,
            expires_at timestamp with time zone,
            bound_at timestamp with time zone,
            CONSTRAINT chat_images_pkey PRIMARY KEY (id),
            CONSTRAINT uq_chat_images_object UNIQUE (bucket, object_key),
            CONSTRAINT ck_chat_images_status CHECK (
                status IN ('uploading', 'ready', 'deleting')
            ),
            CONSTRAINT ck_chat_images_size CHECK (size_bytes >= 0),
            CONSTRAINT ck_chat_images_binding CHECK (
                conversation_id IS NULL OR bound_at IS NOT NULL
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chat_images_owner_user_id "
        "ON chat_images (owner_user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chat_images_conversation_id "
        "ON chat_images (conversation_id)"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS image_deletion_outbox (
            id varchar NOT NULL,
            bucket varchar NOT NULL,
            object_key varchar NOT NULL,
            reason varchar NOT NULL,
            attempts integer DEFAULT 0 NOT NULL,
            next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
            lease_until timestamp with time zone,
            last_error varchar,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT image_deletion_outbox_pkey PRIMARY KEY (id),
            CONSTRAINT ck_image_deletion_outbox_reason CHECK (
                reason IN (
                    'draft_delete', 'upload_compensation', 'expired',
                    'conversation_deleted'
                )
            ),
            CONSTRAINT ck_image_deletion_outbox_attempts CHECK (attempts >= 0)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_image_deletion_outbox_due "
        "ON image_deletion_outbox (next_attempt_at)"
    )


def downgrade() -> None:
    raise RuntimeError(
        "Cannot safely downgrade chat image persistence: adopted tables may "
        "contain production data, and object bytes live outside the database."
    )
