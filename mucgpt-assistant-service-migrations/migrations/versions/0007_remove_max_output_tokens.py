"""Remove max_output_tokens from assistant_versions

Revision ID: 0007
Revises: 0006
Create Date: 2026-01-19 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop the max_output_tokens column from assistant_versions."""
    op.drop_column("assistant_versions", "max_output_tokens")


def downgrade() -> None:
    """Recreate the max_output_tokens column on assistant_versions."""
    op.add_column(
        "assistant_versions",
        sa.Column(
            "max_output_tokens",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1000"),
        ),
    )
    # Remove the server default to mirror the original schema
    op.alter_column(
        "assistant_versions",
        "max_output_tokens",
        server_default=None,
    )
