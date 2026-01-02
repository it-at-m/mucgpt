from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from core import directory_cache
from core.logtools import getLogger

logger = getLogger(__name__)


def _normalize_value(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned.lower() if cleaned else None


class _DirectoryIndex:
    """Lightweight in-memory index to support ancestor lookups."""

    __slots__ = ("parent", "key_to_ids")

    def __init__(
        self, parent: Mapping[int, int | None], key_to_ids: Mapping[str, set[int]]
    ):
        self.parent = dict(parent)
        self.key_to_ids = {k: set(v) for k, v in key_to_ids.items()}

    def find_ids(self, key: str | None) -> set[int]:
        if key is None:
            return set()
        return self.key_to_ids.get(key, set())

    def is_ancestor(self, ancestor_id: int, node_id: int) -> bool:
        current = node_id
        while current is not None:
            if current == ancestor_id:
                return True
            current = self.parent.get(current)
        return False


def _build_index(tree: Iterable[Mapping[str, Any]]) -> _DirectoryIndex:
    parent: dict[int, int | None] = {}
    key_to_ids: dict[str, set[int]] = {}

    stack: list[tuple[Mapping[str, Any], int | None]] = [(node, None) for node in tree]
    next_id = 0

    while stack:
        node, parent_id = stack.pop()
        node_id = next_id
        next_id += 1
        parent[node_id] = parent_id

        shortname = (
            _normalize_value(node.get("shortname"))
            if isinstance(node, Mapping)
            else None
        )
        name = _normalize_value(node.get("name")) if isinstance(node, Mapping) else None

        for key in {shortname, name}:
            if key:
                key_to_ids.setdefault(key, set()).add(node_id)

        children = node.get("children") if isinstance(node, Mapping) else None
        if isinstance(children, Sequence):
            for child in children:
                if isinstance(child, Mapping):
                    stack.append((child, node_id))

    return _DirectoryIndex(parent=parent, key_to_ids=key_to_ids)


_INDEX_CACHE: dict[str, Any] = {"index": None, "expires_at": None}
_INDEX_TTL = timedelta(minutes=10)


def _load_local_directory_tree() -> list[dict[str, Any]] | None:
    """Fallback: load directory tree from bundled JSON if available."""

    repo_root = Path(__file__).resolve().parents[2]
    candidate = repo_root / "department_directory.json"
    if not candidate.exists():
        return None

    try:
        with candidate.open("r", encoding="utf-8") as f:
            payload = json.load(f)
        roots = payload.get("roots") if isinstance(payload, Mapping) else None
        if isinstance(roots, list):
            return roots  # Already simplified structure (shortname, name, children)
    except Exception:
        logger.warning(
            "Failed to load bundled department_directory.json", exc_info=True
        )
    return None


async def _get_directory_index(
    directory_tree: list[dict[str, Any]] | None = None,
    *,
    prebuilt_index: _DirectoryIndex | None = None,
) -> _DirectoryIndex | None:
    """Return cached directory index, refreshing from LDAP/Redis or local file."""

    if prebuilt_index is not None:
        return prebuilt_index

    if directory_tree is not None:
        return _build_index(directory_tree)

    now = datetime.now(timezone.utc)
    cached = _INDEX_CACHE.get("index")
    expires_at = _INDEX_CACHE.get("expires_at")
    if cached is not None and isinstance(expires_at, datetime) and now < expires_at:
        return cached

    tree: list[dict[str, Any]] | None = None
    try:
        tree = await directory_cache.get_simplified_directory_tree()
    except Exception:
        logger.warning(
            "Unable to fetch directory tree from cache; using fallback", exc_info=True
        )

    if tree is None:
        tree = _load_local_directory_tree()

    if tree is None:
        return None

    index = _build_index(tree)
    _INDEX_CACHE["index"] = index
    _INDEX_CACHE["expires_at"] = now + _INDEX_TTL
    return index


async def path_matches_department(
    access_path: str,
    department: str,
    *,
    directory_tree: list[dict[str, Any]] | None = None,
    directory_index: _DirectoryIndex | None = None,
) -> bool:
    """Return True when an access path grants visibility for a department.

    Primary strategy: use the LDAP-backed simplified directory tree (shortname/name)
    to verify whether the assistant access node is an ancestor of the user's
    department node. If the directory tree is unavailable or the nodes cannot be
    located, access is denied.
    """

    if not access_path:
        return True

    access_key = _normalize_value(access_path)
    dept_key = _normalize_value(department)

    if access_key is None or dept_key is None:
        return False

    index = await _get_directory_index(directory_tree, prebuilt_index=directory_index)

    if index is None:
        logger.warning("No directory index available; denying access")
        return False

    access_ids = index.find_ids(access_key)
    department_ids = index.find_ids(dept_key)

    if not access_ids or not department_ids:
        return False

    for dept_id in department_ids:
        for acc_id in access_ids:
            if index.is_ancestor(acc_id, dept_id):
                return True

    return False
