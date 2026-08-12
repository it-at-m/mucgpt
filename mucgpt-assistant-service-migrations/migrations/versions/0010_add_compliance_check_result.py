"""Add assistant version compliance check result

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-28 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "assistant_versions",
        sa.Column("compliance_check_result", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("assistant_versions", "compliance_check_result")
