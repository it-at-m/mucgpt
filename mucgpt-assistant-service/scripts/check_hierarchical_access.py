"""CLI utility to test assistant hierarchical access against a dumped LDAP tree.

Example:
    uv run python scripts/check_hierarchical_access.py --access ITM --department ITM-KM-DI
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import types
from pathlib import Path


def _load_production_path_matcher():
    """Load production matcher from app/database/path_matcher.py.

    This script intentionally runs outside full app bootstrap. We inject a tiny
    `core.directory_cache` shim so importing the matcher does not require full
    settings/Redis wiring when we pass `directory_tree` explicitly.
    """
    service_root = Path(__file__).resolve().parents[1]
    app_root = service_root / "app"
    if str(app_root) not in sys.path:
        sys.path.insert(0, str(app_root))

    if "core.logtools" not in sys.modules:
        logtools_shim = types.ModuleType("core.logtools")

        def _get_logger(name: str):
            return logging.getLogger(name)

        logtools_shim.getLogger = _get_logger
        sys.modules["core.logtools"] = logtools_shim

    if "core.directory_cache" not in sys.modules:
        shim = types.ModuleType("core.directory_cache")

        async def _dummy_get_simplified_directory_tree():
            return None

        shim.get_simplified_directory_tree = _dummy_get_simplified_directory_tree
        sys.modules["core.directory_cache"] = shim

    from database import path_matcher as prod_path_matcher

    return prod_path_matcher


def parse_args() -> argparse.Namespace:
    service_root = Path(__file__).resolve().parents[1]
    default_tree_path = service_root / "ldap_tree_dump.json"

    parser = argparse.ArgumentParser(
        description=(
            "Test whether a user department has access to an assistant based on "
            "a hierarchical access path and a dumped LDAP tree."
        )
    )
    parser.add_argument(
        "--access",
        required=True,
        help="Hierarchical access path for the assistant (for example: ITM)",
    )
    parser.add_argument(
        "--department",
        required=True,
        help="User department to check (for example: ITM-KM-DI)",
    )
    parser.add_argument(
        "--tree",
        default=str(default_tree_path),
        help=f"Path to tree JSON dump (default: {default_tree_path})",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print additional diagnostics (resolved node ids)",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    tree_path = Path(args.tree)
    prod_path_matcher = _load_production_path_matcher()

    if not tree_path.exists():
        print(f"ERROR: tree file not found: {tree_path}")
        return 1

    with tree_path.open("r", encoding="utf-8") as handle:
        tree_data = json.load(handle)

    if not isinstance(tree_data, list):
        print("ERROR: invalid tree JSON format; expected a list of root nodes")
        return 1

    directory_index = prod_path_matcher._build_index(tree_data)
    allowed = asyncio.run(
        prod_path_matcher.path_matches_department(
            args.access,
            args.department,
            directory_tree=tree_data,
            directory_index=directory_index,
        )
    )

    access_key = prod_path_matcher._normalize_value(args.access)
    department_key = prod_path_matcher._normalize_value(args.department)
    access_ids = prod_path_matcher._resolve_access_ids(access_key, directory_index)
    department_ids = prod_path_matcher._resolve_department_ids(
        department_key, directory_index
    )

    print("Access check result")
    print(f"- Access path: {args.access}")
    print(f"- Department: {args.department}")
    print(f"- Tree file: {tree_path}")

    if allowed:
        print("- Decision: ALLOWED")
    else:
        print("- Decision: DENIED")

    if args.verbose:
        print("Diagnostics")
        print(f"- Normalized access key: {access_key}")
        print(f"- Normalized department key: {department_key}")
        print(f"- Matching access node IDs: {sorted(access_ids)}")
        print(f"- Matching department node IDs: {sorted(department_ids)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
