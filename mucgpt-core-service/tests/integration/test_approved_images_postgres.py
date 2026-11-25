"""Real PostgreSQL round-trip for the approved-images endpoint (opt-in).

Requires MUCGPT_LIFECYCLE_POSTGRES_HOST (see tests/postgres.py); each test
runs against its own migrated database, so the endpoint is exercised with
real persistence instead of mocked helpers.
"""

import os
import unittest
from uuid import uuid4

import psycopg
from fastapi import HTTPException
from psycopg.conninfo import make_conninfo
from tests.postgres import isolated_postgres_database

from api.api_models import ApprovedImagesUpsertRequest
from api.routers.chat_router import list_conversations, put_conversation_approved_images
from core.auth_models import AuthenticationResult
from core.persistance_helpers import PersistanceHelpers


@unittest.skipUnless(
    os.getenv("MUCGPT_LIFECYCLE_POSTGRES_HOST"), "real PostgreSQL opt-in required"
)
class ApprovedImagesPostgresTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.database_context = isolated_postgres_database(prefix="approved_images_")
        database = await self.database_context.__aenter__()
        self.addAsyncCleanup(self.database_context.__aexit__, None, None, None)
        self.connection_args = database.connection_args
        self.settings = database.settings
        self.owner = AuthenticationResult(
            user_id="owner-a", token="test", department="test"
        )
        self.other = AuthenticationResult(
            user_id="owner-b", token="test", department="test"
        )
        self.conversation_id = uuid4().hex
        await PersistanceHelpers.init(self.settings)
        self.addAsyncCleanup(PersistanceHelpers.close)
        await PersistanceHelpers.verify_user_in_conversation(
            self.owner.user_id, self.conversation_id
        )

    async def test_put_then_list_returns_persisted_decisions(self):
        approved = [
            "https://muenchen.test/logo.png",
            "https://example.test/plot.png?d=1",
        ]
        rejected = ["https://example.test/pixel.png?d=secret"]
        await put_conversation_approved_images(
            self.conversation_id,
            ApprovedImagesUpsertRequest(
                approved_images=approved, rejected_images=rejected
            ),
            self.owner,
        )

        conversations = await list_conversations(self.owner)
        persisted = [
            row for row in conversations if row.conversation_id == self.conversation_id
        ]
        self.assertEqual(1, len(persisted))
        self.assertEqual(approved, persisted[0].approved_images)
        self.assertEqual(rejected, persisted[0].rejected_images)
        self.assertEqual([], await list_conversations(self.other))

    async def test_put_is_rejected_for_foreign_users(self):
        request = ApprovedImagesUpsertRequest(approved_images=["https://x.test/a.png"])

        with self.assertRaises(HTTPException) as raised:
            await put_conversation_approved_images(
                self.conversation_id, request, self.other
            )

        self.assertEqual(403, raised.exception.status_code)
        self.assertEqual([], await list_conversations(self.other))

    async def test_erase_clears_the_persisted_lists(self):
        approved = ["https://muenchen.test/logo.png"]
        rejected = ["https://example.test/pixel.png?d=secret"]
        await put_conversation_approved_images(
            self.conversation_id,
            ApprovedImagesUpsertRequest(
                approved_images=approved, rejected_images=rejected
            ),
            self.owner,
        )

        self.assertEqual(
            "deleted",
            await PersistanceHelpers.erase_conversation(
                self.conversation_id, self.owner.user_id
            ),
        )

        # The tombstone row is hidden from the list; the stored approval list
        # must be cleared for the retired conversation as well.
        connection_info = make_conninfo(
            **self.connection_args, dbname=self.settings.db.name
        )
        async with await psycopg.AsyncConnection.connect(connection_info) as connection:
            cursor = await connection.execute(
                "SELECT approved_images, rejected_images FROM chats WHERE conversation_id = %s",
                (self.conversation_id,),
            )
            row = await cursor.fetchone()
            self.assertIsNotNone(row)
            if row is None:  # narrows the ty None-type; unreachable behind assert
                raise AssertionError("conversation row vanished")
            self.assertEqual([], row[0])
            self.assertEqual([], row[1])


if __name__ == "__main__":
    unittest.main()
