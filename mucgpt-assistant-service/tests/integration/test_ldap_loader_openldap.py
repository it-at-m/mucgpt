"""Integration tests for LDAPOrganizationLoader against a real OpenLDAP container.

Lightweight by design: one osixia/openldap container, a minimal custom schema
(three attributeTypes + one auxiliary objectClass) and two department OUs —
the same custom-attribute pattern the production LDAP exposes. Tests skip
when no container runtime is reachable or when MUCGPT_TEST_LDAP=off.
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

# Lightweight custom schema: exactly the attributes the loader reads.
SCHEMA = """attributetype ( 1.3.6.1.4.1.9527.1.1 NAME 'departmentCode'
  DESC 'Stable shortname of an organization unit'
  EQUALITY caseIgnoreMatch SUBSTR caseIgnoreSubstringsMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15 SINGLE-VALUE )
attributetype ( 1.3.6.1.4.1.9527.1.2 NAME 'departmentName'
  DESC 'Human-readable name of an organization unit'
  EQUALITY caseIgnoreMatch SUBSTR caseIgnoreSubstringsMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15 SINGLE-VALUE )
attributetype ( 1.3.6.1.4.1.9527.1.3 NAME 'parentDepartment'
  DESC 'DN of the parent organization unit'
  EQUALITY distinguishedNameMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.12 SINGLE-VALUE )
objectclass ( 1.3.6.1.4.1.9527.2.1 NAME 'mucgptDepartment'
  DESC 'Marks an organizationalUnit as an MUCGPT department'
  SUP top AUXILIARY
  MAY ( departmentCode $ departmentName $ parentDepartment ) )
"""

# Two departments in a parent/child chain plus one ignored placeholder OU
# (the "_" prefix is ignored by the default configuration).
SEED_ENTRIES = [
    (
        f"ou=Muenchen,{_SEARCH_BASE}",
        {
            "objectClass": ["organizationalUnit", "mucgptDepartment"],
            "ou": ["Muenchen"],
            "departmentCode": ["DEPT-ORG"],
            "departmentName": ["Landeshauptstadt Muenchen"],
        },
    ),
    (
        f"ou=IT,ou=Muenchen,{_SEARCH_BASE}",
        {
            "objectClass": ["organizationalUnit", "mucgptDepartment"],
            "ou": ["IT"],
            "departmentCode": ["DEPT-IT"],
            "departmentName": ["IT-Referat"],
            "parentDepartment": [f"ou=Muenchen,{_SEARCH_BASE}"],
        },
    ),
    (
        f"ou=_Placeholder,{_SEARCH_BASE}",
        {
            "objectClass": ["organizationalUnit", "mucgptDepartment"],
            "ou": ["_Placeholder"],
            "departmentCode": ["DEPT-PLACEHOLDER"],
            "departmentName": ["Ignored placeholder"],
        },
    ),
]

_container = None


def _loader(settings: LDAPSettings) -> LDAPOrganizationLoader:
    return LDAPOrganizationLoader(settings)


@pytest.fixture(scope="module")
def ldap_container(tmp_path_factory: pytest.TempPathFactory):
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

    schema_path = tmp_path_factory.mktemp("ldap-schema") / "mucgpt.schema"
    schema_path.write_text(SCHEMA, encoding="utf-8")
    schema_path.chmod(0o644)  # osixia refuses unreadable schema files

    def _factory():
        return (
            DockerContainer(_LDAP_IMAGE)
            .with_env("LDAP_ORGANISATION", "MUCGPT")
            .with_env("LDAP_DOMAIN", _DOMAIN)
            .with_env("LDAP_ADMIN_PASSWORD", _ADMIN_PASSWORD)
            .with_volume_mapping(
                str(schema_path),
                # Bootstrap dir: schema files here are loaded on first start.
                # Writable mount: osixia chowns/bootstrap-modifies the file.
                "/container/service/slapd/assets/config/bootstrap/schema/custom/mucgpt.schema",
                mode="rw",
            )
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
        connection.add(dn, attributes=attributes)
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
        required_attributes=["departmentName"],
        parent_attribute="parentDepartment",
        page_size=2,  # force paged search round-trips
    )


class TestLdapOrganizationLoaderOpenLdap:
    def test_loads_department_tree_over_real_ldap(self, ldap_container):
        directory = _loader(_settings_for(ldap_container)).load_directory()

        assert directory.source == "ldap"
        assert len(directory.roots) == 1  # the placeholder OU is filtered out

        root = directory.roots[0]
        assert root.name == "Muenchen"
        assert root.attributes["departmentCode"] == "DEPT-ORG"

        assert [child.name for child in root.children] == ["IT"]
        child = root.children[0]
        assert child.attributes["departmentCode"] == "DEPT-IT"
        assert child.attributes["departmentName"] == "IT-Referat"

    def test_bad_credentials_raise_loader_error(self, ldap_container):
        settings = _settings_for(ldap_container)
        settings = settings.model_copy(
            update={"bind_password": SecretStr("wrong-password")}
        )

        with pytest.raises(LDAPOrganizationLoaderError, match="Failed to bind"):
            _loader(settings).load_directory()
