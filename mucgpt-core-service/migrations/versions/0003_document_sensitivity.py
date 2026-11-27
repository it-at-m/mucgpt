"""Store sensitivity scan findings and their acknowledgement on documents."""

from collections.abc import Sequence

from alembic import op

revision: str = "0003_document_sensitivity"
down_revision: str | None = "0002_documents_and_store"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # NULL findings mean "not scanned"; existing documents stay usable without
    # an acknowledgement because they were never flagged.
    op.execute(
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS sensitivity_findings json"
    )
    op.execute(
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS "
        "sensitivity_acknowledged_at timestamp with time zone"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE documents DROP COLUMN IF EXISTS sensitivity_acknowledged_at"
    )
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS sensitivity_findings")
