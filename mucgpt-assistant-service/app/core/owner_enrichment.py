from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config.settings import get_ldap_settings
from core.logtools import getLogger
from core.organization import LDAPPersonLookupError, LDAPPersonLookupLoader
from database.database_models import Owner

logger = getLogger("owner_enrichment")


def _compose_username(
    given_name: str | None, surname: str | None, mail: str | None
) -> str:
    parts = [
        p.strip() for p in [given_name, surname] if isinstance(p, str) and p.strip()
    ]
    if parts:
        return " ".join(parts)
    if isinstance(mail, str) and mail.strip():
        return mail.strip()
    return ""


def _has_useful_owner_data(
    given_name: str | None,
    surname: str | None,
    mail: str | None,
    organizational_unit: str | None,
) -> bool:
    return any(
        isinstance(value, str) and value.strip()
        for value in (given_name, surname, mail, organizational_unit)
    )


async def build_owner_details(
    owner_ids: list[str],
    cache: dict[str, dict[str, Any] | None] | None = None,
    owners: list[Owner] | None = None,
) -> list[dict[str, Any]]:
    """Build enriched owner details for API responses.

    This function never raises LDAP lookup errors so assistant endpoints remain
    available even if LDAP is temporarily unavailable.
    """

    if not owner_ids:
        return []

    lookup_cache = cache if cache is not None else {}

    owner_map = {owner.user_id: owner for owner in owners or []}

    # Read-path optimization: if owner rows are provided, never hit LDAP.
    if owner_map:
        result: list[dict[str, Any]] = []
        for owner_id in owner_ids:
            if owner_id in lookup_cache:
                cached = lookup_cache[owner_id]
                if cached is not None:
                    result.append(cached)
                continue

            owner = owner_map.get(owner_id)
            enriched = _owner_row_to_enriched_payload(owner_id, owner)
            lookup_cache[owner_id] = enriched
            if enriched is not None:
                result.append(enriched)
        return result

    try:
        loader = LDAPPersonLookupLoader(get_ldap_settings())
    except Exception as exc:
        logger.warning("Failed to initialize LDAP person lookup loader: %s", exc)
        loader = None

    result: list[dict[str, Any]] = []
    for owner_id in owner_ids:
        if owner_id in lookup_cache:
            cached = lookup_cache[owner_id]
            if cached is not None:
                result.append(cached)
            continue

        payload: dict[str, str | None] | None = None
        if loader is not None:
            try:
                payload = loader.lookup_by_lhmobjectid(owner_id)
            except LDAPPersonLookupError as exc:
                logger.warning(
                    "LDAP lookup failed for owner_id=%s: %s",
                    owner_id,
                    exc,
                )

        given_name = payload.get("givenName") if payload else None
        surname = payload.get("sn") if payload else None
        mail = payload.get("mail") if payload else None
        organizational_unit = payload.get("organizationalunit") if payload else None

        if payload is None or not _has_useful_owner_data(
            given_name,
            surname,
            mail,
            organizational_unit,
        ):
            lookup_cache[owner_id] = None
            continue

        enriched = {
            "user_id": owner_id,
            "username": _compose_username(given_name, surname, mail),
            "contact_address": mail,
            "givenName": given_name,
            "sn": surname,
            "mail": mail,
            "organizationalunit": organizational_unit,
        }

        lookup_cache[owner_id] = enriched
        result.append(enriched)

    return result


def _owner_row_to_enriched_payload(
    owner_id: str,
    owner: Owner | None,
) -> dict[str, Any] | None:
    if owner is None:
        return None

    given_name = owner.given_name
    surname = owner.surname
    mail = owner.mail
    organizational_unit = owner.organizational_unit

    if not _has_useful_owner_data(given_name, surname, mail, organizational_unit):
        return None

    username = owner.display_name or _compose_username(given_name, surname, mail)
    return {
        "user_id": owner_id,
        "username": username,
        "contact_address": mail,
        "givenName": given_name,
        "sn": surname,
        "mail": mail,
        "organizationalunit": organizational_unit,
    }


def get_missing_owner_cache_ids(
    owner_ids: list[str],
    owners: list[Owner] | None,
) -> list[str]:
    """Return owner ids whose cached profile fields are missing in the DB."""

    owner_map = {owner.user_id: owner for owner in owners or []}
    missing_owner_ids: list[str] = []
    for owner_id in owner_ids:
        owner = owner_map.get(owner_id)
        if _owner_row_to_enriched_payload(owner_id, owner) is None:
            missing_owner_ids.append(owner_id)

    # Preserve order while removing duplicates.
    return list(dict.fromkeys(missing_owner_ids))


async def refresh_owner_details(
    owner_ids: list[str],
    db: AsyncSession,
) -> None:
    """Refresh cached LDAP owner profile fields for the provided owner IDs.

    This is intended for write paths (assistant create/update), so read paths
    can serve owner details from the database without LDAP lookups.
    """

    if not owner_ids:
        return

    deduped_owner_ids = list(dict.fromkeys(owner_ids))
    existing_result = await db.execute(
        select(Owner).where(Owner.user_id.in_(deduped_owner_ids))
    )
    existing_owners = {
        owner.user_id: owner for owner in existing_result.scalars().all()
    }

    for owner_id in deduped_owner_ids:
        if owner_id not in existing_owners:
            owner = Owner(user_id=owner_id)
            db.add(owner)
            existing_owners[owner_id] = owner

    try:
        loader = LDAPPersonLookupLoader(get_ldap_settings())
    except Exception as exc:
        logger.warning("Failed to initialize LDAP person lookup loader: %s", exc)
        return

    now = datetime.now(UTC)
    for owner_id in deduped_owner_ids:
        owner = existing_owners[owner_id]
        try:
            payload = await asyncio.to_thread(loader.lookup_by_lhmobjectid, owner_id)
        except LDAPPersonLookupError as exc:
            logger.warning("LDAP lookup failed for owner_id=%s: %s", owner_id, exc)
            continue

        if payload is None:
            owner.display_name = None
            owner.given_name = None
            owner.surname = None
            owner.mail = None
            owner.organizational_unit = None
            owner.details_updated_at = now
            continue

        given_name = payload.get("givenName")
        surname = payload.get("sn")
        mail = payload.get("mail")
        organizational_unit = payload.get("organizationalunit")

        owner.given_name = given_name
        owner.surname = surname
        owner.mail = mail
        owner.organizational_unit = organizational_unit
        owner.display_name = _compose_username(given_name, surname, mail) or owner_id
        owner.details_updated_at = now
