"""License policy helpers for the root pyproject.toml ``[tool.licensecheck]``.

Expressions are parsed with OR/AND and parentheses; anything that does not
resolve to an ``allowed`` or ``warn`` identifier is unapproved
(fail-closed, no guessing).
"""

import os
import re
import tomllib
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

_DEFAULT_PYPROJECT = Path(__file__).resolve().parents[2] / "pyproject.toml"


def _policy_path() -> Path:
    """Policy file location, overridable for the in-image generator."""
    override = os.environ.get("MUCGPT_LICENSE_POLICY")
    return Path(override) if override else _DEFAULT_PYPROJECT


PERMISSIVE = "permissive"
WEAK_COPYLEFT = "weak_copyleft"
UNAPPROVED = "unapproved"

_RANK = {PERMISSIVE: 0, WEAK_COPYLEFT: 1, UNAPPROVED: 2}

# Common metadata spellings mapped to SPDX identifiers. Everything that is not
# listed here and does not already look like a valid SPDX token stays
# unrecognized and therefore unapproved.
_ALIASES = {
    "mit license": "MIT",
    "mit-cmu": "MIT-CMU",
    "cmu license (mit-cmu)": "MIT-CMU",
    "apache software license": "Apache-2.0",
    "apache license, version 2.0": "Apache-2.0",
    "apache license 2.0": "Apache-2.0",
    "apache 2.0": "Apache-2.0",
    "apache-2.0": "Apache-2.0",
    "bsd license": "BSD-3-Clause",
    "3-clause bsd license": "BSD-3-Clause",
    "bsd-3-clause": "BSD-3-Clause",
    "2-clause bsd license": "BSD-2-Clause",
    "simplified bsd license": "BSD-2-Clause",
    "bsd-2-clause": "BSD-2-Clause",
    "isc license (iscl)": "ISC",
    "isc license": "ISC",
    "isc": "ISC",
    "python software foundation license": "PSF-2.0",
    "python software foundation license 2.0": "PSF-2.0",
    "python software foundation license 2.0 (psf-2.0)": "PSF-2.0",
    "psf-2.0": "PSF-2.0",
    "the unlicense (unlicense)": "Unlicense",
    "the unlicense": "Unlicense",
    "unlicense": "Unlicense",
    "cc0 1.0 universal (cc0 1.0)": "CC0-1.0",
    "cc0 1.0 universal": "CC0-1.0",
    "public domain": "Unlicense",
    "mozilla public license 2.0 (mpl 2.0)": "MPL-2.0",
    "mozilla public license 2.0": "MPL-2.0",
    "mpl-2.0": "MPL-2.0",
    "gnu lesser general public license v2 (lgplv2)": "LGPL-2.1-or-later",
    "gnu lesser general public license v2.1 (lgpl 2.1)": "LGPL-2.1-or-later",
    "gnu lesser general public license v3 (lgplv3)": "LGPL-3.0-or-later",
    "gnu library or lesser general public license (lgpl)": "LGPL-2.1-or-later",
    "lgpl-2.1-or-later": "LGPL-2.1-or-later",
    "lgpl-3.0-or-later": "LGPL-3.0-or-later",
    "gnu general public license v2 (gplv2)": "GPL-2.0-or-later",
    "gnu general public license v3 (gplv3)": "GPL-3.0-or-later",
    "gnu general public license (gpl)": "GPL-3.0-or-later",
    "gpl-2.0-or-later": "GPL-2.0-or-later",
    "gpl-3.0-or-later": "GPL-3.0-or-later",
    "gnu affero general public license v3": "AGPL-3.0-or-later",
    "gnu affero general public license (agpl)": "AGPL-3.0-or-later",
    "agpl-3.0-or-later": "AGPL-3.0-or-later",
}

_UNKNOWN_TOKENS = {"", "unknown", "unknown!", "none", "null"}

# Identifying sentences of standard license texts as embedded in package
# metadata. Only consulted when the metadata is longer than a license name
# could be, and deliberately restricted to texts whose wording is fixed.
_FULL_TEXT_MARKERS = [
    ("permission is hereby granted, free of charge", "MIT"),
    ("licensed under the apache license, version 2.0", "Apache-2.0"),
    ("apache license version 2.0, january 2004", "Apache-2.0"),
]


@dataclass(frozen=True)
class Policy:
    """License policy loaded from the root pyproject.toml."""

    allowed: frozenset[str]
    warn: frozenset[str]
    exceptions: dict[str, dict]

    def category(self, token: str) -> str:
        if token in self.allowed:
            return PERMISSIVE
        if token in self.warn:
            return WEAK_COPYLEFT
        return UNAPPROVED


