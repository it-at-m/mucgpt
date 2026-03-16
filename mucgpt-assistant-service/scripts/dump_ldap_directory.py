"""Fetch the LDAP organization tree and save it as JSON."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


from config.settings import LDAPSettings  # noqa: E402, I001
from core.organization import LDAPOrganizationLoader, LDAPOrganizationLoaderError  # noqa: E402

# Ensure logging config points to an existing file to avoid noisy fallback
os.environ.setdefault("MUCGPT_ASSISTANT_LOG_CONFIG", str(SRC / "logconf.yaml"))


def _simplify_node(node) -> dict[str, Any]:
    attrs = node.attributes or {}
    shortname = None
    shortnames = attrs.get("lhmOUShortname") or attrs.get("lhmOUShortName")
    if isinstance(shortnames, list) and shortnames:
        shortname = shortnames[0]
    elif isinstance(shortnames, str):
        shortname = shortnames

    children = [_simplify_node(child) for child in node.children]
    return {
        "shortname": shortname,
        "name": node.name or node.dn or "",
        "children": children,
    }


def directory_to_dict(directory) -> dict[str, Any]:
    return {
        "source": directory.source,
        "generated_at": directory.generated_at.isoformat(),
        "node_count": directory.node_count,
        "roots": [_simplify_node(root) for root in directory.roots],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="ldap.muenchen.de", help="LDAP host")
    parser.add_argument("--port", type=int, default=636, help="LDAP port")
    parser.add_argument(
        "--use-ssl", action="store_true", default=True, help="Use LDAPS"
    )
    parser.add_argument(
        "--no-verify-ssl",
        action="store_true",
        help="Disable SSL verification",
        default=False,
    )
    parser.add_argument(
        "--start-tls", action="store_true", default=False, help="Use STARTTLS"
    )
    parser.add_argument(
        "--search-base",
        default="o=Landeshauptstadt München,c=de",
        help="LDAP search base",
    )
    parser.add_argument(
        "--search-filter",
        default="(objectClass=organizationalUnit)",
        help="LDAP search filter",
    )
    parser.add_argument(
        "--output",
        default="department_directory.json",
        help="Output JSON file path",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=500,
        help="LDAP paged search size",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    settings = LDAPSettings(
        ENABLED=True,
        HOST=args.host,
        PORT=args.port,
        USE_SSL=args.use_ssl,
        START_TLS=args.start_tls,
        VERIFY_SSL=False,
        BIND_DN=None,
        BIND_PASSWORD=None,
        SEARCH_BASE=args.search_base,
        SEARCH_FILTER=args.search_filter,
        PAGE_SIZE=args.page_size,
    )

    loader = LDAPOrganizationLoader(settings)
    try:
        directory = loader.load_directory()
    except LDAPOrganizationLoaderError as exc:  # pragma: no cover - network
        print(f"Failed to load LDAP directory: {exc}")
        return 1

    output_path = Path(args.output)
    data = directory_to_dict(directory)
    output_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Wrote department directory to {output_path} ({directory.node_count} nodes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
