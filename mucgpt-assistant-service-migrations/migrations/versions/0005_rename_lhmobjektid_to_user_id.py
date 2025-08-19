"""Rename lhmobjektID to user_id across all tables

Revision ID: 0005
Revises: 0004
Create Date: 2025-08-19 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop foreign key constraints first to avoid constraint issues during column rename
    op.drop_constraint(
        "assistant_owners_lhmobjektID_fkey", "assistant_owners", type_="foreignkey"
    )

    # Drop the unique constraint that references the old column name
    op.drop_constraint("uq_assistant_owner", "assistant_owners", type_="unique")
    op.drop_constraint("uq_subscription", "subscriptions", type_="unique")

    # Rename columns in all affected tables
    # 1. Rename primary key column in owners table
    op.alter_column("owners", "lhmobjektID", new_column_name="user_id")

    # 2. Rename foreign key column in assistant_owners table
    op.alter_column("assistant_owners", "lhmobjektID", new_column_name="user_id")

    # 3. Rename column in subscriptions table
    op.alter_column("subscriptions", "lhmobjektID", new_column_name="user_id")

    # Recreate foreign key constraints with new column names
    op.create_foreign_key(
        "assistant_owners_user_id_fkey",
        "assistant_owners",
        "owners",
        ["user_id"],
        ["user_id"],
        ondelete="CASCADE",
    )

    # Recreate unique constraints with new column names
    op.create_unique_constraint(
        "uq_assistant_owner", "assistant_owners", ["assistant_id", "user_id"]
    )
    op.create_unique_constraint(
        "uq_subscription", "subscriptions", ["assistant_id", "user_id"]
    )


def downgrade() -> None:
    # Drop foreign key constraints first
    op.drop_constraint(
        "assistant_owners_user_id_fkey", "assistant_owners", type_="foreignkey"
    )

    # Drop the unique constraints
    op.drop_constraint("uq_assistant_owner", "assistant_owners", type_="unique")
    op.drop_constraint("uq_subscription", "subscriptions", type_="unique")

    # Rename columns back to original names
    # 1. Rename primary key column in owners table back
    op.alter_column("owners", "user_id", new_column_name="lhmobjektID")

    # 2. Rename foreign key column in assistant_owners table back
    op.alter_column("assistant_owners", "user_id", new_column_name="lhmobjektID")

    # 3. Rename column in subscriptions table back
    op.alter_column("subscriptions", "user_id", new_column_name="lhmobjektID")

    # Recreate foreign key constraints with original column names
    op.create_foreign_key(
        "assistant_owners_lhmobjektID_fkey",
        "assistant_owners",
        "owners",
        ["lhmobjektID"],
        ["lhmobjektID"],
        ondelete="CASCADE",
    )

    # Recreate unique constraints with original column names
    op.create_unique_constraint(
        "uq_assistant_owner", "assistant_owners", ["assistant_id", "lhmobjektID"]
    )
    op.create_unique_constraint(
        "uq_subscription", "subscriptions", ["assistant_id", "lhmobjektID"]
    )
