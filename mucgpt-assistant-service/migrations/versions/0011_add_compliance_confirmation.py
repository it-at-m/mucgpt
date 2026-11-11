"""Add assistant version compliance confirmation

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-04 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "assistant_versions",
        sa.Column(
            "compliance_confirmation",
            sa.Boolean(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("assistant_versions", "compliance_confirmation")
