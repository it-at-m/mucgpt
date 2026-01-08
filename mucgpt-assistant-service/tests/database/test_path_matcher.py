"""Unit tests for the path_matcher module using the LDAP directory tree semantics."""

import pytest
from src.database.path_matcher import path_matches_department

TEST_TREE = [
    {
        "shortname": "RIT",
        "name": "IT-Referat",
        "children": [
            {
                "shortname": "ITM",
                "name": "ITM",
                "children": [
                    {
                        "shortname": "ITM-KM",
                        "name": "ITM-KM",
                        "children": [
                            {
                                "shortname": "ITM-KM-DI",
                                "name": "ITM-KM-DI",
                                "children": [],
                            }
                        ],
                    },
                    {"shortname": "ITM-AB", "name": "ITM-AB", "children": []},
                ],
            }
        ],
    },
    {
        "shortname": "POR",
        "name": "Personal- und Organisationsreferat",
        "children": [
            {
                "shortname": "POR-5",
                "name": "POR-5",
                "children": [
                    {
                        "shortname": "POR-5/1",
                        "name": "POR-5/1",
                        "children": [
                            {
                                "shortname": "POR-5/12",
                                "name": "POR-5/12",
                                "children": [],
                            },
                            {
                                "shortname": "POR-5/14",
                                "name": "POR-5/14",
                                "children": [],
                            },
                        ],
                    },
                    {"shortname": "POR-5-AB", "name": "POR-5-AB", "children": []},
                ],
            }
        ],
    },
]


@pytest.mark.asyncio
async def test_tree_exact_and_ancestor_match():
    assert await path_matches_department("ITM-KM", "ITM-KM", directory_tree=TEST_TREE)
    assert await path_matches_department(
        "RIT", "ITM-KM-DI", directory_tree=TEST_TREE
    )  # ancestor
    assert await path_matches_department(
        "ITM-KM", "ITM-KM-DI", directory_tree=TEST_TREE
    )


@pytest.mark.asyncio
async def test_tree_sibling_mismatch():
    assert not await path_matches_department(
        "ITM-KM", "ITM-AB", directory_tree=TEST_TREE
    )
    assert not await path_matches_department(
        "POR-5/1", "POR-5-AB", directory_tree=TEST_TREE
    )


@pytest.mark.asyncio
async def test_tree_numeric_branches():
    assert await path_matches_department(
        "POR-5/1", "POR-5/12", directory_tree=TEST_TREE
    )
    assert await path_matches_department("POR-5", "POR-5/12", directory_tree=TEST_TREE)
    assert not await path_matches_department(
        "POR-5/2", "POR-5/12", directory_tree=TEST_TREE
    )


@pytest.mark.asyncio
async def test_case_insensitive_tree_match():
    assert await path_matches_department("rit", "itm-km-di", directory_tree=TEST_TREE)


@pytest.mark.asyncio
async def test_empty_access_path_allows_all():
    assert await path_matches_department("", "ANY-DEPT", directory_tree=TEST_TREE)
    assert await path_matches_department("", "", directory_tree=TEST_TREE)
