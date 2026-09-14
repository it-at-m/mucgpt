from __future__ import annotations

import pytest
from fastapi import HTTPException

from core.directory_cache import _simplify_node, get_directory_children_by_path
from core.organization.directory import OrganizationNode


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


async def _fake_tree():
    return [
        {
            "shortname": "DEPT",
            "name": "Department",
            "children": [
                {
                    "shortname": "DEPT-LEAVE",
                    "name": "Leave Team",
                    "children": [{"shortname": None, "name": "Leaf", "children": []}],
                },
                {"shortname": None, "name": "NoShort", "children": []},
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
