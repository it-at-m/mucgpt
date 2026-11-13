"""Add assistant version compliance check result

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-28 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "assistant_versions",
        sa.Column("compliance_check_result", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("assistant_versions", "compliance_check_result")
