"""Unit tests for the path_matcher module using the LDAP directory tree semantics."""

import pytest

from database.path_matcher import path_matches_department

TEST_TREE = [
    {
        "shortname": "ORG",
        "name": "Organization",
        "children": [
            {
                "shortname": "DEPT",
                "name": "DEPT",
                "children": [
                    {
                        "shortname": "DEPT-TEAM",
                        "name": "DEPT-TEAM",
                        "children": [
                            {
                                "shortname": "DEPT-TEAM-UNIT",
                                "name": "DEPT-TEAM-UNIT",
                                "children": [],
                            }
                        ],
                    },
                    {"shortname": "DEPT-OTHER", "name": "DEPT-OTHER", "children": []},
                ],
            }
        ],
    },
    {
        "shortname": "DIVISION",
        "name": "Division",
        "children": [
            {
                "shortname": "DIVISION-5",
                "name": "DIVISION-5",
                "children": [
                    {
                        "shortname": "DIVISION-5/1",
                        "name": "DIVISION-5/1",
                        "children": [
                            {
                                "shortname": "DIVISION-5/12",
                                "name": "DIVISION-5/12",
                                "children": [],
                            },
                            {
                                "shortname": "DIVISION-5/14",
                                "name": "DIVISION-5/14",
                                "children": [],
                            },
                        ],
                    },
                    {
                        "shortname": "DIVISION-5-OTHER",
                        "name": "DIVISION-5-OTHER",
                        "children": [],
                    },
                ],
            }
        ],
    },
]

FALLBACK_TREE = [
    {
        "shortname": "SERVICES",
        "name": "Services",
        "children": [
            {
                "shortname": "SERVICES-OPERATIONS",
                "name": "Operations",
                "children": [
                    {
                        "shortname": None,
                        "name": "Operations Unit (OPS)",
                        "children": [
                            {
                                "shortname": "OPS-PEOPLE",
                                "name": "People Operations (PEOPLE)",
                                "children": [
                                    {
                                        "shortname": "PEOPLE-SUPPORT",
                                        "name": "Support Team (PEOPLE-SUPPORT)",
                                        "children": [],
                                    }
                                ],
                            }
                        ],
                    }
                ],
            }
        ],
    },
    {
        "shortname": None,
        "name": "Knowledge Services",
        "children": [
            {
                "shortname": "GROUP-LIBRARY",
                "name": "Library Services",
                "children": [
                    {
                        "shortname": "GROUP-LIBRARY-CENTRAL",
                        "name": "Central Library",
                        "children": [],
                    }
                ],
            }
        ],
    },
]


@pytest.mark.asyncio
async def test_tree_exact_and_ancestor_match():
    assert await path_matches_department(
        "DEPT-TEAM", "DEPT-TEAM", directory_tree=TEST_TREE
    )
    assert await path_matches_department(
        "ORG", "DEPT-TEAM-UNIT", directory_tree=TEST_TREE
    )  # ancestor
    assert await path_matches_department(
        "DEPT-TEAM", "DEPT-TEAM-UNIT", directory_tree=TEST_TREE
    )


@pytest.mark.asyncio
async def test_tree_sibling_mismatch():
    assert not await path_matches_department(
        "DEPT-TEAM", "DEPT-OTHER", directory_tree=TEST_TREE
    )
    assert not await path_matches_department(
        "DIVISION-5/1", "DIVISION-5-OTHER", directory_tree=TEST_TREE
    )


@pytest.mark.asyncio
async def test_tree_numeric_branches():
    assert await path_matches_department(
        "DIVISION-5/1", "DIVISION-5/12", directory_tree=TEST_TREE
    )
    assert await path_matches_department(
        "DIVISION-5", "DIVISION-5/12", directory_tree=TEST_TREE
    )
    assert not await path_matches_department(
        "DIVISION-5/2", "DIVISION-5/12", directory_tree=TEST_TREE
    )


@pytest.mark.asyncio
async def test_case_insensitive_tree_match():
    assert await path_matches_department(
        "org", "dept-team-unit", directory_tree=TEST_TREE
    )


@pytest.mark.asyncio
async def test_empty_access_path_allows_all():
    assert await path_matches_department("", "ANY-DEPT", directory_tree=TEST_TREE)
    assert await path_matches_department("", "", directory_tree=TEST_TREE)


@pytest.mark.asyncio
async def test_access_alias_and_department_suffix_fallback():
    assert await path_matches_department(
        "OPS", "OPS-PEOPLE-SUPPORT", directory_tree=FALLBACK_TREE
    )


@pytest.mark.asyncio
async def test_access_family_fallback_for_null_shortname_parent():
    assert await path_matches_department(
        "GROUP", "GROUP-LIBRARY-CENTRAL", directory_tree=FALLBACK_TREE
    )
