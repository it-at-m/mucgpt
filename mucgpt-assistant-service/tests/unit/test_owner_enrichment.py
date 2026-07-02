import pytest

import core.owner_enrichment as owner_enrichment
from core.organization.ldap_person_loader import LDAPPersonLookupError


class _DummyLoader:
    def __init__(self, responses=None, errors=None):
        self.responses = responses or {}
        self.errors = errors or set()
        self.calls: list[str] = []

    def lookup_by_lhmobjectid(self, owner_id: str):
        self.calls.append(owner_id)
        if owner_id in self.errors:
            raise LDAPPersonLookupError("boom")
        return self.responses.get(owner_id)


@pytest.mark.asyncio
async def test_build_owner_details_omits_unresolved_owner(monkeypatch):
    loader = _DummyLoader(responses={"known": None})

    monkeypatch.setattr(owner_enrichment, "get_ldap_settings", lambda: object())
    monkeypatch.setattr(owner_enrichment, "LDAPPersonLookupLoader", lambda _s: loader)

    result = await owner_enrichment.build_owner_details(["known"])

    assert result == []


@pytest.mark.asyncio
async def test_build_owner_details_omits_owner_without_useful_fields(monkeypatch):
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
async def test_build_owner_details_returns_resolved_owner(monkeypatch):
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
async def test_build_owner_details_uses_mail_as_username_when_name_missing(monkeypatch):
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
async def test_build_owner_details_omits_owner_when_lookup_errors(monkeypatch):
    loader = _DummyLoader(errors={"broken"})

    monkeypatch.setattr(owner_enrichment, "get_ldap_settings", lambda: object())
    monkeypatch.setattr(owner_enrichment, "LDAPPersonLookupLoader", lambda _s: loader)

    result = await owner_enrichment.build_owner_details(["broken"])

    assert result == []


@pytest.mark.asyncio
async def test_build_owner_details_caches_negative_results(monkeypatch):
    loader = _DummyLoader(responses={"missing": None})

    monkeypatch.setattr(owner_enrichment, "get_ldap_settings", lambda: object())
    monkeypatch.setattr(owner_enrichment, "LDAPPersonLookupLoader", lambda _s: loader)

    cache: dict[str, dict | None] = {}
    first = await owner_enrichment.build_owner_details(["missing"], cache)
    second = await owner_enrichment.build_owner_details(["missing"], cache)

    assert first == []
    assert second == []
    assert loader.calls == ["missing"]
