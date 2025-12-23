from __future__ import annotations

from core.organization import OrganizationTreeBuilder
from core.organization.directory import OrganizationNode


def _entry(dn: str, name: str) -> dict[str, object]:
    return {
        "dn": dn,
        "attributes": {
            "ou": [name],
            "distinguishedName": dn,
            "lhmOULongname": [f"Long {name}"],
            "lhmOUShortname": [f"Short {name}"],
        },
    }


def test_tree_builder_ignores_prefix_and_suffix() -> None:
    entries = [
        _entry("ou=_System,ou=ROOT,o=example", "_System"),
        _entry("ou=Finance-xxx,ou=ROOT,o=example", "Finance-xxx"),
        _entry("ou=Finance,ou=ROOT,o=example", "Finance"),
    ]
    builder = OrganizationTreeBuilder(
        search_base="o=example",
        ignored_prefixes=["_"],
        ignored_suffixes=["-xxx"],
    )

    roots = builder.build(entries)
    builder.sort_children(roots)

    # Root should be the search_base placeholder; only Finance should remain under ROOT
    assert [node.name for node in roots] == ["example"]
    root = roots[0]
    assert [child.name for child in root.children] == ["ROOT"]
    assert [child.name for child in root.children[0].children] == ["Finance"]


def test_children_of_ignored_nodes_are_dropped() -> None:
    entries = [
        _entry("ou=_Archive,ou=ROOT,o=example", "_Archive"),
        _entry("ou=Records,ou=_Archive,ou=ROOT,o=example", "Records"),
    ]
    builder = OrganizationTreeBuilder(
        search_base="o=example",
        ignored_prefixes=["_"],
    )

    roots = builder.build(entries)

    # Search base placeholder remains, but ignored node and its children are gone
    assert [node.name for node in roots] == ["example"]
    root = roots[0]
    assert [child.name for child in root.children] == ["ROOT"]
    assert root.children[0].children == []


def test_ignore_rules_can_be_disabled() -> None:
    entries = [
        _entry("ou=_System,ou=ROOT,o=example", "_System"),
        _entry("ou=Finance-xxx,ou=ROOT,o=example", "Finance-xxx"),
    ]
    builder = OrganizationTreeBuilder(
        search_base="o=example",
        ignored_prefixes=[],
        ignored_suffixes=[],
    )

    roots = builder.build(entries)
    builder.sort_children(roots)

    # With ignore disabled, both units appear under the search_base placeholder
    assert [node.name for node in roots] == ["example"]
    root = roots[0]
    assert [child.name for child in root.children] == ["ROOT"]
    assert set(child.name for child in root.children[0].children) == {
        "_System",
        "Finance-xxx",
    }


def test_nodes_without_required_attributes_are_skipped() -> None:
    entries = [
        {
            "dn": "ou=Finance,ou=ROOT,o=example",
            "attributes": {
                "ou": ["Finance"],
                "distinguishedName": "ou=Finance,ou=ROOT,o=example",
                # missing required attrs
            },
        },
        {
            "dn": "ou=HR,ou=ROOT,o=example",
            "attributes": {
                "ou": ["HR"],
                "distinguishedName": "ou=HR,ou=ROOT,o=example",
                "lhmOULongname": ["Long HR"],
                "lhmOUShortname": ["HR"],
            },
        },
    ]

    builder = OrganizationTreeBuilder(
        search_base="o=example",
        required_attributes=["lhmOULongname", "lhmOUShortname"],
    )

    roots = builder.build(entries)

    # Finance is skipped (missing required), HR remains under search_base placeholder
    assert [node.name for node in roots] == ["example"]
    root = roots[0]
    assert [child.name for child in root.children] == ["ROOT"]
    assert [child.name for child in root.children[0].children] == ["HR"]


def test_parent_chain_is_created_from_dn_when_missing_entries() -> None:
    entries = [
        _entry(
            "ou=Stadtteilbibliothek Westend,ou=Region Südwest,ou=Stadtteilbibliotheken,ou=Münchner Stadtbibliothek,ou=Kulturreferat,o=Landeshauptstadt München,c=de",
            "Stadtteilbibliothek Westend",
        ),
    ]

    builder = OrganizationTreeBuilder(
        search_base="o=landeshauptstadt münchen,c=de",
        # parent_attribute intentionally omitted
        required_attributes=["lhmOULongname", "lhmOUShortname"],
    )

    roots = builder.build(entries)

    # Expect the whole DN chain to be materialized as parents, ending at search_base
    assert len(roots) == 1
    root = roots[0]
    # Search base node
    assert root.name == "Landeshauptstadt München"
    assert len(root.children) == 1
    level1 = root.children[0]
    assert level1.name == "Kulturreferat"
    level2 = level1.children[0]
    assert level2.name == "Münchner Stadtbibliothek"
    level3 = level2.children[0]
    assert level3.name == "Stadtteilbibliotheken"
    level4 = level3.children[0]
    assert level4.name == "Region Südwest"
    level5 = level4.children[0]
    assert level5.name == "Stadtteilbibliothek Westend"


def test_parent_attribute_overrides_dn_parent() -> None:
    entries = [
        _entry("ou=Custom Parent,o=example", "Custom Parent"),
        {
            "dn": "ou=Child,ou=DNParent,o=example",
            "attributes": {
                "ou": ["Child"],
                "distinguishedName": "ou=Child,ou=DNParent,o=example",
                "parent": "ou=Custom Parent,o=example",
                "lhmOULongname": ["Long Child"],
                "lhmOUShortname": ["Short Child"],
            },
        },
    ]

    builder = OrganizationTreeBuilder(
        search_base="o=example",
        parent_attribute="parent",
        required_attributes=["lhmOULongname", "lhmOUShortname"],
    )

    roots = builder.build(entries)

    assert [node.name for node in roots] == ["Custom Parent"]
    root = roots[0]
    assert [child.name for child in root.children] == ["Child"]


