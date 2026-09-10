"""Add immutable assistant version lifecycle state

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-09 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "assistant_versions",
        sa.Column(
            "state", sa.String(length=32), nullable=False, server_default="active"
        ),
    )
    op.add_column(
        "assistant_versions",
        sa.Column("state_changed_by", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "assistant_versions",
        sa.Column("state_change_reason", sa.Text(), nullable=True),
    )
    op.create_check_constraint(
        "ck_assistant_version_state",
        "assistant_versions",
        "state IN ('active', 'inactive', 'pending_legal_review')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_assistant_version_state", "assistant_versions", type_="check"
    )
    op.drop_column("assistant_versions", "state_change_reason")
    op.drop_column("assistant_versions", "state_changed_by")
    op.drop_column("assistant_versions", "state")
