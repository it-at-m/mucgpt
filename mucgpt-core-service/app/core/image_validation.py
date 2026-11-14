"""Image byte validation for the chat image upload pipeline.

The browser MIME type is untrusted: the actual bytes are decoded with Pillow
and the detected format wins. Only JPEG, PNG, and WebP are accepted; GIF, BMP,
HEIC, SVG, and everything else is rejected. Pixel caps are checked before full
decoding so oversized/crafted files fail cheaply (decompression-bomb defense).
"""

import io

from PIL import Image, UnidentifiedImageError

# Hardcoded allowlist: image input is a deliberate per-model data-protection
# opt-in, so format support is a deliberate product decision, not config.
ALLOWED_IMAGE_MIME_TYPES: tuple[str, ...] = (
    "image/jpeg",
    "image/png",
    "image/webp",
)

_FORMAT_MIME_TYPES = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


class InvalidImageError(ValueError):
    """The upload is not a decodable, allowed, in-bounds image."""


def validate_image_bytes(
    data: bytes, *, max_pixels: int
) -> tuple[str, int | None, int | None]:
    """Validate raw upload bytes and return ``(mime_type, width, height)``.

    Raises :class:`InvalidImageError` for empty, corrupt, unsupported, or
    oversized payloads. The declared browser MIME type is ignored; callers
    keep it only for display purposes.
    """
    if not data:
        raise InvalidImageError("Image is empty")
    try:
        with Image.open(io.BytesIO(data)) as image:
            mime_type = _FORMAT_MIME_TYPES.get(image.format or "")
            if mime_type is None:
                raise InvalidImageError("Image format is not supported")
            width, height = image.size
            if width * height > max_pixels:
                raise InvalidImageError("Image exceeds the pixel limit")
            image.verify()
    except UnidentifiedImageError as exc:
        raise InvalidImageError("Upload is not a decodable image") from exc
    except OSError as exc:
        raise InvalidImageError("Image could not be decoded") from exc
    return mime_type, width, height
