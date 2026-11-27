"""Preserve scan coverage and scan failures. Older rows have unknown coverage."""

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
    op.add_column(
        "documents",
        sa.Column(
            "sensitivity_scan_failed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("documents", "sensitivity_scan_failed")
    op.drop_column("documents", "sensitivity_truncated")
