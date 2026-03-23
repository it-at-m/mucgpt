from __future__ import annotations


def serialize_list[T](items: list[T] | None) -> list[dict | T]:
    """Serializes a list of items, converting Pydantic models to dicts.

    Args:
        items: A list of items that may be Pydantic models or regular objects

    Returns:
        A list of dictionaries (for Pydantic models) or original objects
    """
    return [
        item.model_dump() if hasattr(item, "model_dump") else item
        for item in (items or [])
    ]
