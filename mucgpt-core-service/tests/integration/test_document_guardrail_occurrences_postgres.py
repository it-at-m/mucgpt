"""PostgreSQL migration coverage for document guardrail occurrences."""

import json
import os

import psycopg
import pytest
from psycopg.conninfo import make_conninfo
from tests.postgres import isolated_postgres_database, migrate_database

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not os.getenv("MUCGPT_LIFECYCLE_POSTGRES_HOST"),
        reason="real PostgreSQL opt-in required",
    ),
]


@pytest.mark.asyncio
async def test_guardrail_occurrence_migration_preserves_legacy_findings() -> None:
    """Legacy aggregate findings remain available without invented offsets."""
    async with isolated_postgres_database(
        prefix="guardrail_occurrences_", migrate=False
    ) as database:
        await migrate_database(
            database.server, database.name, revision="0005_document_guardrails"
        )
        legacy_findings = [
            {"category": "iban", "kind": "pii", "confidence": "certain", "count": 2}
        ]
        async with await psycopg.AsyncConnection.connect(
            make_conninfo(**database.connection_args, dbname=database.name)
        ) as connection:
            await connection.execute(
                """
                INSERT INTO documents (
                    id, user_id, slot, filename, mime_type, original_size,
                    storage_key, status, sensitive_content_findings,
                    sensitive_content_scan_truncated, sensitive_content_scan_failed
                ) VALUES (
                    'legacy-incomplete', 'legacy-user', 0, 'legacy.txt', 'text/plain',
                    1, 'legacy-incomplete', 'processing', %s::json, true, false
                ), (
                    'legacy-failed', 'legacy-user', 1, 'failed.txt', 'text/plain',
                    1, 'legacy-failed', 'processing', NULL, NULL, true
                )
                """,
                (json.dumps(legacy_findings),),
            )
            await connection.commit()

        await migrate_database(database.server, database.name)

        async with await psycopg.AsyncConnection.connect(
            make_conninfo(**database.connection_args, dbname=database.name)
        ) as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT id, guardrails FROM documents ORDER BY slot"
                )
                rows = await cursor.fetchall()
                await cursor.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'documents'
                    """
                )
                columns = {row[0] for row in await cursor.fetchall()}

    assert rows == [
        (
            "legacy-incomplete",
            {
                "sensitive_content": {
                    "legacy_findings": legacy_findings,
                    "occurrences": None,
                    "confirmed_at": None,
                    "coverage": "incomplete",
                }
            },
        ),
        (
            "legacy-failed",
            {
                "sensitive_content": {
                    "legacy_findings": None,
                    "occurrences": None,
                    "confirmed_at": None,
                    "coverage": "failed",
                }
            },
        ),
    ]
    assert (
        not {
            "sensitive_content_findings",
            "sensitive_content_acknowledged_at",
            "sensitive_content_scan_truncated",
            "sensitive_content_scan_failed",
        }
        & columns
    )
