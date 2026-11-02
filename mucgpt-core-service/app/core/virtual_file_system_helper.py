import re
from collections.abc import Iterable
from uuid import UUID

from anyio import CancelScope
from deepagents import FilesystemPermission
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langgraph.store.postgres import AsyncPostgresStore
from psycopg_pool import AsyncConnectionPool

from config.settings import Settings
from core.document_backend import DocumentBackend
from core.logtools import getLogger
from core.persistance_helpers import _create_connection_args

logger = getLogger()

DOCUMENTS_ROUTE = "/documents/"
_SAFE_USER_ID = re.compile(r"[A-Za-z0-9\-_.@+:~]+")
_ENCODED_USER_PREFIX = "utf8:"


def get_document_namespace(user_id: str) -> tuple[str, str]:
    """Scope storage to server-authenticated identity without glob characters.

    Safe IDs are retained verbatim. Other IDs use UTF-8 hex with a reserved
    prefix; IDs already beginning with that prefix are also encoded to avoid
    collisions. Identity is never stripped, case-folded, or Unicode-normalized.
    """
    if not isinstance(user_id, str) or not user_id.strip():
        raise ValueError("A nonempty authenticated user ID is required")
    if not _SAFE_USER_ID.fullmatch(user_id) or user_id.startswith(_ENCODED_USER_PREFIX):
        user_id = _ENCODED_USER_PREFIX + user_id.encode("utf-8").hex()
    return ("user_documents", user_id)


def get_document_storage_key(document_id: str | UUID) -> str:
    """Return the canonical UUID key after CompositeBackend strips the mount."""
    canonical_id = document_id if isinstance(document_id, UUID) else UUID(document_id)
    return f"/{canonical_id}.txt"


def get_document_path(document_id: str | UUID) -> str:
    """Return a stable public path; filenames and user IDs never enter the path."""
    return DOCUMENTS_ROUTE.rstrip("/") + get_document_storage_key(document_id)


def create_document_backend(user_id: str) -> StoreBackend:
    """Writable ingestion backend, usable outside graph execution.

    Callers must resolve ownership server-side and use get_document_storage_key.
    This application backend is not protected by agent filesystem permissions.
    """
    namespace = get_document_namespace(user_id)
    return StoreBackend(
        store=FileStoreManager.get_store(), namespace=lambda _runtime: namespace
    )


async def delete_document_body(user_id: str, document_id: str | UUID) -> None:
    """Idempotently delete one canonical key, including an uncertain upload write.

    StoreBackend's recursive delete reports missing files as errors. Compensation
    instead uses the store's exact-key deletion, which also succeeds when absent.
    Ownership/lifecycle coordination belongs to the document service.
    """
    await FileStoreManager.get_store().adelete(
        get_document_namespace(user_id), get_document_storage_key(document_id)
    )


def create_backend(
    user_id: str, selected_document_ids: Iterable[str | UUID] = ()
) -> CompositeBackend:
    """Build a fresh user-bound agent filesystem with chat-state scratch files."""
    namespace = get_document_namespace(user_id)
    return CompositeBackend(
        default=StateBackend(),
        routes={
            DOCUMENTS_ROUTE: DocumentBackend(
                store=FileStoreManager.get_store(),
                namespace=lambda _runtime: namespace,
                allowed_paths=[
                    get_document_storage_key(document_id)
                    for document_id in selected_document_ids
                ],
            )
        },
    )


def create_permissions(
    selected_document_ids: Iterable[str | UUID],
) -> list[FilesystemPermission]:
    """Expose only server-verified selected UUID files, keeping scratch access.

    The exact mount-root allowance permits ls/glob/grep before their results
    are filtered. It does not grant reads to any descendants. With no selected
    documents the mount is denied and hidden from root listings.
    """
    paths = sorted(
        {get_document_path(document_id) for document_id in selected_document_ids}
    )
    rules = []
    if paths:
        rules.append(
            FilesystemPermission(
                operations=["read"],
                paths=[DOCUMENTS_ROUTE.rstrip("/"), DOCUMENTS_ROUTE, *paths],
                mode="allow",
            )
        )
    rules.append(
        FilesystemPermission(
            operations=["read", "write"],
            paths=[DOCUMENTS_ROUTE.rstrip("/"), DOCUMENTS_ROUTE + "**"],
            mode="deny",
        )
    )
    return rules


class FileStoreManager:
    """Own the PostgreSQL store for documents shared across a user's chats."""

    _pool: AsyncConnectionPool | None = None
    _file_store: AsyncPostgresStore | None = None

    @staticmethod
    async def init(settings: Settings) -> None:
        """Publish the store only after setup succeeds; failed startup is retryable."""
        if FileStoreManager._pool is not None:
            return

        pool = AsyncConnectionPool(
            conninfo="",
            max_size=20,
            open=False,
            kwargs=_create_connection_args(settings),
        )
        try:
            await pool.open()
            store = AsyncPostgresStore(conn=pool)
            await store.setup()
        except BaseException:
            with CancelScope(shield=True):
                await pool.close()
            raise

        FileStoreManager._pool = pool
        FileStoreManager._file_store = store
        logger.info("FileStoreManager initialized")

    @staticmethod
    async def close() -> None:
        """Close the independently owned pool and clear store readiness."""
        pool = FileStoreManager._pool
        try:
            if pool is not None:
                await pool.close()
        finally:
            FileStoreManager._pool = None
            FileStoreManager._file_store = None

    @staticmethod
    def get_store() -> AsyncPostgresStore:
        """Return the document store, raising until initialization has succeeded."""
        if FileStoreManager._file_store is None:
            raise RuntimeError("FileStoreManager not initialized")
        return FileStoreManager._file_store
