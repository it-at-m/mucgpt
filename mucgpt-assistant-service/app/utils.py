from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel


def serialize_list[T](items: Sequence[T] | None) -> list[dict[str, Any] | T]:
    """Serializes a list of items, converting Pydantic models to dicts.

    Non-Pydantic items are passed through unchanged.

    Args:
        items: A list of items that may be Pydantic models or arbitrary objects

    Returns:
        A list where Pydantic models are replaced by their dumped dictionaries
    """
    return [
        item.model_dump() if isinstance(item, BaseModel) else item
        for item in (items or [])
    ]
