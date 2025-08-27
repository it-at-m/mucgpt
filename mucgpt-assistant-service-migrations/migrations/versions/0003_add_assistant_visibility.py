"""Add visibility flag to assistants

Revision ID: 0003
Revises: 0002
Create Date: 2025-08-07 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_visible column to assistants table with default=True
    op.add_column(
        "assistants",
        sa.Column(
            "is_visible", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")
        ),
    )


def downgrade() -> None:
    # Drop is_visible column from assistants table
    op.drop_column("assistants", "is_visible")
