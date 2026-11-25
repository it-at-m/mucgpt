from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from config.settings import LDAPSettings
from core import directory_cache
from core.directory_cache import (
    _simplify_node,
    _validate_tree,
    get_directory_children_by_path,
    get_simplified_directory_tree,
)
from core.organization.directory import DepartmentDirectory, OrganizationNode
from core.organization.ldap_loader import LDAPOrganizationLoaderError


def test_simplify_node_uses_shortname_and_children() -> None:
    child = OrganizationNode(
        id="ou=leave-team,ou=dept,o=example",
        name="Leave Team",
        dn="ou=Leave Team,ou=Department,o=example",
        parent_id="ou=dept,o=example",
        attributes={
            "departmentName": ["Leave Team"],
            "departmentCode": ["DEPT-LEAVE"],
            "ou": ["Leave Team"],
            "distinguishedName": [],
        },
    )

    parent = OrganizationNode(
        id="ou=dept,o=example",
        name="Department",
        dn="ou=Department,o=example",
        parent_id="o=example",
        attributes={
            "departmentName": ["Department"],
            "departmentCode": ["DEPT"],
            "ou": ["Department"],
            "distinguishedName": [],
        },
        children=[child],
    )

    simplified = _simplify_node(parent)

    assert simplified == {
        "shortname": "DEPT",
        "name": "Department",
        "children": [
            {
                "shortname": "DEPT-LEAVE",
                "name": "Leave Team",
                "children": [],
            }
        ],
    }


def test_simplify_node_uses_configured_shortname_attribute() -> None:
    node = OrganizationNode(
        id="ou=example,o=test",
        name="Example",
        dn="ou=Example,o=Test",
        attributes={"departmentCode": "EX"},
    )

    simplified = _simplify_node(node)

    assert simplified["shortname"] == "EX"
    assert simplified["name"] == "Example"
    assert simplified["children"] == []


def test_simplify_node_matches_shortname_attribute_case_insensitively() -> None:
    node = OrganizationNode(
        id="ou=example,o=test",
        name="Example",
        dn="ou=Example,o=Test",
        attributes={"directoryCode": "EX"},
    )

    simplified = _simplify_node(node, shortname_attribute="directorycode")

    assert simplified["shortname"] == "EX"


async def _fake_tree():
    return [
        {
            "shortname": "DEPT",
            "name": "Department",
            "children": [
                {
                    "shortname": "DEPT-LEAVE",
                    "name": "Leave Team",
                    "children": [{"name": "Leaf", "children": []}],
                },
                {"name": "NoShort", "children": []},
            ],
        }
    ]


@pytest.mark.asyncio
async def test_get_directory_children_root(monkeypatch) -> None:
    monkeypatch.setattr(
        "core.directory_cache.get_simplified_directory_tree", lambda: _fake_tree()
    )

    children = await get_directory_children_by_path([])

    assert len(children) == 1
    assert children[0]["shortname"] == "DEPT"


@pytest.mark.asyncio
async def test_get_directory_children_missing_path_returns_roots(monkeypatch) -> None:
    monkeypatch.setattr(
        "core.directory_cache.get_simplified_directory_tree", lambda: _fake_tree()
    )

    assert await get_directory_children_by_path(None) == await _fake_tree()


@pytest.mark.asyncio
async def test_get_directory_children_by_shortname(monkeypatch) -> None:
    monkeypatch.setattr(
        "core.directory_cache.get_simplified_directory_tree", lambda: _fake_tree()
    )

    children = await get_directory_children_by_path(["DEPT"])

    assert len(children) == 2
    assert {child["name"] for child in children} == {
        "Leave Team",
        "NoShort",
    }


@pytest.mark.asyncio
async def test_get_directory_children_by_name(monkeypatch) -> None:
    monkeypatch.setattr(
        "core.directory_cache.get_simplified_directory_tree", lambda: _fake_tree()
    )

    children = await get_directory_children_by_path(["DEPT", "Leave Team"])

    assert len(children) == 1
    assert children[0]["name"] == "Leaf"


@pytest.mark.asyncio
async def test_get_directory_children_not_found(monkeypatch) -> None:
    monkeypatch.setattr(
        "core.directory_cache.get_simplified_directory_tree", lambda: _fake_tree()
    )

    with pytest.raises(HTTPException) as exc:
        await get_directory_children_by_path(["DEPT", "MISSING"])

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_directory_tree_returns_fresh_cached_data(monkeypatch) -> None:
    cached_tree = await _fake_tree()
    monkeypatch.setattr(
        directory_cache,
        "_get_cached_tree",
        AsyncMock(
            return_value={
                "data": cached_tree,
                "loaded_at": datetime.now(UTC).isoformat(),
            }
        ),
    )
    load_directory = AsyncMock()
    monkeypatch.setattr(directory_cache, "_load_directory_from_ldap", load_directory)

    assert await get_simplified_directory_tree() == cached_tree
    load_directory.assert_not_called()


@pytest.mark.asyncio
async def test_get_cached_tree_returns_cache_hit_and_miss(monkeypatch) -> None:
    cache_payload = {
        "data": await _fake_tree(),
        "loaded_at": datetime.now(UTC).isoformat(),
    }
    init_redis = AsyncMock()
    get_object = AsyncMock(side_effect=[cache_payload, None])
    monkeypatch.setattr(directory_cache.RedisCache, "init_redis", init_redis)
    monkeypatch.setattr(directory_cache.RedisCache, "get_object", get_object)

    assert await directory_cache._get_cached_tree("directory") == cache_payload
    assert await directory_cache._get_cached_tree("directory") is None
    assert init_redis.await_count == 2
    assert get_object.await_count == 2