def test_parent_chain_respects_search_base_boundary() -> None:
    entries = [
        _entry(
            "ou=Child,ou=Parent,o=example,c=de",
            "Child",
        ),
    ]

    builder = OrganizationTreeBuilder(
        search_base="o=example,c=de",
        required_attributes=["lhmOULongname", "lhmOUShortname"],
    )

    roots = builder.build(entries)

    # Should stop creating parents above search_base; no country node
    assert [node.name for node in roots] == ["example"]
    root = roots[0]
    assert [child.name for child in root.children] == ["Parent"]
    assert [child.name for child in root.children[0].children] == ["Child"]


def test_bytes_are_decoded_and_display_uses_attribute() -> None:
    entries = [
        {
            "dn": "ou=Ümlaut,ou=ROOT,o=example",
            "attributes": {
                "ou": [b"\xc3\xbcber"],  # bytes for "über"
                "distinguishedName": b"ou=\xc3\xbcmlaut,ou=ROOT,o=example",
                "lhmOULongname": [b"Lange \xc3\x9cmlaut"],
                "lhmOUShortname": [b"KU-UE"],
            },
        }
    ]

    builder = OrganizationTreeBuilder(
        search_base="o=example",
        required_attributes=["lhmOULongname", "lhmOUShortname"],
    )

    roots = builder.build(entries)

    assert [node.name for node in roots] == ["example"]
    root = roots[0]
    assert [child.name for child in root.children] == ["ROOT"]
    umlaut = root.children[0].children[0]
    # Name derived from decoded attribute value
    assert umlaut.name == "über"
    assert umlaut.attributes["ou"] == ["über"]


def test_normalize_dn_trims_and_lowers() -> None:
    builder = OrganizationTreeBuilder()

    assert (
        builder._normalize_dn("  OU=Finance , O=Example ") == "ou=finance , o=example"
    )
    assert builder._normalize_dn(None) == ""


def test_parent_from_dn_respects_search_base() -> None:
    builder = OrganizationTreeBuilder(search_base="o=example,c=de")

    assert builder._parent_from_dn("ou=Child,o=example,c=de") == "o=example,c=de"
    # parent outside search_base is ignored
    assert builder._parent_from_dn("ou=Child,o=other,c=de") is None


def test_determine_parent_identifier_uses_attribute_then_dn() -> None:
    builder = OrganizationTreeBuilder(
        parent_attribute="parent", search_base="o=example"
    )

    attrs = {"parent": "ou=Custom,o=example"}
    assert (
        builder._determine_parent_identifier("ou=child,o=example", attrs)
        == "ou=custom,o=example"
    )

    builder2 = OrganizationTreeBuilder(search_base="o=example")
    assert (
        builder2._determine_parent_identifier("ou=child,ou=parent,o=example", {})
        == "ou=parent,o=example"
    )


def test_has_required_attributes_various_cases() -> None:
    builder = OrganizationTreeBuilder(required_attributes=["need", "other"])

    assert builder._has_required_attributes({"need": "x", "other": [b"y"]})
    assert not builder._has_required_attributes({"need": "x"})
    assert not builder._has_required_attributes({"need": "", "other": "y"})
    assert not builder._has_required_attributes({"need": [], "other": "y"})


def test_ensure_parent_chain_creates_placeholders() -> None:
    builder = OrganizationTreeBuilder(search_base="o=example")
    child = OrganizationNode(
        id="ou=child,o=example",
        name="child",
        dn="ou=child,o=example",
        parent_id="o=example",
        attributes={},
    )
    nodes = {child.id: child}

    builder._ensure_parent_chain(child, nodes)

    assert "o=example" in nodes
    parent = nodes["o=example"]
    assert parent.name == "example"
    assert parent.parent_id is None


def test_filter_ignored_nodes_prunes_branch() -> None:
    builder = OrganizationTreeBuilder(ignored_prefixes=["_"])

    parent = OrganizationNode(id="o=example", name="example", dn="o=example")
    ignored = OrganizationNode(
        id="ou=_Hidden,o=example",
        name="_Hidden",
        dn="ou=_Hidden,o=example",
        parent_id="o=example",
    )
    child = OrganizationNode(
        id="ou=Child,ou=_Hidden,o=example",
        name="Child",
        dn="ou=Child,ou=_Hidden,o=example",
        parent_id="ou=_Hidden,o=example",
    )
    nodes = {
        parent.id: parent,
        ignored.id: ignored,
        child.id: child,
    }
    roots = builder._link_nodes(nodes)

    filtered = builder._filter_ignored_nodes(roots, nodes, {})

    assert [r.id for r in filtered] == ["o=example"]
    assert filtered[0].children == []


def test_link_nodes_links_children() -> None:
    builder = OrganizationTreeBuilder()

    parent = OrganizationNode(id="o=example", name="example", dn="o=example")
    child = OrganizationNode(
        id="ou=child,o=example",
        name="child",
        dn="ou=child,o=example",
        parent_id="o=example",
    )
    nodes = {parent.id: parent, child.id: child}

    roots = builder._link_nodes(nodes)

    assert [r.id for r in roots] == ["o=example"]
    assert roots[0].children[0].id == child.id
