"""Move name from assistants_versions to assistants

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-08 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Add new name column to assistants table
    op.add_column(
        "assistants",
        sa.Column("name", sa.String(), nullable=True),
    )

    # Move existing name values from assistant_versions to assistants
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE assistants
            SET name = (
                SELECT name
                FROM assistant_versions
                WHERE assistant_versions.assistant_id = assistants.id
                ORDER BY assistant_versions.version DESC
                LIMIT 1
            )
            """
        )
    )

    # Handle duplicates by appending a unique suffix.
    # Grouped by the *normalized* name (lower + trim)
    connection.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY lower(trim(name))
                        ORDER BY created_at ASC, id ASC
                    ) AS rn
                FROM assistants
            )
            UPDATE assistants
            SET name = assistants.name || ' (' || ranked.rn || ')'
            FROM ranked
            WHERE assistants.id = ranked.id
              AND ranked.rn > 1
            """
        )
    )

    # Make name non-nullable
    op.alter_column("assistants", "name", nullable=False)

    # Enforce uniqueness on the normalized name (case- and whitespace-insensitive)
    op.execute(
        "CREATE UNIQUE INDEX uq_assistants_name_ci ON assistants (lower(trim(name)))"
    )

    # Drop the old name column from assistant_versions
    op.drop_column("assistant_versions", "name")

def downgrade() -> None:
    # Add name column back to assistant_versions
    op.add_column(
        "assistant_versions",
        sa.Column("name", sa.String(), nullable=True),
    )

    # Copy name back to every version of each assistant
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE assistant_versions
            SET name = assistants.name
            FROM assistants
            WHERE assistants.id = assistant_versions.assistant_id
            """
        )
    )

    # Make name non-nullable again
    op.alter_column("assistant_versions", "name", nullable=False)

    # Drop the unique index
    op.execute("DROP INDEX uq_assistants_name_ci")

    # Drop the name column from assistants
    op.drop_column("assistants", "name")
