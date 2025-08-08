"""Add subscriptions_count column and backfill existing data

Revision ID: 0004
Revises: 0003
Create Date: 2025-08-08 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the counter column with default 0
    op.add_column(
        "assistants",
        sa.Column(
            "subscriptions_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    # Backfill existing data using portable SQL
    op.execute(
        """
        UPDATE assistants
        SET subscriptions_count = (
            SELECT COUNT(*)
            FROM subscriptions
            WHERE subscriptions.assistant_id = assistants.id
        )
        """
    )


def downgrade() -> None:
    # Drop the column
    op.drop_column("assistants", "subscriptions_count")
