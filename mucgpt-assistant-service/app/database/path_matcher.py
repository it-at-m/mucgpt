"""
Path Matcher Module

This module implements the logic for verifying access permissions based on organizational
hierarchy (Directory Tree).

Concepts:
1. Directory Tree: A hierarchical representation of the organization (e.g., Departments, Units).
   Each node has a 'name' and 'shortname'.
2. Access Path: A string identifier (name or shortname) representing a node in the tree.
   This node defines the root of a subtree that has access to a resource.
3. User Department: A string identifier (name or shortname) representing the user's position
   in the tree.
4. Ancestry Check: Access is granted if the 'Access Path' node is an ancestor of (or the same as)
   the 'User Department' node. This means permissions flow downwards in the hierarchy.

Implementation Details:
- _DirectoryIndex: An optimized in-memory structure that maps names/shortnames to internal
  node IDs and stores parent pointers for efficient O(h) ancestry lookups (where h is tree height).
- Caching: The directory tree is fetched from a cache service (Redis/LDAP) or a local fallback file.
  The built index is cached in memory for a short duration (_INDEX_TTL) to reduce overhead.
- Normalization: All comparisons are case-insensitive and ignore leading/trailing whitespace.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

from core import directory_cache
from core.logtools import getLogger

logger = getLogger(__name__)


def _normalize_value(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned.lower() if cleaned else None


def _extract_name_aliases(name: str | None) -> set[str]:
    """Extract aliases from display names, e.g. '(AWM)' from a node name."""
    if not isinstance(name, str):
        return set()

    aliases: set[str] = set()
    for match in re.findall(r"\(([^()]+)\)", name):
        alias = _normalize_value(match)
        if alias:
            aliases.add(alias)
    return aliases


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

    def ancestors_with_self(self, node_id: int) -> list[int]:
        ancestors: list[int] = []
        current = node_id
        while current is not None:
            ancestors.append(current)
            current = self.parent.get(current)
        return ancestors

    def depth(self, node_id: int) -> int:
        depth = 0
        current = self.parent.get(node_id)
        while current is not None:
            depth += 1
            current = self.parent.get(current)
        return depth


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

        name_aliases = _extract_name_aliases(node.get("name"))

        for key in {shortname, name, *name_aliases}:
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


def _resolve_department_ids(
    department_key: str | None, index: _DirectoryIndex
) -> set[int]:
    """Resolve department IDs by exact key and dashed-suffix fallback."""
    if department_key is None:
        return set()

    exact = index.find_ids(department_key)
    if exact:
        return exact

    parts = [part for part in department_key.split("-") if part]
    if len(parts) < 2:
        return set()

    for start in range(1, len(parts)):
        candidate = "-".join(parts[start:])
        candidate_ids = index.find_ids(candidate)
        if candidate_ids:
            return candidate_ids

    return set()


def _resolve_access_ids(access_key: str | None, index: _DirectoryIndex) -> set[int]:
    """Resolve access IDs by exact key and family-prefix fallback.

    Family-prefix fallback supports selecting high-level codes where the exact node
    has no shortname (for example 'KULT' matching descendants 'KULT-*').
    """
    if access_key is None:
        return set()

    exact = index.find_ids(access_key)
    if exact:
        return exact

    candidates: set[int] = set()
    family_prefix = f"{access_key}-"
    for key, ids in index.key_to_ids.items():
        if key.startswith(family_prefix):
            candidates.update(ids)

    if not candidates:
        return set()

    common_ancestors: set[int] | None = None
    for node_id in candidates:
        ancestors = set(index.ancestors_with_self(node_id))
        if common_ancestors is None:
            common_ancestors = ancestors
        else:
            common_ancestors &= ancestors

        if not common_ancestors:
            return candidates

    if not common_ancestors:
        return candidates

    deepest_common = max(common_ancestors, key=index.depth)
    return {deepest_common}


async def _get_directory_index(
    directory_tree: list[dict[str, Any]] | None = None,
    *,
    prebuilt_index: _DirectoryIndex | None = None,
) -> _DirectoryIndex | None:
    """Return cached directory index, refreshing from LDAP/Redis."""

    if prebuilt_index is not None:
        return prebuilt_index

    if directory_tree is not None:
        return _build_index(directory_tree)

    now = datetime.now(UTC)
    cached = _INDEX_CACHE.get("index")
    expires_at = _INDEX_CACHE.get("expires_at")
    if cached is not None and isinstance(expires_at, datetime) and now < expires_at:
        return cached

    tree: list[dict[str, Any]] | None = None
    try:
        tree = await directory_cache.get_simplified_directory_tree()
    except Exception:
        logger.warning("Unable to fetch directory tree from cache", exc_info=True)

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

    access_ids = _resolve_access_ids(access_key, index)
    department_ids = _resolve_department_ids(dept_key, index)

    if not access_ids or not department_ids:
        return False

    for dept_id in department_ids:
        for acc_id in access_ids:
            if index.is_ancestor(acc_id, dept_id):
                return True

    return False
