"""Rename document sensitivity storage for the guardrails model."""

from alembic import op

revision = "0005_document_guardrails"
down_revision = "0004_scan_coverage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "documents",
        "sensitivity_findings",
        new_column_name="sensitive_content_findings",
    )
    op.alter_column(
        "documents",
        "sensitivity_acknowledged_at",
        new_column_name="sensitive_content_acknowledged_at",
    )
    op.alter_column(
        "documents",
        "sensitivity_truncated",
        new_column_name="sensitive_content_scan_truncated",
    )
    op.alter_column(
        "documents",
        "sensitivity_scan_failed",
        new_column_name="sensitive_content_scan_failed",
    )


def downgrade() -> None:
    op.alter_column(
        "documents",
        "sensitive_content_scan_failed",
        new_column_name="sensitivity_scan_failed",
    )
    op.alter_column(
        "documents",
        "sensitive_content_scan_truncated",
        new_column_name="sensitivity_truncated",
    )
    op.alter_column(
        "documents",
        "sensitive_content_acknowledged_at",
        new_column_name="sensitivity_acknowledged_at",
    )
    op.alter_column(
        "documents",
        "sensitive_content_findings",
        new_column_name="sensitivity_findings",
    )
