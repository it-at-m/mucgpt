"""Opt-in PostgreSQL tests; each test creates and drops an isolated database.

Use the MUCGPT_LIFECYCLE_POSTGRES_HOST/PORT/USER/PASSWORD test-server settings.
"""

import asyncio
import os
import unittest
from uuid import uuid4

from sqlalchemy.ext.asyncio import async_sessionmaker
from tests.postgres import isolated_postgres_database

from core.auth_models import AuthenticationResult
from core.document_service import DocumentService
from database.document_catalog import DocumentCatalogManager
from database.document_lock import document_work_lock
from database.document_repo import DocumentQuotaExceededError, DocumentRepository


@unittest.skipUnless(
    os.getenv("MUCGPT_LIFECYCLE_POSTGRES_HOST"), "real PostgreSQL opt-in required"
)
class DocumentCatalogPostgresTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.database_context = isolated_postgres_database(prefix="document_test_")
        database = await self.database_context.__aenter__()
        self.addAsyncCleanup(self.database_context.__aexit__, None, None, None)
        self.database = database.name
        self.connection_args = database.connection_args
        self.settings = database.settings
        await DocumentCatalogManager.init(self.settings)
        self.addAsyncCleanup(DocumentCatalogManager.close)
        self.owner = AuthenticationResult(
            user_id="demo-user-5", token="test", department="shared"
        )

    async def reserve(self, user_id="demo-user-5"):
        # Each call owns a separate database session/transaction, as in multiple
        # workers. Only metadata work happens inside the transaction.
        async with DocumentCatalogManager.get_session_factory()() as session:
            async with session.begin():
                row = await DocumentRepository(session).reserve_document(
                    user_id,
                    filename="test.pdf",
                    mime_type="application/pdf",
                    original_size=12,
                )
                return row.id

    async def test_parallel_reservations_from_empty_and_nine_slot_libraries(self):
        results = await asyncio.gather(
            *(self.reserve() for _ in range(14)), return_exceptions=True
        )
        self.assertEqual(sum(isinstance(result, str) for result in results), 10)
        failures = [result for result in results if isinstance(result, Exception)]
        self.assertEqual(len(failures), 4)
        self.assertTrue(
            all(isinstance(result, DocumentQuotaExceededError) for result in failures)
        )

        other_owner = "second-owner"
        for _ in range(9):
            await self.reserve(other_owner)
        results = await asyncio.gather(
            *(self.reserve(other_owner) for _ in range(6)), return_exceptions=True
        )
        self.assertEqual(sum(isinstance(result, str) for result in results), 1)
        self.assertEqual(
            sum(isinstance(result, DocumentQuotaExceededError) for result in results), 5
        )

    async def test_restart_revalidates_ownership_readiness_and_cleanup(self):
        document_id = await self.reserve()
        async with DocumentCatalogManager.get_session_factory()() as session:
            async with session.begin():
                self.assertTrue(
                    await DocumentRepository(session).mark_ready(
                        self.owner.user_id,
                        document_id,
                        text_length=42,
                        preview="excerpt",
                    )
                )
        await DocumentCatalogManager.close()
        await DocumentCatalogManager.init(self.settings)
        async with DocumentCatalogManager.get_session_factory()() as session:
            repository = DocumentRepository(session)
            service = DocumentService(repository)
            selection = await service.resolve_selected_documents(
                self.owner, [document_id]
            )
            self.assertEqual(selection.document_ids, (document_id,))
            other = AuthenticationResult(
                user_id="other", token="test", department="shared"
            )
            selection = await service.resolve_selected_documents(
                other, [document_id], saved_selection=True
            )
            self.assertEqual(selection.allowed_paths, ())
            self.assertEqual(selection.unavailable_ids, (document_id,))
            self.assertFalse(await repository.mark_deleting(other.user_id, document_id))
            self.assertTrue(
                await repository.mark_deleting(self.owner.user_id, document_id)
            )
            await session.commit()
            selection = await service.resolve_selected_documents(
                self.owner, [document_id], saved_selection=True
            )
            self.assertEqual(selection.allowed_paths, ())
            self.assertTrue(
                await repository.remove_after_cleanup(self.owner.user_id, document_id)
            )
            await session.commit()
            self.assertEqual(await repository.list_documents(self.owner.user_id), [])

    async def test_work_lock_coordinates_independent_instances_until_session_close(
        self,
    ):
        factory = DocumentCatalogManager.get_session_factory()
        other_factory = async_sessionmaker(factory.kw["bind"], expire_on_commit=False)
        document_id = str(uuid4())
        async with document_work_lock(factory, document_id) as acquired:
            self.assertTrue(acquired)
            # Committing catalog work does not release the dedicated session lock.
            await self.reserve()
            async with document_work_lock(other_factory, document_id) as other_acquired:
                self.assertFalse(other_acquired)
        async with document_work_lock(other_factory, document_id) as acquired:
            self.assertTrue(acquired)
