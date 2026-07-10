"""Add cached owner profile columns

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-02 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "owners", sa.Column("display_name", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "owners", sa.Column("given_name", sa.String(length=255), nullable=True)
    )
    op.add_column("owners", sa.Column("surname", sa.String(length=255), nullable=True))
    op.add_column("owners", sa.Column("mail", sa.String(length=255), nullable=True))
    op.add_column(
        "owners", sa.Column("organizational_unit", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "owners", sa.Column("details_updated_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("owners", "details_updated_at")
    op.drop_column("owners", "organizational_unit")
    op.drop_column("owners", "mail")
    op.drop_column("owners", "surname")
    op.drop_column("owners", "given_name")
    op.drop_column("owners", "display_name")
