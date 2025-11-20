from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class _Token:
    """Represents a token in a hierarchical department path."""

    value: str
    delimiter: str | None


def _tokenize(path: str) -> list[_Token]:
    """Split a hierarchical path into tokens while keeping delimiter context.

    The delimiter stored in each token is the delimiter that FOLLOWS the token value.
    """
    if not path:
        return [_Token("", None)]

    tokens: list[_Token] = []
    current: list[str] = []

    for i, char in enumerate(path):
        if char in {"-", "/"}:
            if current:
                # Look ahead to find what delimiter follows this token
                next_delimiter = char
                tokens.append(_Token("".join(current), next_delimiter))
                current = []
        else:
            current.append(char)

    # Last token has no following delimiter
    if current:
        tokens.append(_Token("".join(current), None))

    return tokens


def path_matches_department(access_path: str, department: str) -> bool:
    """Return True when an access path grants visibility for a department."""
    if not access_path:
        return True

    if department == access_path:
        return True

    path_tokens = _tokenize(access_path)
    department_tokens = _tokenize(department)

    if len(department_tokens) < len(path_tokens):
        return False

    for i, (path_token, department_token) in enumerate(
        zip(path_tokens, department_tokens)
    ):
        if path_token.value == department_token.value:
            continue

        # Special case: slash-delimited numeric segments support hierarchical matching
        # E.g., "POR-5/1" should match "POR-5/12"
        # We check if the PREVIOUS token had a "/" delimiter
        previous_delimiter = path_tokens[i - 1].delimiter if i > 0 else None
        if (
            previous_delimiter == "/"
            and path_token.value.isdigit()
            and department_token.value.isdigit()
            and department_token.value.startswith(path_token.value)
        ):
            # Slash-delimited segments support numeric refinement (e.g. 1 -> 12)
            continue

        return False

    return True