@lru_cache(maxsize=1)
def load_policy() -> Policy:
    """Load the license policy from the root pyproject.toml."""
    with open(_policy_path(), "rb") as f:
        data = tomllib.load(f)
    section = data.get("tool", {}).get("licensecheck", {})
    exceptions = {}
    for name, entry in section.get("exceptions", {}).items():
        missing = [
            key for key in ("license", "version", "reason") if not entry.get(key)
        ]
        if missing:
            raise ValueError(
                f"[tool.licensecheck.exceptions.{name}] is missing: {', '.join(missing)}"
            )
        exceptions[name.lower().replace("_", "-")] = dict(entry)
    return Policy(
        allowed=frozenset(section.get("allowed", [])),
        warn=frozenset(section.get("warn", [])),
        exceptions=exceptions,
    )


def normalize_package_name(name: str) -> str:
    """Canonical (PEP 503 / npm) package name form used for lookups."""
    return name.strip().lower().replace("_", "-")


def get_exception(
    package_name: str, version: str, *, ignore_version: bool = False
) -> dict | None:
    """Return the policy exception for a package, if it covers this version.

    ``ignore_version`` is for diagnostics only, e.g. reporting a stale pin.
    """
    exception = load_policy().exceptions.get(normalize_package_name(package_name))
    if exception is None or ignore_version:
        return exception
    pinned = exception.get("version")
    if pinned is not None and str(pinned) != str(version):
        return None
    return exception


class _ParseError(ValueError):
    """Raised for malformed license expressions (fail-closed)."""


def _tokenize(license_str: str) -> list[str]:
    """Tokenize a license string into identifiers, OR/AND operators and parens.

    Identifiers are normalized via the alias table where possible. Operators
    must be whitespace-delimited words so that SPDX suffixes such as
    ``-or-later`` stay intact. Separators without semantic meaning in SPDX
    (``;``, ``,``, ``/``) are treated like AND, which is the conservative
    reading for multi-license metadata.
    """
    stripped = (license_str or "").strip()
    if stripped.lower() in _UNKNOWN_TOKENS:
        return []
    # Metadata often contains a single license name with a parenthetical
    # restatement ("ISC License (ISCL)"). Match the whole string against the
    # alias table first; tokenizing would turn the restatement into a
    # separate AND-combined token and poison the evaluation.
    whole = _ALIASES.get(stripped.lower())
    if whole is not None:
        return [whole]
    # Some packages embed the full license text in their metadata instead of
    # an identifier. For unambiguous standard texts (MIT, Apache-2.0) the
    # identifying sentence is deterministic, so recognize exactly those; any
    # other long text stays unrecognized and fails the check.
    if len(stripped) > 300:
        lowered = stripped.lower()
        for marker, spdx in _FULL_TEXT_MARKERS:
            if marker in lowered:
                return [spdx]
        return []

    tokens: list[str] = []
    # A ;/,// separator was seen but no identifier has followed yet: the next
    # identifier must be AND-combined to the previous one.
    separator_pending = False
    run: list[str] = []  # accumulated whitespace pieces = one identifier candidate

    def flush_run() -> None:
        nonlocal separator_pending, run
        if not run:
            return
        if separator_pending:
            if tokens and tokens[-1] not in {"AND", "OR", "("}:
                tokens.append("AND")
            separator_pending = False
        tokens.append(_resolve_identifier(" ".join(run)))
        run = []

    for segment in re.split(r"(\(|\)|;|,|/)", stripped):
        if segment in ("(", ")"):
            flush_run()
            tokens.append(segment)
            continue
        if segment in (";", ",", "/"):
            flush_run()
            if tokens and tokens[-1] not in {"AND", "OR", "("}:
                separator_pending = True
            continue
        for piece in segment.split():  # operators must be whitespace-delimited
            upper = piece.upper()
            if upper in {"OR", "AND"}:
                flush_run()
                tokens.append(upper)
                continue
            run.append(piece)
    flush_run()
    return tokens


def _resolve_identifier(token: str) -> str:
    """Resolve one identifier token via the alias table, else keep it verbatim."""
    return _ALIASES.get(token.lower(), token)


