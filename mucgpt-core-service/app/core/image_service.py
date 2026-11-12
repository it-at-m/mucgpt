"""Ingestion pipeline for chat images: validate, reserve, store, publish.

Byte bounds and the format allowlist are enforced on the actual bytes; the
browser MIME type is retained for display only. Reservation precedes the
object upload so a crash after the PUT still leaves a row for reconciliation;
``ready`` is published only after the object exists and starts the unbound
expiry clock. Conversation binding happens later in the chat flow.
"""

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from anyio import CancelScope
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config.settings import ImageConfig
from core.auth_models import AuthenticationResult
from core.image_refs import managed_image_url
from core.image_store import ImageStorageError, ImageStore
from core.image_validation import InvalidImageError, validate_image_bytes
from core.logtools import getLogger
from database.image_repo import ImageDeletionOutboxRepository, ImageRepository

logger = getLogger()

_FORMAT_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class ImageSizeExceededError(ValueError):
    """The upload exceeds the configured image byte bound."""


class InvalidImageUploadError(ValueError):
    """The upload metadata is invalid (e.g. missing or oversized filename)."""


@dataclass(frozen=True)
class UploadedImage:
    """Managed metadata returned to the frontend after a successful upload."""

    id: str
    filename: str
    mime_type: str
    size_bytes: int
    width: int | None
    height: int | None
    created_at: datetime
    expires_at: datetime

    @property
    def managed_url(self) -> str:
        return managed_image_url(self.id)


class ImageIngestionService:
    """Owner-scoped image ingestion with independently committed phases."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        store: ImageStore | None = None,
        settings: ImageConfig | None = None,
    ):
        from core.image_store import ImageStorageManager
        from database.image_catalog import ImageCatalogManager

        self.session_factory = (
            session_factory
            if session_factory is not None
            else ImageCatalogManager.get_session_factory()
        )
        self.store = (
            store if store is not None else ImageStorageManager.get_store()
        )
        self.settings = (
            settings if settings is not None else _image_settings()
        )
        if self.settings.s3 is None or not self.settings.s3.bucket:
            raise ImageStorageError("Image input requires an S3 bucket")

    async def ingest_image(
        self, user_info: AuthenticationResult, file: UploadFile
    ) -> UploadedImage:
        """Validate and store one image, returning managed metadata.

        Vision-model gating belongs to the router: the service stores bytes
        for authorized users; the chat flow decides which models may see them.
        """
        filename = file.filename
        if not filename or not filename.strip() or len(filename) > 255:
            raise InvalidImageUploadError(
                "A filename of at most 255 characters is required"
            )
        display_mime = (file.content_type or "").split(";", 1)[0].strip().lower()
        display_mime = display_mime or "application/octet-stream"

        data = await file.read(self.settings.max_upload_bytes + 1)
        if len(data) > self.settings.max_upload_bytes:
            raise ImageSizeExceededError("Image upload exceeds the byte limit")
        if not data:
            raise InvalidImageError("Image is empty")

        mime_type, width, height = validate_image_bytes(
            data, max_pixels=self.settings.max_pixels
        )
        checksum = hashlib.sha256(data).hexdigest()
        size_bytes = len(data)

        reserved_id = str(uuid4())
        object_key = (
            f"{reserved_id}.{_FORMAT_EXTENSIONS[mime_type]}"
        )
        bucket = self.settings.s3.bucket if self.settings.s3 else ""
        image_id: str | None = None
        created_at: datetime | None = None
        try:
            with CancelScope(shield=True):
                async with self.session_factory.begin() as session:
                    reserved = await ImageRepository(session).reserve_image(
                        user_info.user_id,
                        filename=filename,
                        mime_type=mime_type,
                        size_bytes=size_bytes,
                        sha256=checksum,
                        bucket=bucket,
                        object_key=object_key,
                        width=width,
                        height=height,
                        image_id=reserved_id,
                    )
                    # Capture before the session closes and expires the row.
                    image_id = reserved.id
                    created_at = reserved.created_at
            if image_id is None or created_at is None:
                raise ImageStorageError("Image reservation was not published")

            await self.store.put(object_key, data, mime_type)

            expires_at = datetime.now(UTC) + timedelta(
                seconds=self.settings.unbound_expiry_seconds
            )
            with CancelScope(shield=True):
                async with self.session_factory.begin() as session:
                    published = await ImageRepository(session).mark_ready(
                        user_info.user_id, image_id, expires_at=expires_at
                    )
            if not published:
                raise RuntimeError("Image could not be marked ready")

            return UploadedImage(
                id=image_id,
                filename=filename,
                mime_type=mime_type,
                size_bytes=size_bytes,
                width=width,
                height=height,
                created_at=created_at,
                expires_at=expires_at,
            )
        except BaseException:
            await self._compensate(
                user_info.user_id,
                image_id,
                object_key,
                bucket,
            )
            raise

    async def _compensate(
        self,
        user_id: str,
        image_id: str | None,
        object_key: str,
        bucket: str,
    ) -> None:
        """Roll back a failed upload durably.

        The reservation row and the outbox entry for the object removal commit
        in one transaction, so the maintenance job removes any written bytes
        even when this process dies mid-compensation.
        """
        with CancelScope(shield=True):
            try:
                async with self.session_factory.begin() as session:
                    if image_id is not None:
                        await ImageRepository(session).delete_image(user_id, image_id)
                    await ImageDeletionOutboxRepository(session).enqueue(
                        bucket, object_key, "upload_compensation"
                    )
            except Exception:
                logger.exception(
                    "Image compensation failed for %s", image_id or object_key
                )


def _image_settings() -> ImageConfig:
    from config.settings import get_settings

    return get_settings().image_input


async def bind_chat_images(
    user_info: AuthenticationResult, conversation_id: str, image_ids: list[str]
) -> int:
    """Bind unbound draft uploads to a persisted conversation.

    Runs under the live-chat row fence; raises the repository's domain errors
    (unavailable, already bound, conversation unavailable) for HTTP mapping.
    """
    from database.image_catalog import ImageCatalogManager

    async with ImageCatalogManager.get_session_factory().begin() as session:
        return await ImageRepository(session).bind_images_to_conversation(
            user_info.user_id, conversation_id, image_ids
        )


async def verify_unbound_chat_images(
    user_info: AuthenticationResult, image_ids: list[str]
) -> int:
    """Verify stateless image references without creating any binding."""
    from database.image_catalog import ImageCatalogManager

    factory = ImageCatalogManager.get_session_factory()
    async with factory() as session:
        return await ImageRepository(session).verify_unbound_images(
            user_info.user_id, image_ids
        )