def test_validate_tree_removes_unknown_fields() -> None:
    assert _validate_tree(
        [{"name": "Department", "children": [], "unknown": "discarded"}]
    ) == [{"name": "Department", "children": []}]


@pytest.mark.asyncio
async def test_directory_tree_discards_invalid_cache_and_refreshes(monkeypatch) -> None:
    refreshed_tree = await _fake_tree()
    monkeypatch.setattr(
        directory_cache, "_get_cached_tree", AsyncMock(return_value={"data": "invalid"})
    )
    monkeypatch.setattr(
        directory_cache, "_load_directory_from_ldap", lambda: refreshed_tree
    )
    set_cached_tree = AsyncMock()
    monkeypatch.setattr(directory_cache, "_set_cached_tree", set_cached_tree)

    assert await get_simplified_directory_tree() == refreshed_tree
    set_cached_tree.assert_awaited_once_with("mucgpt:directory-tree:v1", refreshed_tree)


@pytest.mark.asyncio
async def test_directory_tree_refreshes_when_cache_is_unavailable(monkeypatch) -> None:
    refreshed_tree = await _fake_tree()
    monkeypatch.setattr(
        directory_cache.RedisCache, "init_redis", AsyncMock(side_effect=OSError)
    )
    monkeypatch.setattr(
        directory_cache, "_load_directory_from_ldap", lambda: refreshed_tree
    )
    monkeypatch.setattr(directory_cache, "_set_cached_tree", AsyncMock())

    assert await get_simplified_directory_tree() == refreshed_tree


@pytest.mark.asyncio
async def test_directory_tree_serves_stale_cache_when_ldap_refresh_fails(
    monkeypatch,
) -> None:
    stale_tree = await _fake_tree()
    monkeypatch.setattr(
        directory_cache,
        "_get_cached_tree",
        AsyncMock(
            return_value={
                "data": stale_tree,
                "loaded_at": (datetime.now(UTC) - timedelta(days=15)).isoformat(),
            }
        ),
    )
    monkeypatch.setattr(
        directory_cache,
        "_load_directory_from_ldap",
        lambda: (_ for _ in ()).throw(LDAPOrganizationLoaderError("offline")),
    )

    assert await get_simplified_directory_tree() == stale_tree


@pytest.mark.asyncio
async def test_directory_tree_ignores_cache_write_failure(monkeypatch) -> None:
    refreshed_tree = await _fake_tree()
    monkeypatch.setattr(
        directory_cache, "_get_cached_tree", AsyncMock(return_value=None)
    )
    monkeypatch.setattr(
        directory_cache, "_load_directory_from_ldap", lambda: refreshed_tree
    )
    monkeypatch.setattr(
        directory_cache.RedisCache,
        "set_object",
        AsyncMock(side_effect=OSError("cache write failed")),
    )

    assert await get_simplified_directory_tree() == refreshed_tree


@pytest.mark.asyncio
async def test_directory_tree_propagates_refresh_error_without_stale_cache(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        directory_cache, "_get_cached_tree", AsyncMock(return_value=None)
    )
    monkeypatch.setattr(
        directory_cache,
        "_load_directory_from_ldap",
        lambda: (_ for _ in ()).throw(LDAPOrganizationLoaderError("offline")),
    )

    with pytest.raises(LDAPOrganizationLoaderError, match="offline"):
        await get_simplified_directory_tree()


def test_load_directory_from_ldap_rejects_disabled_loading(monkeypatch) -> None:
    monkeypatch.setattr(directory_cache, "get_ldap_settings", lambda: LDAPSettings())

    with pytest.raises(HTTPException) as exc:
        directory_cache._load_directory_from_ldap()

    assert exc.value.status_code == 500


def test_load_directory_from_ldap_translates_loader_error(monkeypatch) -> None:
    class FailingLoader:
        def __init__(self, _settings: LDAPSettings) -> None:
            pass

        def load_directory(self) -> DepartmentDirectory:
            raise LDAPOrganizationLoaderError("offline")

    monkeypatch.setattr(
        directory_cache, "get_ldap_settings", lambda: LDAPSettings(enabled=True)
    )
    monkeypatch.setattr(directory_cache, "LDAPOrganizationLoader", FailingLoader)

    with pytest.raises(HTTPException) as exc:
        directory_cache._load_directory_from_ldap()

    assert exc.value.status_code == 500


def test_load_directory_from_ldap_simplifies_loaded_tree(monkeypatch) -> None:
    root = OrganizationNode(
        id="ou=dept,o=example",
        name="Department",
        dn="ou=Department,o=example",
        attributes={"departmentCode": ["DEPT"]},
    )

    class Loader:
        def __init__(self, _settings: LDAPSettings) -> None:
            pass

        def load_directory(self) -> DepartmentDirectory:
            return DepartmentDirectory(roots=[root], source="ldap")

    monkeypatch.setattr(
        directory_cache, "get_ldap_settings", lambda: LDAPSettings(enabled=True)
    )
    monkeypatch.setattr(directory_cache, "LDAPOrganizationLoader", Loader)

    assert directory_cache._load_directory_from_ldap() == [
        {"shortname": "DEPT", "name": "Department", "children": []}
    ]


@pytest.mark.asyncio
async def test_set_cached_tree_swallows_redis_write_error(monkeypatch) -> None:
    monkeypatch.setattr(directory_cache, "get_ldap_settings", lambda: LDAPSettings())
    monkeypatch.setattr(
        directory_cache.RedisCache,
        "set_object",
        AsyncMock(side_effect=OSError("cache write failed")),
    )

    await directory_cache._set_cached_tree("directory", await _fake_tree())
