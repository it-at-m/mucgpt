"""Add administrator-managed assistant tool grants

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-27 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assistant_tool_grants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assistant_id", sa.String(length=36), nullable=False),
        sa.Column("tool_id", sa.String(length=255), nullable=False),
        sa.Column("granted_by", sa.String(length=255), nullable=False),
        sa.Column("granted_at", sa.DateTime(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("revoked_by", sa.String(length=255), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["assistant_id"], ["assistants.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("assistant_id", "tool_id", name="uq_assistant_tool_grant"),
    )


def downgrade() -> None:
    op.drop_table("assistant_tool_grants")
