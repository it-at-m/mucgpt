"""Add immutable assistant audit events.

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-27 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assistant_audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assistant_id", sa.String(length=36), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("actor_user_id", sa.String(length=255), nullable=False),
        sa.Column("actor_name", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("before", sa.JSON(), nullable=True),
        sa.Column("after", sa.JSON(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("assistant_version", sa.Integer(), nullable=True),
        sa.UniqueConstraint("occurred_at", "id", name="uq_assistant_audit_order"),
    )
    op.create_index(
        "ix_assistant_audit_events_assistant_id",
        "assistant_audit_events",
        ["assistant_id"],
    )
    op.create_index(
        "ix_assistant_audit_events_occurred_at",
        "assistant_audit_events",
        ["occurred_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_assistant_audit_events_occurred_at", table_name="assistant_audit_events"
    )
    op.drop_index(
        "ix_assistant_audit_events_assistant_id", table_name="assistant_audit_events"
    )
    op.drop_table("assistant_audit_events")
