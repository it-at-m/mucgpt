"""Add default_model column to assistant_versions table

Revision ID: 0006
Revises: 0005
Create Date: 2026-01-13 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add default_model column to assistant_versions table."""
    op.add_column(
        "assistant_versions",
        sa.Column("default_model", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    """Remove default_model column from assistant_versions table."""
    op.drop_column("assistant_versions", "default_model")
