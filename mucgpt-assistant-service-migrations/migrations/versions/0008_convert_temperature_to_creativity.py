"""Convert temperature to creativity

Revision ID: 0008
Revises: 0007
Create Date: 2026-01-28 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new creativity column with default value
    op.add_column(
        "assistant_versions",
        sa.Column("creativity", sa.String(10), nullable=True, server_default="normal"),
    )
    
    # Convert existing temperature values to creativity levels
    # Low temperature (0.0 - 0.4) -> "aus"
    # Medium temperature (0.4 - 0.8) -> "normal"
    # High temperature (0.8 - 2.0) -> "hoch"
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE assistant_versions
            SET creativity = CASE
                WHEN temperature < 0.4 THEN 'aus'
                WHEN temperature >= 0.8 THEN 'hoch'
                ELSE 'normal'
            END
            """
        )
    )
    
    # Make creativity non-nullable
    op.alter_column("assistant_versions", "creativity", nullable=False)
    
    # Drop the old temperature column
    op.drop_column("assistant_versions", "temperature")


def downgrade() -> None:
    # Add back temperature column
    op.add_column(
        "assistant_versions",
        sa.Column("temperature", sa.Float(), nullable=True, server_default="0.7"),
    )
    
    # Convert creativity levels back to temperature values
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE assistant_versions
            SET temperature = CASE
                WHEN creativity = 'aus' THEN 0.0
                WHEN creativity = 'hoch' THEN 1.0
                ELSE 0.7
            END
            """
        )
    )
    
    # Make temperature non-nullable
    op.alter_column("assistant_versions", "temperature", nullable=False)
    
    # Drop the creativity column
    op.drop_column("assistant_versions", "creativity")
