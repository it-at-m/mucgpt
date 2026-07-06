from typing import Any

import pytest
from ldap3.core import exceptions as ldap_exceptions

from config.settings import LDAPSettings
from core.organization.ldap_person_loader import (
    LDAPPersonLookupError,
    LDAPPersonLookupLoader,
)


class _DummyConnection:
    def unbind(self) -> None:
        return None


def _build_settings(**kwargs: Any) -> LDAPSettings:
    base = {
        "ENABLED": True,
        "HOST": "ldap.example.org",
        "PORT": 636,
        "USE_SSL": True,
        "VERIFY_SSL": False,
        "SEARCH_BASE": "dc=example,dc=org",
        "USER_SEARCH_BASE": "ou=People,dc=example,dc=org",
    }
    base.update(kwargs)
    return LDAPSettings(**base)


def test_lookup_maps_and_sanitizes_attributes(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _build_settings()
    loader = LDAPPersonLookupLoader(settings)

    monkeypatch.setattr(loader, "_build_server", lambda: object())
    monkeypatch.setattr(loader, "_build_connection", lambda _server: _DummyConnection())
    monkeypatch.setattr(
        loader,
        "_search",
        lambda **kwargs: [
            {
                "attributes": {
                    "lhmobjectid": ["12345"],
                    "givenName": ["Max"],
                    "sn": ["Mustermann"],
                    "mail": [b"max.mustermann@muenchen.de"],
                    "organizationalunit": ["RIT-GL5"],
                }
            }
        ],
    )

    payload = loader.lookup_by_lhmobjectid("12345")

    assert payload == {
        "lhmobjectid": "12345",
        "givenName": "Max",
        "sn": "Mustermann",
        "mail": "max.mustermann@muenchen.de",
        "organizationalunit": "RIT-GL5",
    }


def test_lookup_returns_none_when_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _build_settings()
    loader = LDAPPersonLookupLoader(settings)

    monkeypatch.setattr(loader, "_build_server", lambda: object())
    monkeypatch.setattr(loader, "_build_connection", lambda _server: _DummyConnection())
    monkeypatch.setattr(loader, "_search", lambda **kwargs: [])

    assert loader.lookup_by_lhmobjectid("no-such-id") is None


def test_lookup_raises_when_ldap_disabled() -> None:
    settings = _build_settings(ENABLED=False)
    loader = LDAPPersonLookupLoader(settings)

    with pytest.raises(LDAPPersonLookupError, match="disabled"):
        loader.lookup_by_lhmobjectid("123")


def test_escape_filter_value_special_characters() -> None:
    settings = _build_settings()
    loader = LDAPPersonLookupLoader(settings)

    escaped = loader._escape_filter_value(r"a*(b)\\c")
    assert escaped == r"a\2a\28b\29\5c\5cc"


def test_build_connection_unbinds_when_start_tls_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = _build_settings(START_TLS=True, USE_SSL=False)
    loader = LDAPPersonLookupLoader(settings)
    unbind_calls = {"count": 0}

    class _FailingStartTLSConnection:
        def __init__(self, *args, **kwargs):
            self.last_error = ""

        def open(self) -> None:
            return None

        def start_tls(self) -> None:
            raise ldap_exceptions.LDAPExceptionError("start_tls failed")

        def bind(self) -> bool:
            return True

        def unbind(self) -> None:
            unbind_calls["count"] += 1

    monkeypatch.setattr(
        "core.organization.ldap_person_loader.Connection", _FailingStartTLSConnection
    )

    with pytest.raises(LDAPPersonLookupError, match="start_tls failed"):
        loader._build_connection(loader._build_server())

    assert unbind_calls["count"] == 1


def test_build_connection_unbinds_when_bind_returns_false(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = _build_settings(START_TLS=False)
    loader = LDAPPersonLookupLoader(settings)
    unbind_calls = {"count": 0}

    class _BindFalseConnection:
        def __init__(self, *args, **kwargs):
            self.last_error = "invalid credentials"

        def open(self) -> None:
            return None

        def start_tls(self) -> None:
            return None

        def bind(self) -> bool:
            return False

        def unbind(self) -> None:
            unbind_calls["count"] += 1

    monkeypatch.setattr(
        "core.organization.ldap_person_loader.Connection", _BindFalseConnection
    )

    with pytest.raises(LDAPPersonLookupError, match="Failed to bind"):
        loader._build_connection(loader._build_server())

    assert unbind_calls["count"] == 1
