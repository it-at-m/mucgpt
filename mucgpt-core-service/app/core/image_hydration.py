"""Provider-boundary hydration of managed image references.

Managed ``mucgpt-image://`` references never leave the core service. The
chat router binds/authorizes them; immediately before a model invocation the
middleware hydrates a **copy** of the request messages into standard OpenAI
data URIs, while graph state and checkpoints keep only the references. The
LangChain generation callback sees the hydrated content — which is what
enables native Langfuse media references — and the middleware fails closed
whenever the selected model is not explicitly vision-enabled.
"""

import base64
from dataclasses import dataclass, field
from typing import Any

from langchain_core.messages import AnyMessage

from config.settings import ImageConfig, get_settings
from core.auth_models import AuthenticationResult
from core.image_store import ImageStorageManager
from core.logtools import getLogger
from database.image_repo import ChatImage, ImageRepository

logger = getLogger()

MANAGED_IMAGE_URL_SCHEME = "mucgpt-image://"


class ImageHydrationError(RuntimeError):
    """A managed image reference could not be hydrated for the model call.

    The message is user-actionable and surfaced by the LLM error handler.
    """


def _iter_blocks(content: Any):
    """Yield content blocks of a message, tolerating plain strings."""
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict):
                yield block


def find_managed_image_url(block: dict[str, Any]) -> str | None:
    """Return the managed URL of an image block, if it carries one.

    Recognizes both the raw OpenAI shape persisted in checkpoints
    (``{"type": "image_url", "image_url": {"url": ...}}``) and LangChain's
    normalized block (``{"type": "image", "url": ...}``). Non-image blocks
    and foreign URLs (data:, http(s):) return None and are never touched.
    """
    if block.get("type") == "image_url":
        payload = block.get("image_url")
        url = payload.get("url") if isinstance(payload, dict) else None
    elif block.get("type") == "image":
        url = block.get("url")
    else:
        return None
    if isinstance(url, str) and url.startswith(MANAGED_IMAGE_URL_SCHEME):
        return url
    return None


def contains_managed_images(messages: list[AnyMessage]) -> bool:
    """True when any message references a managed image.

    Tolerates non-message input items (LangGraph ``(role, content)`` message
    shorthand tuples): only real messages can carry image blocks, and the
    hydration path operates on graph-state messages.
    """
    return any(
        find_managed_image_url(block) is not None
        for message in messages
        if hasattr(message, "content")
        for block in _iter_blocks(message.content)
    )


@dataclass
class ImageHydrator:
    """Request-scoped resolver from managed references to data URIs.

    Verifies ownership, readiness, expiry, and conversation binding for every
    reference (defense-in-depth against images replayed from checkpoints),
    then fetches the recorded object. A per-run cache and a total byte budget
    keep repeated agent iterations cheap and bounded.
    """

    user_id: str
    conversation_id: str | None
    persist: bool
    # Duck-typed ImageStore; typed Any because RequestContext is deep-validated
    # by pydantic and Protocol classes cannot be is-instance validator targets.
    store: Any
    settings: ImageConfig
    _cache: dict[str, str] = field(default_factory=dict)
    _hydrated_bytes: int = 0

    async def _resolve(self, image_id: str) -> str:
        """Return the data URI for one managed image id."""
        cached = self._cache.get(image_id)
        if cached is not None:
            return cached

        from database.image_catalog import ImageCatalogManager

        factory = ImageCatalogManager.get_session_factory()
        async with factory() as session:
            row: ChatImage | None = await ImageRepository(session).get_ready_image(
                self.user_id, image_id
            )
        if row is None or row.status != "ready":
            raise ImageHydrationError(
                "An attached image is no longer available. Remove it and try again."
            )
        if self.persist:
            if row.conversation_id != self.conversation_id:
                raise ImageHydrationError(
                    "An attached image does not belong to this conversation."
                )
        elif row.conversation_id is not None:
            raise ImageHydrationError(
                "Stateless requests cannot use conversation-bound images."
            )
        expires_at = row.expires_at
        if expires_at is not None:
            from datetime import UTC, datetime

            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=UTC)
            if expires_at <= datetime.now(UTC):
                raise ImageHydrationError(
                    "An attached image has expired. Remove it and upload it again."
                )
        s3 = self.settings.s3
        if s3 is None or row.bucket != s3.bucket:
            raise ImageHydrationError(
                "An attached image references unknown storage."
            )

        try:
            data = await self.store.get(row.object_key, self.settings.max_upload_bytes)
        except Exception as exc:
            raise ImageHydrationError(
                "An attached image could not be loaded. Try again shortly."
            ) from exc
        if len(data) != row.size_bytes:
            raise ImageHydrationError(
                "An attached image is inconsistent with its record."
            )

        if self._hydrated_bytes + len(data) > self.settings.max_hydration_bytes:
            raise ImageHydrationError(
                "This conversation contains too many images for one model call. "
                "Start a new chat to continue with image input."
            )
        self._hydrated_bytes += len(data)

        data_uri = (
            f"data:{row.mime_type};base64,"
            f"{base64.b64encode(data).decode('ascii')}"
        )
        self._cache[image_id] = data_uri
        return data_uri

    async def hydrate_messages(
        self, messages: list[AnyMessage]
    ) -> list[AnyMessage]:
        """Return a copy of the messages with managed URLs replaced.

        The input list and message objects are never mutated; hydrated
        content must not flow back into graph state or checkpoints.
        """
        hydrated: list[AnyMessage] = []
        for message in messages:
            blocks = [
                block for block in _iter_blocks(message.content)
                if find_managed_image_url(block) is not None
            ]
            if not blocks:
                hydrated.append(message)
                continue
            new_content = []
            for block in _iter_content_items(message.content):
                url = find_managed_image_url(block)
                if url is None:
                    new_content.append(block)
                    continue
                image_id = url[len(MANAGED_IMAGE_URL_SCHEME) :]
                data_uri = await self._resolve(image_id)
                new_content.append(_with_hydrated_url(block, data_uri))
            hydrated.append(message.model_copy(update={"content": new_content}))
        return hydrated


def _iter_content_items(content: Any):
    """Yield every content item, including plain-string entries."""
    if isinstance(content, str):
        yield content
        return
    yield from content


def _with_hydrated_url(block: Any, data_uri: str) -> Any:
    """Return the block with the managed URL replaced by a data URI."""
    if not isinstance(block, dict):
        return block
    updated = dict(block)
    if block.get("type") == "image_url":
        payload = dict(block.get("image_url") or {})
        payload["url"] = data_uri
        updated["image_url"] = payload
    elif block.get("type") == "image":
        updated["url"] = data_uri
    return updated


def build_image_hydrator(
    user_info: AuthenticationResult,
    conversation_id: str | None,
    persist: bool,
) -> ImageHydrator:
    """Build the request-scoped hydrator; fail closed when unavailable.

    Called only when the request/checkpoint actually contains managed image
    references: the global feature must be enabled and the object store
    initialized, otherwise the turn is rejected with an actionable error.
    """
    settings = get_settings().image_input
    if not settings.enabled:
        raise ImageHydrationError("Image upload is not enabled.")
    try:
        store = ImageStorageManager.get_store()
    except RuntimeError as exc:
        raise ImageHydrationError(
            "Image input is not available. Try again shortly."
        ) from exc
    return ImageHydrator(
        user_id=user_info.user_id,
        conversation_id=conversation_id,
        persist=persist,
        store=store,
        settings=settings,
    )
