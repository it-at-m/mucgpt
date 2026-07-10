#!/usr/bin/env python3
"""Backend smoke test for /user/lookup/{lhmobjectid}.

This script helps verify that assistant-service returns person data when a valid
lhmobjectid is provided.

Usage examples:

1) Use a pre-existing access token:
   uv run python scripts/test_user_lookup.py --lhmobjectid 111160470 --access-token "<JWT>"

2) Fetch token from local Keycloak (resource owner password grant):
   uv run python scripts/test_user_lookup.py --lhmobjectid 111160470

3) Require non-empty profile fields:
   uv run python scripts/test_user_lookup.py --lhmobjectid 111160470 --require-person-fields
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Test assistant-service user lookup endpoint by lhmobjectid"
    )
    parser.add_argument(
        "--lhmobjectid",
        required=True,
        help="LHM object id to look up (for example 111160470)",
    )
    parser.add_argument(
        "--assistant-base-url",
        default="http://localhost:39147",
        help="Base URL of assistant-service (default: http://localhost:39147)",
    )
    parser.add_argument(
        "--access-token",
        default=None,
        help="Existing bearer token. If omitted, script tries to fetch one from Keycloak.",
    )
    parser.add_argument(
        "--keycloak-base-url",
        default="http://localhost:8100",
        help="Keycloak base URL used for password grant (default: http://localhost:8100)",
    )
    parser.add_argument(
        "--realm",
        default="local_realm",
        help="Keycloak realm (default: local_realm)",
    )
    parser.add_argument(
        "--client-id",
        default="mucgpt",
        help="OIDC client id for token request (default: mucgpt)",
    )
    parser.add_argument(
        "--client-secret",
        default="client_secret",
        help="OIDC client secret for token request (default: client_secret)",
    )
    parser.add_argument(
        "--username",
        default="mucgpt-user",
        help="Username for password grant (default: mucgpt-user)",
    )
    parser.add_argument(
        "--password",
        default="mucgpt",
        help="Password for password grant (default: mucgpt)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=15.0,
        help="HTTP timeout in seconds (default: 15)",
    )
    parser.add_argument(
        "--require-person-fields",
        action="store_true",
        help="Fail unless givenName, sn and mail are non-empty",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print additional debug output",
    )
    return parser.parse_args()


def get_access_token(args: argparse.Namespace) -> str:
    if args.access_token:
        return args.access_token

    base_url = args.keycloak_base_url.rstrip("/")
    token_urls = [
        f"{base_url}/realms/{args.realm}/protocol/openid-connect/token",
        f"{base_url}/auth/realms/{args.realm}/protocol/openid-connect/token",
    ]

    # Avoid duplicate attempts when user already passes a base URL ending in /auth.
    deduplicated_urls: list[str] = []
    for url in token_urls:
        if url not in deduplicated_urls:
            deduplicated_urls.append(url)

    data = {
        "grant_type": "password",
        "client_id": args.client_id,
        "client_secret": args.client_secret,
        "username": args.username,
        "password": args.password,
    }

    last_error: str | None = None
    for token_url in deduplicated_urls:
        response = requests.post(token_url, data=data, timeout=args.timeout)
        if response.status_code == 200:
            payload = response.json()
            token = payload.get("access_token")
            if not token:
                raise RuntimeError(
                    "Keycloak token response did not include access_token"
                )
            return str(token)

        last_error = f"[{token_url}] HTTP {response.status_code}: {response.text}"

    raise RuntimeError(
        f"Failed to get access token from Keycloak. Last error: {last_error}"
    )


def call_lookup(args: argparse.Namespace, access_token: str) -> dict[str, Any]:
    base = args.assistant_base_url.rstrip("/")
    object_id = args.lhmobjectid.strip()
    candidate_urls = [
        f"{base}/user/lookup/{object_id}",
        f"{base}/api/user/lookup/{object_id}",
    ]
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }

    last_error: str | None = None
    for url in candidate_urls:
        response = requests.get(url, headers=headers, timeout=args.timeout)
        if response.status_code == 200:
            return response.json()
        last_error = f"[{url}] HTTP {response.status_code}: {response.text}"

    raise RuntimeError(f"Lookup request failed. Last error: {last_error}")


def assert_lookup_payload(
    payload: dict[str, Any],
    expected_lhmobjectid: str,
    require_person_fields: bool,
) -> None:
    required_keys = {
        "lhmobjectid",
        "givenName",
        "sn",
        "mail",
        "organizationalunit",
    }
    missing = [k for k in required_keys if k not in payload]
    if missing:
        raise AssertionError(f"Missing expected keys in payload: {missing}")

    actual_id = str(payload.get("lhmobjectid") or "").strip()
    if actual_id != expected_lhmobjectid:
        raise AssertionError(
            "Response lhmobjectid does not match request. "
            f"Expected '{expected_lhmobjectid}', got '{actual_id}'"
        )

    if require_person_fields:
        for field in ("givenName", "sn", "mail"):
            value = str(payload.get(field) or "").strip()
            if not value:
                raise AssertionError(
                    f"Expected non-empty field '{field}', but value was empty/null"
                )


def main() -> int:
    args = parse_args()
    requested_id = args.lhmobjectid.strip()

    try:
        token = get_access_token(args)
        payload = call_lookup(args, token)
        assert_lookup_payload(payload, requested_id, args.require_person_fields)

        print("SUCCESS: /user/lookup returned expected payload")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        if args.verbose:
            print("Token source:", "provided" if args.access_token else "keycloak")
            print("Assistant URL:", args.assistant_base_url)
        return 0
    except Exception as exc:
        print("FAILED:", str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
