"""Image byte validation: format allowlist, bounds, and spoofing defense."""

import io

import pytest
from PIL import Image

from core.image_validation import (
    ALLOWED_IMAGE_MIME_TYPES,
    InvalidImageError,
    validate_image_bytes,
)


def image_bytes(fmt: str, size: tuple[int, int] = (4, 4)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color=(10, 20, 30)).save(buffer, format=fmt)
    return buffer.getvalue()


@pytest.mark.parametrize(
    ("fmt", "expected_mime"),
    [
        ("PNG", "image/png"),
        ("JPEG", "image/jpeg"),
        ("WEBP", "image/webp"),
    ],
)
def test_allowed_formats_are_detected_from_bytes(fmt, expected_mime):
    mime, width, height = validate_image_bytes(
        image_bytes(fmt), max_pixels=20_000_000
    )

    assert mime == expected_mime
    assert (width, height) == (4, 4)


def test_declared_formats_cover_the_documented_allowlist():
    assert set(ALLOWED_IMAGE_MIME_TYPES) == {
        "image/jpeg",
        "image/png",
        "image/webp",
    }


@pytest.mark.parametrize("fmt", ["GIF", "BMP", "TIFF"])
def test_disallowed_formats_are_rejected(fmt):
    with pytest.raises(InvalidImageError):
        validate_image_bytes(image_bytes(fmt), max_pixels=20_000_000)


def test_empty_upload_is_rejected():
    with pytest.raises(InvalidImageError):
        validate_image_bytes(b"", max_pixels=20_000_000)


def test_corrupt_bytes_are_rejected():
    # Valid PNG magic followed by garbage must not be trusted by extension,
    # magic prefix, or a supplied browser MIME type.
    corrupt = image_bytes("PNG")[:8] + b"not really a png body"
    with pytest.raises(InvalidImageError):
        validate_image_bytes(corrupt, max_pixels=20_000_000)


def test_non_image_bytes_are_rejected():
    with pytest.raises(InvalidImageError):
        validate_image_bytes(b"<svg xmlns='http://www.w3.org/2000/svg'/>", max_pixels=20_000_000)


def test_oversized_dimensions_are_rejected_before_full_decode():
    with pytest.raises(InvalidImageError, match="pixel limit"):
        validate_image_bytes(image_bytes("PNG"), max_pixels=4 * 4 - 1)


def test_dimensions_at_the_pixel_cap_are_accepted():
    mime, width, height = validate_image_bytes(
        image_bytes("PNG"), max_pixels=4 * 4
    )

    assert (mime, width, height) == ("image/png", 4, 4)
