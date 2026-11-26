"""Preserve scan coverage. Older rows have unknown coverage."""

import sqlalchemy as sa
from alembic import op

revision = "0004_scan_coverage"
down_revision = "0003_document_sensitivity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents", sa.Column("sensitivity_truncated", sa.Boolean(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("documents", "sensitivity_truncated")
