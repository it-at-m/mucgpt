from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Sequence

from fastapi import HTTPException, status

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


def _simplify_node(node: OrganizationNode) -> dict[str, Any]:
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


def _match_node(segment: str, node: dict[str, Any]) -> bool:
    target = _normalize_key(segment)
    if target is None:
        return False

    shortname = _normalize_key(node.get("shortname"))
    name = _normalize_key(node.get("name"))
    return target == shortname or target == name


def _find_node_by_path(
    nodes: Iterable[dict[str, Any]], path: Sequence[str]
) -> dict[str, Any]:
    current_children: Iterable[dict[str, Any]] = nodes
    current: dict[str, Any] | None = None

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


def _load_directory_from_ldap() -> list[dict[str, Any]]:
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

    return [_simplify_node(root) for root in directory.roots]


async def _get_cached_tree(key: str) -> dict[str, Any] | None:
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


async def _set_cached_tree(key: str, data: list[dict[str, Any]]) -> None:
    try:
        payload = {"data": data, "loaded_at": datetime.now(timezone.utc).isoformat()}
        # TTL slightly longer than freshness check to allow stale fallback
        await RedisCache.set_object(
            key, payload, ttl=int(_CACHE_TTL.total_seconds() * 1.5)
        )
    except Exception:
        logger.warning("Failed to write directory tree to Redis cache", exc_info=True)


async def get_simplified_directory_tree() -> list[dict[str, Any]]:
    cache_key = "mucgpt:directory-tree:v1"
    cached_wrapper = await _get_cached_tree(cache_key)

    cached_data: list[dict[str, Any]] | None = None
    cached_loaded_at: datetime | None = None
    if isinstance(cached_wrapper, dict):
        cached_data = (
            cached_wrapper.get("data")
            if isinstance(cached_wrapper.get("data"), list)
            else None
        )
        loaded_at_raw = cached_wrapper.get("loaded_at")
        if isinstance(loaded_at_raw, str):
            try:
                cached_loaded_at = datetime.fromisoformat(loaded_at_raw)
            except ValueError:
                cached_loaded_at = None

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
) -> list[dict[str, Any]]:
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
