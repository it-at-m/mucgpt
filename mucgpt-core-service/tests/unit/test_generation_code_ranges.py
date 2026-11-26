"""Parity vectors for the verbatim-range parser (issue #228 mirror): the
frontend's collectVerbatimRanges in canvasHtmlWhitelist.ts must produce
identical ranges for the same inputs — keep both suites' vectors in sync."""

import pytest

from api.routers.generation_router import _code_ranges

VECTORS: list[tuple[str, list[tuple[int, int]]]] = [
    ("```\ncode\n```\ntext", [(0, 13)]),
    ("a `span` b", [(2, 8)]),
    ("text\n\n~~~\nunclosed ~~~ fence\nmore", [(6, 33)]),
    ("before\n```\n`inner span`\n```\nafter `x` end", [(7, 28), (34, 37)]),
    ("```\nfirst\n```\nmiddle\n```\nsecond\n```", [(0, 14), (21, 35)]),
]


@pytest.mark.unit
@pytest.mark.parametrize(("text", "expected"), VECTORS)
def test_code_ranges_matches_the_frontend_mirror(
    text: str, expected: list[tuple[int, int]]
) -> None:
    assert _code_ranges(text) == expected
