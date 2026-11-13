"""Real catalog SQL on SQLite; PostgreSQL concurrency has separate integration tests."""

import asyncio
from typing import cast
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import Table, create_engine, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.auth_models import AuthenticationResult
from core.document_service import (
    DocumentService,
    DocumentUnavailableError,
    InvalidDocumentSelectionError,
)
from core.virtual_file_system_helper import get_document_path
from database import document_catalog
from database.database_models import Base, Document
from database.document_repo import DocumentQuotaExceededError, DocumentRepository


@pytest.fixture
def catalog():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[cast("Table", Document.__table__)])
    with Session(engine, expire_on_commit=False) as session:
        # Execute real SQL while adapting the sync in-memory driver to AsyncSession.
        repository = DocumentRepository(
            MagicMock(execute=AsyncMock(side_effect=session.execute))
        )
        yield repository, DocumentService(repository), session
    engine.dispose()


def user(user_id="demo-user-5"):
    return AuthenticationResult(user_id=user_id, token="test", department="shared")


async def reserve(repository, owner="demo-user-5"):
    return await repository.reserve_document(
        owner, filename="private.pdf", mime_type="application/pdf", original_size=12
    )


@pytest.mark.asyncio
async def test_ownership_readiness_and_selection_revalidation(catalog):
    repository, service, session = catalog
    document = await reserve(repository)
    foreign = await reserve(repository, "other-user")
    for row in (document, foreign):
        assert await repository.get_ready_documents(row.user_id, [row.id]) == []
        assert await repository.mark_ready(
            row.user_id, row.id, text_length=42, preview="excerpt"
        )
    session.commit()
    assert [row.id for row in await repository.list_documents(user().user_id)] == [
        document.id
    ]
    assert not await repository.mark_ready(
        "other-user", document.id, text_length=1, preview="stolen"
    )
    assert not await repository.mark_deleting("other-user", document.id)
    assert not await repository.remove_after_cleanup("other-user", document.id)
    assert not await repository.remove_after_cleanup(user().user_id, document.id)

    selection = await service.resolve_selected_documents(
        user(), [document.id.upper(), document.id]
    )
    assert selection.document_ids == (document.id,)
    assert selection.allowed_paths == (get_document_path(document.id),)
    assert selection.documents[0].preview_kind == "initial_excerpt"
    assert not hasattr(selection.documents[0], "user_id")
    missing = str(uuid4())
    for unavailable in (foreign.id, missing):
        with pytest.raises(DocumentUnavailableError, match="documents are unavailable"):
            await service.resolve_selected_documents(user(), [document.id, unavailable])
    saved = await service.resolve_selected_documents(
        user(), [foreign.id, missing, document.id], saved_selection=True
    )
    assert saved.unavailable_ids == (foreign.id, missing)
    assert saved.document_ids == (document.id,)

    # Re-query in the same session; do not serve cached ready ORM metadata.
    assert await repository.mark_deleting(user().user_id, document.id)
    assert await repository.mark_deleting(user().user_id, document.id)
    assert not await repository.mark_ready(
        user().user_id, document.id, text_length=42, preview="revived"
    )
    saved = await service.resolve_selected_documents(
        user(), [document.id], saved_selection=True
    )
    assert saved.documents == saved.allowed_paths == ()
    assert saved.unavailable_ids == (document.id,)
    assert await repository.remove_after_cleanup(user().user_id, document.id)
    assert not await repository.remove_after_cleanup(user().user_id, document.id)


@pytest.mark.asyncio
async def test_slots_hold_capacity_until_cleanup_and_rollback_releases_reservation(
    catalog,
):
    repository, _, session = catalog
    documents = [await reserve(repository) for _ in range(10)]
    session.commit()
    assert {row.slot for row in documents} == set(range(10))
    with pytest.raises(DocumentQuotaExceededError):
        await reserve(repository)
    assert await repository.mark_deleting(user().user_id, documents[0].id)
    session.commit()
    with pytest.raises(DocumentQuotaExceededError):
        await reserve(repository)
    assert await repository.remove_after_cleanup(user().user_id, documents[0].id)
    session.commit()
    replacement = await reserve(repository)
    assert replacement.slot == 0
    session.rollback()
    assert (await reserve(repository)).slot == 0
    assert (await reserve(repository, "other-user")).slot == 0


