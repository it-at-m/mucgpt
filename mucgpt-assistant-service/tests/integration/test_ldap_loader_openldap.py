"""Integration tests for LDAPOrganizationLoader against a real OpenLDAP container.

Lightweight by design: one osixia/openldap container and two department OUs.
The standard LDAP attributes below exercise the loader's configurable attribute
mapping without relying on image-specific custom-schema bootstrap behavior.
Tests skip when no container runtime is reachable or when MUCGPT_TEST_LDAP=off.
"""

import os
import time

import pytest
from ldap3 import ALL, Connection, Server
from pydantic import SecretStr

from config.settings import LDAPSettings
from core.organization.ldap_loader import (
    LDAPOrganizationLoader,
    LDAPOrganizationLoaderError,
)
from tests import container_runtime

_LDAP_IMAGE = "osixia/openldap:1.5.0"
_DOMAIN = "example.org"
_SEARCH_BASE = f"dc={_DOMAIN.split('.')[0]},dc={_DOMAIN.split('.')[1]}"
_ADMIN_DN = f"cn=admin,{_SEARCH_BASE}"
_ADMIN_PASSWORD = "admin"

# Two departments in a parent/child chain plus one ignored placeholder OU
# (the "_" prefix is ignored by the default configuration).
SEED_ENTRIES = [
    (
        f"ou=Muenchen,{_SEARCH_BASE}",
        {
            "objectClass": ["organizationalUnit"],
            "ou": ["Muenchen"],
            "businessCategory": ["DEPT-ORG"],
            "description": ["Landeshauptstadt Muenchen"],
        },
    ),
    (
        f"ou=IT,ou=Muenchen,{_SEARCH_BASE}",
        {
            "objectClass": ["organizationalUnit"],
            "ou": ["IT"],
            "businessCategory": ["DEPT-IT"],
            "description": ["IT-Referat"],
            "seeAlso": [f"ou=Muenchen,{_SEARCH_BASE}"],
        },
    ),
    (
        f"ou=_Placeholder,{_SEARCH_BASE}",
        {
            "objectClass": ["organizationalUnit"],
            "ou": ["_Placeholder"],
            "businessCategory": ["DEPT-PLACEHOLDER"],
            "description": ["Ignored placeholder"],
        },
    ),
]

_container = None


def _loader(settings: LDAPSettings) -> LDAPOrganizationLoader:
    return LDAPOrganizationLoader(settings)


@pytest.fixture(scope="module")
def ldap_container():
    """Start one lightweight OpenLDAP container for this module."""
    global _container
    if _container is not None:
        yield _container
        return
    if os.getenv("MUCGPT_TEST_LDAP", "auto").strip().lower() in {
        "off",
        "false",
        "0",
        "no",
    }:
        pytest.skip("LDAP testcontainer disabled via MUCGPT_TEST_LDAP")
    try:
        from testcontainers.core.container import DockerContainer
    except ModuleNotFoundError:
        pytest.skip("testcontainers not installed")

    def _factory():
        return (
            DockerContainer(_LDAP_IMAGE)
            .with_env("LDAP_ORGANISATION", "MUCGPT")
            .with_env("LDAP_DOMAIN", _DOMAIN)
            .with_env("LDAP_ADMIN_PASSWORD", _ADMIN_PASSWORD)
            .with_exposed_ports(389)
        )

    container = container_runtime.start_container(_factory)
    if container is None:
        pytest.skip("no container runtime reachable for LDAP tests")
    _container = container
    _seed(container)
    yield container
    container.stop()
    _container = None


def _connect(container) -> Connection:
    server = Server(
        container.get_container_host_ip(),
        port=container.get_exposed_port(389),
        get_info=ALL,
        connect_timeout=3,
    )
    return Connection(server, user=_ADMIN_DN, password=_ADMIN_PASSWORD)


def _wait_until_ready(container, timeout: float = 60.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            connection = _connect(container)
            if connection.bind():
                connection.unbind()
                return
        except Exception:  # noqa: BLE001 — not ready yet, retry
            pass
        time.sleep(0.5)
    pytest.fail("OpenLDAP container did not become ready in time")


def _seed(container) -> None:
    _wait_until_ready(container)
    connection = _connect(container)
    assert connection.bind()
    for dn, attributes in SEED_ENTRIES:
        assert connection.add(dn, attributes=attributes), connection.result
    connection.unbind()


def _settings_for(container) -> LDAPSettings:
    return LDAPSettings(
        enabled=True,
        host=f"ldap://{container.get_container_host_ip()}",
        port=container.get_exposed_port(389),
        use_ssl=False,
        start_tls=False,
        bind_dn=_ADMIN_DN,
        bind_password=SecretStr(_ADMIN_PASSWORD),
        search_base=_SEARCH_BASE,
        shortname_attribute="businessCategory",
        required_attributes=["description"],
        parent_attribute="seeAlso",
        page_size=2,  # force paged search round-trips
    )


class TestLdapOrganizationLoaderOpenLdap:
    def test_loads_department_tree_over_real_ldap(self, ldap_container):
        directory = _loader(_settings_for(ldap_container)).load_directory()

        assert directory.source == "ldap"
        assert len(directory.roots) == 1  # the placeholder OU is filtered out

        root = directory.roots[0]
        assert root.name == "Muenchen"
        assert root.attributes["businessCategory"] == "DEPT-ORG"

        assert [child.name for child in root.children] == ["IT"]
        child = root.children[0]
        assert child.attributes["businessCategory"] == "DEPT-IT"
        assert child.attributes["description"] == "IT-Referat"

    def test_bad_credentials_raise_loader_error(self, ldap_container):
        settings = _settings_for(ldap_container)
        settings = settings.model_copy(
            update={"bind_password": SecretStr("wrong-password")}
        )

        with pytest.raises(LDAPOrganizationLoaderError, match="Failed to bind"):
            _loader(settings).load_directory()
