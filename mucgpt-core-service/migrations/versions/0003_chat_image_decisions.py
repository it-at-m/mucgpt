"""Add image decision lists to chats: approved and rejected image URLs per conversation."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_chat_image_decisions"
down_revision: str | None = "0002_documents_and_store"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    columns = {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns("chats")
    }
    for column in ("approved_images", "rejected_images"):
        if column not in columns:
            op.add_column(
                "chats",
                sa.Column(
                    column,
                    sa.JSON(),
                    nullable=False,
                    server_default="[]",
                ),
            )


def downgrade() -> None:
    op.drop_column("chats", "rejected_images")
    op.drop_column("chats", "approved_images")
