from __future__ import annotations

import ssl
from typing import Any

from ldap3 import SUBTREE, Connection, Server, Tls
from ldap3.core import exceptions as ldap_exceptions

from config.settings import LDAPSettings
from core.logtools import getLogger

from .directory import DepartmentDirectory, OrganizationTreeBuilder

logger = getLogger()


class LDAPOrganizationLoaderError(RuntimeError):
    """Raised when the LDAP organization tree cannot be loaded."""


class LDAPOrganizationLoader:
    """Loads the organization tree from an LDAP directory."""

    def __init__(self, settings: LDAPSettings) -> None:
        self.settings = settings

    def load_directory(self) -> DepartmentDirectory:
        entries = self._fetch_entries()
        builder = OrganizationTreeBuilder(
            display_attribute=self.settings.DISPLAY_ATTRIBUTE,
            parent_attribute=self.settings.PARENT_ATTRIBUTE,
            search_base=self.settings.SEARCH_BASE,
            ignored_suffixes=self.settings.IGNORED_OU_SUFFIXES,
            ignored_prefixes=self.settings.IGNORED_OU_PREFIXES,
            required_attributes=self.settings.REQUIRED_ATTRIBUTES,
        )
        roots = builder.build(entries)
        builder.sort_children(roots)
        logger.info("Loaded %d organization units from LDAP", len(entries))
        return DepartmentDirectory(roots=roots, source="ldap")

    def _fetch_entries(self) -> list[dict[str, Any]]:
        if not self.settings.SEARCH_BASE:
            raise LDAPOrganizationLoaderError(
                "MUCGPT_LDAP_SEARCH_BASE is not configured"
            )

        server = self._build_server()
        connection = self._build_connection(server)
        try:
            return self._search(connection)
        finally:
            try:
                connection.unbind()
            except ldap_exceptions.LDAPExceptionError:
                pass

    def _build_server(self) -> Server:
        host = self._normalized_host()
        try:
            port = self._parse_int(self.settings.PORT, "MUCGPT_LDAP_PORT")
        except LDAPOrganizationLoaderError:
            raise
        connect_timeout_raw = self._parse_float(
            self.settings.CONNECT_TIMEOUT, "MUCGPT_LDAP_CONNECT_TIMEOUT"
        )
        connect_timeout = int(connect_timeout_raw)

        tls = self._build_tls_context()
        logger.info(
            "LDAP server config: host=%s port=%s use_ssl=%s start_tls=%s verify_ssl=%s connect_timeout=%s",
            host,
            port,
            self.settings.USE_SSL,
            self.settings.START_TLS,
            self.settings.VERIFY_SSL,
            connect_timeout,
        )

        return Server(
            host,
            port=port,
            use_ssl=self.settings.USE_SSL,
            tls=tls,
            connect_timeout=connect_timeout,
        )

    def _build_tls_context(self) -> Tls | None:
        if not self.settings.USE_SSL and self.settings.VERIFY_SSL:
            return None

        validate = ssl.CERT_REQUIRED if self.settings.VERIFY_SSL else ssl.CERT_NONE
        if not self.settings.CA_CERT_FILE and validate == ssl.CERT_REQUIRED:
            raise LDAPOrganizationLoaderError(
                "VERIFY_SSL is enabled but no CA_CERT_FILE was provided"
            )

        return Tls(validate=validate, ca_certs_file=self.settings.CA_CERT_FILE)

    def _build_connection(self, server: Server) -> Connection:
        password = (
            self.settings.BIND_PASSWORD.get_secret_value()
            if self.settings.BIND_PASSWORD
            else None
        )
        receive_timeout_raw = self._parse_float(
            self.settings.READ_TIMEOUT, "MUCGPT_LDAP_READ_TIMEOUT"
        )
        receive_timeout = int(receive_timeout_raw)
        logger.info(
            "LDAP connection config: bind_dn=%s start_tls=%s read_timeout=%s",
            self.settings.BIND_DN,
            self.settings.START_TLS,
            receive_timeout,
        )
        try:
            connection = Connection(
                server,
                user=self.settings.BIND_DN,
                password=password,
                receive_timeout=receive_timeout,
                read_only=True,
            )
            try:
                connection.open()
            except Exception as exc:  # pragma: no cover - network
                raise LDAPOrganizationLoaderError(
                    f"Failed to open LDAP connection (host={server.host}, port={server.port}): {exc}"
                ) from exc
            if self.settings.START_TLS:
                connection.start_tls()
            if not connection.bind():
                raise LDAPOrganizationLoaderError(
                    f"Failed to bind to LDAP server: {connection.last_error}"
                )
        except ldap_exceptions.LDAPException as exc:  # pragma: no cover - network
            raise LDAPOrganizationLoaderError(str(exc)) from exc
        return connection

    def _search(self, connection: Connection) -> list[dict[str, Any]]:
        attributes = self._requested_attributes()
        entries: list[dict[str, Any]] = []
        page_size = self._parse_int(self.settings.PAGE_SIZE, "MUCGPT_LDAP_PAGE_SIZE")
        try:
            for entry in connection.extend.standard.paged_search(
                search_base=self.settings.SEARCH_BASE,
                search_filter=self.settings.SEARCH_FILTER,
                search_scope=SUBTREE,
                attributes=attributes,
                paged_size=page_size,
                generator=True,
            ):
                if entry.get("type") != "searchResEntry":
                    continue
                entries.append(
                    {
                        "dn": entry.get("dn"),
                        "attributes": entry.get("attributes", {}),
                    }
                )
        except ldap_exceptions.LDAPException as exc:
            raise LDAPOrganizationLoaderError(str(exc)) from exc
        return entries

    def _requested_attributes(self) -> list[str]:
        attributes: set[str] = {"distinguishedName", self.settings.DISPLAY_ATTRIBUTE}
        if self.settings.PARENT_ATTRIBUTE:
            attributes.add(self.settings.PARENT_ATTRIBUTE)
        if self.settings.ADDITIONAL_ATTRIBUTES:
            attributes.update(self.settings.ADDITIONAL_ATTRIBUTES)
        if self.settings.REQUIRED_ATTRIBUTES:
            attributes.update(self.settings.REQUIRED_ATTRIBUTES)
        return sorted(attributes)

    def _normalized_host(self) -> str:
        host = (self.settings.HOST or "").strip()
        if not host:
            raise LDAPOrganizationLoaderError("MUCGPT_LDAP_HOST is not configured")

        # Allow users to pass ldap:// or ldaps:// and normalize to the bare hostname
        if host.startswith("ldap://"):
            host = host.removeprefix("ldap://")
        elif host.startswith("ldaps://"):
            host = host.removeprefix("ldaps://")

        return host

    def _parse_int(self, value: Any, env_name: str) -> int:
        try:
            return int(value)
        except Exception as exc:
            raise LDAPOrganizationLoaderError(f"{env_name} must be an integer") from exc

    def _parse_float(self, value: Any, env_name: str) -> float:
        try:
            return float(value)
        except Exception as exc:
            raise LDAPOrganizationLoaderError(f"{env_name} must be a number") from exc
