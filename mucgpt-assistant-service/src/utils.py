from typing import Optional


def serialize_list(items: Optional[list]) -> list:
    """Serializes a list of items, converting Pydantic models to dicts."""
    return [
        item.model_dump() if hasattr(item, "model_dump") else item
        for item in (items or [])
    ]
