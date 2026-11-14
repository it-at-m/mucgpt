"""Managed image reference helpers shared by the API schema and chat history.

Image bytes live in object storage and are addressed by opaque server-generated
ids. Chat messages, checkpoints, and browser storage only ever carry managed
references; arbitrary remote or inline URLs are rejected at the API boundary.
"""

from uuid import UUID

MANAGED_IMAGE_URL_SCHEME = "mucgpt-image://"


def managed_image_url(image_id: str | UUID) -> str:
    """Build the canonical managed image URL for an image id."""
    return f"{MANAGED_IMAGE_URL_SCHEME}{image_id}"


def parse_managed_image_url(url: str) -> UUID:
    """Return the image id referenced by a managed image URL.

    Raises :class:`ValueError` for foreign URL schemes (``data:``, ``http(s):``,
    ``s3://``, provider-specific references) and for malformed ids. Callers
    translate that into their own user-facing errors.
    """
    if not url.startswith(MANAGED_IMAGE_URL_SCHEME):
        raise ValueError(
            "image URLs must use the managed "
            f"'{MANAGED_IMAGE_URL_SCHEME}' scheme"
        )
    return UUID(url[len(MANAGED_IMAGE_URL_SCHEME) :])
