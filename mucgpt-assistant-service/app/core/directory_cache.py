from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Iterable, Sequence, TypeAlias, TypedDict

from fastapi import HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from config.settings import get_ldap_settings
from core.cache import RedisCache
from core.logtools import getLogger
from core.organization import (
    LDAPOrganizationLoader,
    LDAPOrganizationLoaderError,
    OrganizationNode,
)

logger = getLogger(__name__)

_CACHE_TTL = timedelta(days=14)


class DirectoryTreeNode(TypedDict, total=False):
    shortname: str | None
    name: str
    children: list[DirectoryTreeNode]


DirectoryTree: TypeAlias = list[DirectoryTreeNode]


class _DirectoryTreeNodeModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    shortname: str | None = None
    name: str
    children: list[_DirectoryTreeNodeModel] = Field(default_factory=list)


class _CacheEnvelopeModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: list[_DirectoryTreeNodeModel]
    loaded_at: datetime


_TREE_ADAPTER = TypeAdapter(list[_DirectoryTreeNodeModel])


def _dump_tree(nodes: list[_DirectoryTreeNodeModel]) -> DirectoryTree:
    return [node.model_dump(mode="python", exclude_none=True) for node in nodes]


def _validate_tree(raw: object) -> DirectoryTree:
    nodes = _TREE_ADAPTER.validate_python(raw)
    return _dump_tree(nodes)


class _CacheEnvelope(TypedDict):
    data: list[DirectoryTreeNode]
    loaded_at: str


def _simplify_node(node: OrganizationNode) -> DirectoryTreeNode:
    attrs = node.attributes or {}
    shortname = None
    shortnames = attrs.get("lhmOUShortname") or attrs.get("lhmOUShortName")
    if isinstance(shortnames, list) and shortnames:
        shortname = shortnames[0]
    elif isinstance(shortnames, str):
        shortname = shortnames

    children = [_simplify_node(child) for child in node.children]
    return {
        "shortname": shortname,
        "name": node.name or node.dn or "",
        "children": children,
    }


def _normalize_key(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned.lower() if cleaned else None


def _match_node(segment: str, node: DirectoryTreeNode) -> bool:
    target = _normalize_key(segment)
    if target is None:
        return False

    shortname = _normalize_key(node.get("shortname"))
    name = _normalize_key(node.get("name"))
    return target == shortname or target == name


def _find_node_by_path(
    nodes: Iterable[DirectoryTreeNode], path: Sequence[str]
) -> DirectoryTreeNode:
    current_children: Iterable[DirectoryTreeNode] = nodes
    current: DirectoryTreeNode | None = None

    for segment in path:
        match = next(
            (node for node in current_children if _match_node(segment, node)), None
        )
        if match is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Directory path segment not found: {segment}",
            )
        current = match
        current_children = match.get("children") or []

    if current is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unable to resolve directory path",
        )

    return current


def _load_directory_from_ldap() -> DirectoryTree:
    ldap_settings = get_ldap_settings()
    if not ldap_settings.ENABLED:
        logger.error(
            "LDAP directory loading requested but MUCGPT_LDAP_ENABLED is false"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LDAP directory loading is disabled",
        )

    loader = LDAPOrganizationLoader(ldap_settings)
    try:
        directory = loader.load_directory()
    except LDAPOrganizationLoaderError as exc:
        logger.exception("Failed to load LDAP directory: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load directory from LDAP",
        ) from exc

    raw_nodes = [_simplify_node(root) for root in directory.roots]
    validated_nodes = _TREE_ADAPTER.validate_python(raw_nodes)
    return _dump_tree(validated_nodes)


async def _get_cached_tree(key: str) -> _CacheEnvelope | None:
    try:
        await RedisCache.init_redis()
        cached = await RedisCache.get_object(key)
        if cached is not None:
            return cached
    except Exception:
        logger.warning(
            "Redis cache unavailable; falling back to LDAP load", exc_info=True
        )
    return None


async def _set_cached_tree(key: str, data: DirectoryTree) -> None:
    try:
        validated_nodes = _TREE_ADAPTER.validate_python(data)
        envelope = _CacheEnvelopeModel(
            data=validated_nodes, loaded_at=datetime.now(timezone.utc)
        )
        payload = envelope.model_dump(mode="json")
        # TTL slightly longer than freshness check to allow stale fallback
        await RedisCache.set_object(
            key, payload, ttl=int(_CACHE_TTL.total_seconds() * 1.5)
        )
    except Exception:
        logger.warning("Failed to write directory tree to Redis cache", exc_info=True)


async def get_simplified_directory_tree() -> DirectoryTree:
    cache_key = "mucgpt:directory-tree:v1"
    cached_wrapper = await _get_cached_tree(cache_key)

    cached_data: list[DirectoryTreeNode] | None = None
    cached_loaded_at: datetime | None = None
    if isinstance(cached_wrapper, dict):
        try:
            envelope = _CacheEnvelopeModel.model_validate(cached_wrapper)
            cached_data = _dump_tree(envelope.data)
            cached_loaded_at = envelope.loaded_at
        except Exception:
            logger.warning("Discarding invalid cached directory tree", exc_info=True)

    # If we have fresh cached data, return it
    if cached_data is not None and cached_loaded_at is not None:
        if datetime.now(timezone.utc) - cached_loaded_at < _CACHE_TTL:
            return cached_data

    # Either no cache, or stale cache: try refresh
    try:
        data = await asyncio.to_thread(_load_directory_from_ldap)
        await _set_cached_tree(cache_key, data)
        return data
    except Exception:
        # Refresh failed: if we had stale data, serve it; otherwise propagate error
        if cached_data is not None:
            logger.warning(
                "Serving stale directory data after refresh failure", exc_info=True
            )
            return cached_data
        raise


async def get_directory_children_by_path(
    path: Sequence[str] | None,
) -> list[DirectoryTreeNode]:
    """Return only the children for a path of org units (shortname or name).

    An empty or missing path returns the roots. Matching is case-insensitive and
    tries shortname first, then name. Raises 404 if any segment cannot be found.
    """

    tree = await get_simplified_directory_tree()

    if not path:
        return tree

    node = _find_node_by_path(tree, path)
    children = node.get("children")
    return children if isinstance(children, list) else []
