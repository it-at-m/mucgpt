"""Authenticated image upload and delivery for chat image input.

Images are stored once in private object storage and addressed by managed
``mucgpt-image://`` references; this router never exposes bucket names, object
keys, or public URLs. Uploads are gated on the selected model's explicit
``supports_vision`` opt-in; display endpoints are strictly owner-scoped.
"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from api.api_models import UploadedImageDTO
from config.model_provider import ModelRegistry, ModelsConfigurationException
from config.settings import get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.image_refs import managed_image_url
from core.image_service import (
    ImageIngestionService,
    ImageSizeExceededError,
    InvalidImageUploadError,
)
from core.image_store import ImageStorageError, ImageStorageManager
from core.image_validation import InvalidImageError
from core.logtools import getLogger
from database.image_catalog import ImageCatalogManager
from database.image_repo import ChatImage, ImageRepository

logger = getLogger()
router = APIRouter(prefix="/v1")


def _service(settings) -> ImageIngestionService:
    return ImageIngestionService(settings=settings.image_input)


def _validate_vision_model(model: str) -> None:
    """Reject unknown and non-vision models before storing any bytes."""
    try:
        ModelRegistry.get_model(model)
        vision_enabled = ModelRegistry.is_vision_model(model)
    except ModelsConfigurationException as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not vision_enabled:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Model {model!r} does not support image input; "
                "choose a model with supports_vision enabled."
            ),
        )


async def _get_ready_row(user_id: str, image_id: str) -> ChatImage:
    """Load the caller's live ready image; inaccessible rows are 404."""
    try:
        parsed_id = str(UUID(image_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Image not found") from None
    factory = ImageCatalogManager.get_session_factory()
    async with factory() as session:
        row = await ImageRepository(session).get_ready_image(user_id, parsed_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Image not found")
    s3 = get_settings().image_input.s3
    if s3 is None or row.bucket != s3.bucket:
        logger.warning(
            "Image %s references foreign bucket %r; treating as unavailable",
            parsed_id,
            row.bucket,
        )
        raise HTTPException(status_code=404, detail="Image not found")
    expires_at = row.expires_at
    if expires_at is not None:
        # SQLite-backed stores return naive timestamps; treat them as UTC.
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at <= datetime.now(UTC):
            raise HTTPException(status_code=404, detail="Image not found")
    return row


@router.post(
    "/images",
    summary="Upload a chat image",
    status_code=201,
    response_model=UploadedImageDTO,
    responses={
        400: {"description": "Unknown model, non-vision model, or invalid upload"},
        413: {"description": "Image exceeds the configured size limit"},
        415: {"description": "Unsupported or undecodable image format"},
        503: {"description": "Image input is disabled or storage is unavailable"},
    },
)
async def upload_image(
    model: str = Form(...),
    file: UploadFile = File(...),
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> UploadedImageDTO:
    """Validate and store one image, returning managed metadata.

    The upload target model must exist and be explicitly vision-enabled;
    byte bounds and the format allowlist are enforced on the actual bytes.
    """
    settings = get_settings()
    if not settings.image_input.enabled:
        raise HTTPException(
            status_code=503, detail="Image upload is not enabled."
        )
    _validate_vision_model(model)
    try:
        uploaded = await _service(settings).ingest_image(user_info, file)
    except ImageSizeExceededError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except InvalidImageUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except InvalidImageError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except ImageStorageError as exc:
        logger.error("Image upload storage failure: %s", exc)
        raise HTTPException(
            status_code=503, detail="Image storage is currently unavailable."
        ) from exc
    return UploadedImageDTO(
        id=uploaded.id,
        filename=uploaded.filename,
        mime_type=uploaded.mime_type,
        size_bytes=uploaded.size_bytes,
        width=uploaded.width,
        height=uploaded.height,
        created_at=uploaded.created_at,
        expires_at=uploaded.expires_at,
        managed_url=uploaded.managed_url,
    )


@router.get(
    "/images/{image_id}/metadata",
    summary="Restore safe image display metadata",
    response_model=UploadedImageDTO,
    responses={404: {"description": "Image not found or not accessible"}},
)
async def get_image_metadata(
    image_id: str,
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> UploadedImageDTO:
    """Return owner-scoped metadata; foreign/expired images are indistinguishable."""
    row = await _get_ready_row(user_info.user_id, image_id)
    return UploadedImageDTO(
        id=row.id,
        filename=row.original_filename,
        mime_type=row.mime_type,
        size_bytes=row.size_bytes,
        width=row.width,
        height=row.height,
        created_at=row.created_at,
        expires_at=row.expires_at,
        managed_url=managed_image_url(row.id),
    )


@router.get(
    "/images/{image_id}/content",
    summary="Stream authorized image bytes for display",
    responses={
        200: {"description": "The image bytes"},
        404: {"description": "Image not found or not accessible"},
        503: {"description": "Image storage is unavailable"},
    },
)
async def get_image_content(
    image_id: str,
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> Response:
    """Deliver bytes for browser rendering; no public or cacheable URLs exist."""
    settings = get_settings()
    row = await _get_ready_row(user_info.user_id, image_id)
    try:
        data = await ImageStorageManager.get_store().get(
            row.object_key, settings.image_input.max_upload_bytes
        )
    except ImageStorageError as exc:
        logger.error("Image content read failure for %s: %s", row.id, exc)
        raise HTTPException(
            status_code=503, detail="Image storage is currently unavailable."
        ) from exc
    if len(data) != row.size_bytes:
        logger.error("Stored image %s length mismatch", row.id)
        raise HTTPException(status_code=503, detail="Image storage is inconsistent.")
    return Response(
        content=data,
        media_type=row.mime_type,
        headers={
            "Content-Length": str(len(data)),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete(
    "/images/{image_id}",
    summary="Delete an unbound draft image",
    responses={
        204: {"description": "Deleted"},
        404: {"description": "Image not found or not accessible"},
        409: {"description": "Image already belongs to a conversation"},
        503: {"description": "Image storage is unavailable"},
    },
)
async def delete_image(
    image_id: str,
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> Response:
    """Remove an unbound draft; bound images live with their conversation.

    Cleanup ordering: the object is removed first, then the row, so a failed
    object deletion keeps the row retryable. (Durable outbox semantics arrive
    with the image lifecycle work.)
    """
    row = await _get_ready_row(user_info.user_id, image_id)
    if row.conversation_id is not None:
        raise HTTPException(
            status_code=409,
            detail="Image is already attached to a conversation.",
        )
    try:
        await ImageStorageManager.get_store().delete(row.object_key)
    except ImageStorageError as exc:
        logger.error("Image delete storage failure for %s: %s", row.id, exc)
        raise HTTPException(
            status_code=503, detail="Image storage is currently unavailable."
        ) from exc
    async with ImageCatalogManager.get_session_factory().begin() as session:
        await ImageRepository(session).delete_image(user_info.user_id, row.id)
    return Response(status_code=204)
