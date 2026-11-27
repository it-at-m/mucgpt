"""Store document guardrails as extensible, value-free metadata."""

from alembic import op

revision = "0006_guardrail_occurrences"
down_revision = "0005_document_guardrails"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS guardrails json")
    # Existing rows have only aggregate data. Preserve it as a legacy fallback;
    # no occurrence offsets can be safely reconstructed from it.
    op.execute(
        """
        UPDATE documents
        SET guardrails = json_build_object(
            'sensitive_content', json_build_object(
                'legacy_findings', sensitive_content_findings,
                'occurrences', NULL,
                'confirmed_at', sensitive_content_acknowledged_at,
                'coverage', CASE
                    WHEN sensitive_content_scan_failed THEN 'failed'
                    WHEN sensitive_content_scan_truncated THEN 'incomplete'
                    WHEN sensitive_content_findings IS NULL THEN 'unknown'
                    ELSE 'complete'
                END
            )
        )
        WHERE guardrails IS NULL
        """
    )
    op.drop_column("documents", "sensitive_content_scan_failed")
    op.drop_column("documents", "sensitive_content_scan_truncated")
    op.drop_column("documents", "sensitive_content_acknowledged_at")
    op.drop_column("documents", "sensitive_content_findings")


def downgrade() -> None:
    raise RuntimeError("Document guardrail metadata cannot be safely downgraded")
