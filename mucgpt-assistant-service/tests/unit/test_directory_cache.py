from __future__ import annotations

import pytest
from fastapi import HTTPException

from core.directory_cache import _simplify_node, get_directory_children_by_path
from core.organization.directory import OrganizationNode


def test_simplify_node_uses_shortname_and_children() -> None:
    child = OrganizationNode(
        id="ou=beurlaubte des baureferates,ou=baureferat,o=landeshauptstadt münchen,c=de",
        name="Beurlaubte des Baureferates",
        dn="ou=Beurlaubte des Baureferates,ou=Baureferat,o=Landeshauptstadt München,c=de",
        parent_id="ou=baureferat,o=landeshauptstadt münchen,c=de",
        attributes={
            "lhmOULongname": ["Beurlaubte des Baureferates"],
            "lhmOUShortname": ["BAU-BEURL"],
            "ou": ["Beurlaubte des Baureferates"],
            "distinguishedName": [],
        },
    )

    parent = OrganizationNode(
        id="ou=baureferat,o=landeshauptstadt münchen,c=de",
        name="Baureferat",
        dn="ou=Baureferat,o=Landeshauptstadt München,c=de",
        parent_id="o=landeshauptstadt münchen,c=de",
        attributes={
            "lhmOULongname": ["Baureferat"],
            "lhmOUShortname": ["BAU"],
            "ou": ["Baureferat"],
            "distinguishedName": [],
        },
        children=[child],
    )

    simplified = _simplify_node(parent)

    assert simplified == {
        "shortname": "BAU",
        "name": "Baureferat",
        "children": [
            {
                "shortname": "BAU-BEURL",
                "name": "Beurlaubte des Baureferates",
                "children": [],
            }
        ],
    }


def test_simplify_node_accepts_shortname_variants() -> None:
    node = OrganizationNode(
        id="ou=example,o=test",
        name="Example",
        dn="ou=Example,o=Test",
        attributes={"lhmOUShortName": "EX"},
    )

    simplified = _simplify_node(node)

    assert simplified["shortname"] == "EX"
    assert simplified["name"] == "Example"
    assert simplified["children"] == []


async def _fake_tree():
    return [
        {
            "shortname": "BAU",
            "name": "Baureferat",
            "children": [
                {
                    "shortname": "BAU-BEURL",
                    "name": "Beurlaubte des Baureferates",
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
    assert children[0]["shortname"] == "BAU"


@pytest.mark.asyncio
async def test_get_directory_children_by_shortname(monkeypatch) -> None:
    monkeypatch.setattr(
        "core.directory_cache.get_simplified_directory_tree", lambda: _fake_tree()
    )

    children = await get_directory_children_by_path(["BAU"])

    assert len(children) == 2
    assert {child["name"] for child in children} == {
        "Beurlaubte des Baureferates",
        "NoShort",
    }


@pytest.mark.asyncio
async def test_get_directory_children_by_name(monkeypatch) -> None:
    monkeypatch.setattr(
        "core.directory_cache.get_simplified_directory_tree", lambda: _fake_tree()
    )

    children = await get_directory_children_by_path(
        ["BAU", "Beurlaubte des Baureferates"]
    )

    assert len(children) == 1
    assert children[0]["name"] == "Leaf"


@pytest.mark.asyncio
async def test_get_directory_children_not_found(monkeypatch) -> None:
    monkeypatch.setattr(
        "core.directory_cache.get_simplified_directory_tree", lambda: _fake_tree()
    )

    with pytest.raises(HTTPException) as exc:
        await get_directory_children_by_path(["BAU", "MISSING"])

    assert exc.value.status_code == 404