def _parse_expression(tokens: list[str]):
    """Parse tokens into an AST: ("or"|"and", children) / ("id", token)."""
    pos = 0

    def peek() -> str | None:
        return tokens[pos] if pos < len(tokens) else None

    def parse_or():
        nonlocal pos
        node = parse_and()
        children = [node]
        while peek() == "OR":
            pos += 1
            children.append(parse_and())
        return children[0] if len(children) == 1 else ("OR", children)

    def parse_and():
        nonlocal pos
        children = [parse_unit()]
        while peek() == "AND":
            pos += 1
            children.append(parse_unit())
        return children[0] if len(children) == 1 else ("AND", children)

    def parse_unit():
        nonlocal pos
        token = peek()
        if token == "(":
            pos += 1
            node = parse_or()
            if peek() != ")":
                raise _ParseError("unclosed parenthesis")
            pos += 1
            return node
        if token in {None, ")", "OR", "AND"}:
            raise _ParseError(f"unexpected token: {token!r}")
        pos += 1
        return ("ID", token)

    ast = parse_or()
    if pos != len(tokens):
        raise _ParseError("trailing tokens after expression")
    return ast


def _collect_unapproved(node, policy, into: set) -> None:
    kind, value = node
    if kind == "ID":
        if policy.category(value) == UNAPPROVED:
            into.add(value)
        return
    for child in value:
        _collect_unapproved(child, policy, into)


def _evaluate_ast(node, policy) -> dict:
    """Evaluate an AST node -> {"ok": bool, "category": str, "selected": str|None}."""
    kind, value = node
    if kind == "ID":
        category = policy.category(value)
        return {"ok": category != UNAPPROVED, "category": category, "selected": value}
    children = [_evaluate_ast(child, policy) for child in value]
    if kind == "AND":
        ok = all(child["ok"] for child in children)
        category = (
            max(children, key=lambda c: _RANK[c["category"]])["category"]
            if ok
            else UNAPPROVED
        )
        best = (
            min(children, key=lambda c: (_RANK[c["category"]], c["selected"] or ""))
            if ok
            else None
        )
        return {
            "ok": ok,
            "category": category,
            "selected": best["selected"] if best else None,
        }
    # OR: acceptable if any alternative is; you may choose the best one.
    passing = [child for child in children if child["ok"]]
    if not passing:
        return {"ok": False, "category": UNAPPROVED, "selected": None}
    best = min(passing, key=lambda c: (_RANK[c["category"]], c["selected"] or ""))
    return {"ok": True, "category": best["category"], "selected": best["selected"]}


def evaluate_license(license_str: str) -> dict:
    """Evaluate a license expression against the policy.

    Returns a dict with:

    - ``status``: "ok" or "unapproved"
    - ``category``: most restrictive category of the accepted expression
    - ``selected``: the most permissive acceptable SPDX token (or None)
    - ``reasons``: unapproved tokens (or the parse error) that caused rejection
    """
    policy = load_policy()
    try:
        tokens = _tokenize(license_str)
        if not tokens:
            return {
                "status": UNAPPROVED,
                "category": UNAPPROVED,
                "selected": None,
                "reasons": ["no license metadata"],
            }
        ast = _parse_expression(tokens)
    except _ParseError as error:
        return {
            "status": UNAPPROVED,
            "category": UNAPPROVED,
            "selected": None,
            "reasons": [f"malformed expression: {error}: {license_str!r}"],
        }

    result = _evaluate_ast(ast, policy)
    if result["ok"]:
        return {
            "status": "ok",
            "category": result["category"],
            "selected": result["selected"],
            "reasons": [],
        }
    reasons: set = set()
    _collect_unapproved(ast, policy, reasons)
    return {
        "status": UNAPPROVED,
        "category": UNAPPROVED,
        "selected": None,
        "reasons": sorted(reasons) or ["malformed expression"],
    }


def effective_license(package_name: str, version: str, license_str: str) -> str:
    """License string for a package after applying the policy exception, if any."""
    exception = get_exception(package_name, version)
    if exception is not None and exception.get("license"):
        return str(exception["license"])
    return license_str


def canonical_license_expression(license_str: str) -> str | None:
    """Normalize a license string to a canonical SPDX expression, if possible.

    Returns e.g. ``"BSD-3-Clause"`` for ``"BSD License"`` or
    ``"Apache-2.0 AND BSD-3-Clause"`` for ``"Apache Software License; BSD
    License"``. Returns None when any part is unrecognized, so callers can fall
    back to the verbatim string (fail-closed, no guessing).
    """
    tokens = _tokenize(license_str)
    if not tokens:
        return None
    policy = load_policy()
    for token in tokens:
        if token in {"OR", "AND"}:
            continue
        if policy.category(token) == "unapproved":
            return None
    return " ".join(tokens)