@pytest.mark.asyncio
async def test_selection_order_empty_selection_and_processing_entries(catalog):
    repository, service, _ = catalog
    first, second, processing = [await reserve(repository) for _ in range(3)]
    for document in (first, second):
        await repository.mark_ready(
            user().user_id, document.id, text_length=10, preview="excerpt"
        )
    selected = await service.resolve_selected_documents(user(), [second.id, first.id])
    assert selected.document_ids == (second.id, first.id)
    empty = await service.resolve_selected_documents(user(), [])
    assert empty.documents == empty.unavailable_ids == empty.allowed_paths == ()
    with pytest.raises(DocumentUnavailableError):
        await service.resolve_selected_documents(user(), [processing.id])


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "ids",
    [
        "/documents/foo.txt",
        None,
        [None],
        [123],
        ["../secret"],
        [{"id": str(uuid4()), "user_id": "other"}],
        [str(uuid4()) for _ in range(11)],
    ],
)
async def test_invalid_selection_rejected_before_catalog_access(catalog, ids):
    repository, service, _ = catalog
    with pytest.raises(InvalidDocumentSelectionError):
        await service.resolve_selected_documents(user(), ids)
    repository.session.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_inconsistent_storage_key_never_becomes_an_allowed_path(catalog):
    repository, service, session = catalog
    document = await reserve(repository)
    await repository.mark_ready(
        user().user_id, document.id, text_length=1, preview="excerpt"
    )
    session.execute(
        update(Document)
        .where(Document.id == document.id)
        .values(storage_key="/different.txt")
    )
    with pytest.raises(DocumentUnavailableError):
        await service.resolve_selected_documents(user(), [document.id])


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "values",
    [
        {"slot": 10},
        {"status": "unknown"},
        {"status": "ready"},
        {"status": "ready", "text_length": 1, "preview": "excerpt"},
        {"original_size": -1},
    ],
)
async def test_database_rejects_invalid_catalog_states(catalog, values):
    repository, _, session = catalog
    document = await reserve(repository)
    with pytest.raises(IntegrityError):
        session.execute(
            update(Document).where(Document.id == document.id).values(**values)
        )
    session.rollback()


@pytest.mark.asyncio
@pytest.mark.parametrize("error_type", [RuntimeError, asyncio.CancelledError])
async def test_catalog_initialization_failure_disposes_engine_and_can_retry(
    monkeypatch, error_type
):
    manager = document_catalog.DocumentCatalogManager
    monkeypatch.setattr(manager, "_engine", None)
    monkeypatch.setattr(manager, "_session_factory", None)
    connection = MagicMock(
        run_sync=AsyncMock(side_effect=error_type("setup interrupted"))
    )
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=connection)
    context.__aexit__ = AsyncMock(return_value=False)
    engine = MagicMock(begin=MagicMock(return_value=context), dispose=AsyncMock())
    factory = MagicMock()
    monkeypatch.setattr(
        document_catalog,
        "create_engine_and_session_factory",
        lambda _: (engine, factory),
    )
    with pytest.raises(error_type):
        await manager.init(MagicMock())
    engine.dispose.assert_awaited_once()
    with pytest.raises(RuntimeError, match="not initialized"):
        manager.get_session_factory()
    connection.run_sync.side_effect = None
    await manager.init(MagicMock())
    assert manager.get_session_factory() is factory
    connection.run_sync.assert_awaited_with(
        Base.metadata.create_all, tables=[cast("Table", Document.__table__)]
    )
    await manager.close()
    with pytest.raises(RuntimeError, match="not initialized"):
        manager.get_session_factory()
