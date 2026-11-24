"""Validation and connection-failure tests for LDAPOrganizationLoader (no infra).

These cover the loader's fail-fast configuration checks and the network
error mapping; the happy path runs against a real OpenLDAP container in
tests/integration/test_ldap_loader_openldap.py.
"""

import pytest
from pydantic import SecretStr

from config.settings import LDAPSettings
from core.organization.ldap_loader import (
    LDAPOrganizationLoader,
    LDAPOrganizationLoaderError,
)


def test_missing_search_base_is_rejected():
    loader = LDAPOrganizationLoader(LDAPSettings(search_base=""))

    with pytest.raises(LDAPOrganizationLoaderError, match="SEARCH_BASE"):
        loader.load_directory()


def test_missing_host_is_rejected():
    loader = LDAPOrganizationLoader(LDAPSettings(host=" "))

    with pytest.raises(LDAPOrganizationLoaderError, match="HOST"):
        loader.load_directory()


@pytest.mark.parametrize(
    ("bad_field", "bad_value", "env_name"),
    [
        ("connect_timeout", float("nan"), "CONNECT_TIMEOUT"),
        ("read_timeout", float("inf"), "READ_TIMEOUT"),
    ],
)
def test_unparseable_numeric_settings_are_rejected(bad_field, bad_value, env_name):
    loader = LDAPOrganizationLoader(
        LDAPSettings(host="ldap.example.org", use_ssl=False, **{bad_field: bad_value})
    )

    with pytest.raises(LDAPOrganizationLoaderError, match=env_name):
        loader.load_directory()


def test_verify_ssl_without_ca_cert_file_is_rejected():
    loader = LDAPOrganizationLoader(
        LDAPSettings(host="ldap.example.org", use_ssl=True, verify_ssl=True)
    )

    with pytest.raises(LDAPOrganizationLoaderError, match="ca_cert_file"):
        loader.load_directory()


@pytest.mark.parametrize(
    ("input_host", "expected"),
    [
        ("ldap.example.org", "ldap.example.org"),
        ("ldap://ldap.example.org", "ldap.example.org"),
        ("ldaps://ldap.example.org", "ldap.example.org"),
        ("  ldap.example.org  ", "ldap.example.org"),
    ],
)
def test_host_is_normalized(input_host, expected):
    loader = LDAPOrganizationLoader(LDAPSettings(host=input_host))

    assert loader._normalized_host() == expected


def test_unreachable_server_raises_connection_error():
    loader = LDAPOrganizationLoader(
        LDAPSettings(
            host="127.0.0.1",
            port=1,  # nothing listens here; refused immediately
            use_ssl=False,
            connect_timeout=1.0,
            read_timeout=1.0,
            bind_dn="cn=admin,dc=example,dc=org",
            bind_password=SecretStr("x"),
        )
    )

    with pytest.raises(LDAPOrganizationLoaderError, match="Failed to open LDAP"):
        loader.load_directory()
