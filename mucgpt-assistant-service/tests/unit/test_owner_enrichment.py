import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import core.owner_enrichment as owner_enrichment
from core.organization.ldap_person_loader import LDAPPersonLookupError
from database.database_models import Owner


class _DummyLoader:
    def __init__(
        self,
        responses: dict[str, dict[str, str | None] | None] | None = None,
        errors: set[str] | None = None,
    ) -> None:
        self.responses = responses or {}
        self.errors = errors or set()
        self.calls: list[str] = []

    def lookup_by_lhmobjectid(self, owner_id: str) -> dict[str, str | None] | None:
        self.calls.append(owner_id)
        if owner_id in self.errors:
            raise LDAPPersonLookupError("boom")
        return self.responses.get(owner_id)


@pytest.mark.asyncio
async def test_build_owner_details_omits_unresolved_owner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    loader = _DummyLoader(responses={"known": None})

    monkeypatch.setattr(owner_enrichment, "get_ldap_settings", lambda: object())
    monkeypatch.setattr(owner_enrichment, "LDAPPersonLookupLoader", lambda _s: loader)

    result = await owner_enrichment.build_owner_details(["known"])

    assert result == []


@pytest.mark.asyncio
async def test_build_owner_details_omits_owner_without_useful_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    loader = _DummyLoader(
        responses={
            "known": {
                "lhmobjectid": "known",
                "givenName": None,
                "sn": None,
                "mail": None,
                "organizationalunit": None,
            }
        }
    )

    monkeypatch.setattr(owner_enrichment, "get_ldap_settings", lambda: object())
    monkeypatch.setattr(owner_enrichment, "LDAPPersonLookupLoader", lambda _s: loader)

    result = await owner_enrichment.build_owner_details(["known"])

    assert result == []


@pytest.mark.asyncio
async def test_build_owner_details_returns_resolved_owner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    loader = _DummyLoader(
        responses={
            "111160470": {
                "lhmobjectid": "111160470",
                "givenName": "Michael",
                "sn": "Jaumann",
                "mail": "michael.jaumann@muenchen.de",
                "organizationalunit": "ITM-SLP43",
            }
        }
    )

    monkeypatch.setattr(owner_enrichment, "get_ldap_settings", lambda: object())
    monkeypatch.setattr(owner_enrichment, "LDAPPersonLookupLoader", lambda _s: loader)

    result = await owner_enrichment.build_owner_details(["111160470"])

    assert len(result) == 1
    assert result[0]["user_id"] == "111160470"
    assert result[0]["username"] == "Michael Jaumann"
    assert result[0]["contact_address"] == "michael.jaumann@muenchen.de"


@pytest.mark.asyncio
async def test_build_owner_details_uses_mail_as_username_when_name_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    loader = _DummyLoader(
        responses={
            "mail-only": {
                "lhmobjectid": "mail-only",
                "givenName": None,
                "sn": None,
                "mail": "owner@example.org",
                "organizationalunit": None,
            }
        }
    )

    monkeypatch.setattr(owner_enrichment, "get_ldap_settings", lambda: object())
    monkeypatch.setattr(owner_enrichment, "LDAPPersonLookupLoader", lambda _s: loader)

    result = await owner_enrichment.build_owner_details(["mail-only"])

    assert len(result) == 1
    assert result[0]["username"] == "owner@example.org"


@pytest.mark.asyncio
async def test_build_owner_details_omits_owner_when_lookup_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    loader = _DummyLoader(errors={"broken"})

    monkeypatch.setattr(owner_enrichment, "get_ldap_settings", lambda: object())
    monkeypatch.setattr(owner_enrichment, "LDAPPersonLookupLoader", lambda _s: loader)

    result = await owner_enrichment.build_owner_details(["broken"])

    assert result == []


@pytest.mark.asyncio
async def test_build_owner_details_caches_negative_results(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    loader = _DummyLoader(responses={"missing": None})

    monkeypatch.setattr(owner_enrichment, "get_ldap_settings", lambda: object())
    monkeypatch.setattr(owner_enrichment, "LDAPPersonLookupLoader", lambda _s: loader)

    cache: dict[str, dict | None] = {}
    first = await owner_enrichment.build_owner_details(["missing"], cache)
    second = await owner_enrichment.build_owner_details(["missing"], cache)

    assert first == []
    assert second == []
    assert loader.calls == ["missing"]


@pytest.mark.asyncio
async def test_refresh_owner_details_retries_after_integrity_error(
    monkeypatch: pytest.MonkeyPatch,
    db_session: AsyncSession,
) -> None:
    loader = _DummyLoader(
        responses={
            "race-user": {
                "lhmobjectid": "race-user",
                "givenName": "Race",
                "sn": "Winner",
                "mail": "race.winner@example.org",
                "organizationalunit": "ITM-TEST",
            }
        }
    )

    monkeypatch.setattr(owner_enrichment, "get_ldap_settings", lambda: object())
    monkeypatch.setattr(owner_enrichment, "LDAPPersonLookupLoader", lambda _s: loader)

    original_flush = db_session.flush
    raised = {"value": False}

    async def flaky_flush(*args: object, **kwargs: object) -> object:
        if not raised["value"]:
            raised["value"] = True
            raise IntegrityError("INSERT INTO owners ...", {}, Exception("duplicate"))
        return await original_flush(*args, **kwargs)

    monkeypatch.setattr(db_session, "flush", flaky_flush)

    # Prevent unrelated autoflush calls from consuming the one-shot failure.
    with db_session.no_autoflush:
        await owner_enrichment.refresh_owner_details(["race-user"], db_session)
    await db_session.commit()

    owner = (
        await db_session.execute(select(Owner).where(Owner.user_id == "race-user"))
    ).scalar_one_or_none()
    assert owner is not None
    assert owner.display_name == "Race Winner"
    assert owner.mail == "race.winner@example.org"
