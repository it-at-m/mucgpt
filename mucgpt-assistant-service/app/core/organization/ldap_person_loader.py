from __future__ import annotations

import ssl
from typing import Any

from ldap3 import SUBTREE, Connection, Server, Tls
from ldap3.core import exceptions as ldap_exceptions

from config.settings import LDAPSettings
from core.logtools import getLogger

logger = getLogger()


class LDAPPersonLookupError(RuntimeError):
    """Raised when LDAP person lookup fails."""


class LDAPPersonLookupLoader:
    """Loads person details from LDAP by lhmobjectid (or configured ID attribute)."""

    def __init__(self, settings: LDAPSettings) -> None:
        self.settings = settings

    def lookup_by_lhmobjectid(self, lhmobjectid: str) -> dict[str, str | None] | None:
        lookup_value = (lhmobjectid or "").strip()
        if not lookup_value:
            raise LDAPPersonLookupError("lhmobjectid must not be empty")

        if not self.settings.ENABLED:
            raise LDAPPersonLookupError("LDAP lookup is disabled")

        search_base = (
            self.settings.USER_SEARCH_BASE or self.settings.SEARCH_BASE
        ).strip()
        if not search_base:
            raise LDAPPersonLookupError("LDAP USER_SEARCH_BASE is not configured")

        id_attr = self._normalized_attribute_name(self.settings.USER_ID_ATTRIBUTE)
        escaped_lookup = self._escape_filter_value(lookup_value)
        search_filter = (
            f"(&{self.settings.USER_SEARCH_FILTER}({id_attr}={escaped_lookup}))"
        )
        attributes = self._requested_attributes()

        server = self._build_server()
        connection = self._build_connection(server)
        try:
            entries = self._search(
                connection=connection,
                search_base=search_base,
                search_filter=search_filter,
                attributes=attributes,
            )
        finally:
            try:
                connection.unbind()
            except ldap_exceptions.LDAPExceptionError:
                pass

        if not entries:
            return None

        return self._to_lookup_payload(entries[0].get("attributes", {}))

    def _to_lookup_payload(self, attributes: dict[str, Any]) -> dict[str, str | None]:
        sanitized = self._sanitize_attributes(attributes)
        return {
            "lhmobjectid": self._extract_attribute_value(
                sanitized, self.settings.USER_ID_ATTRIBUTE
            ),
            "givenName": self._extract_attribute_value(
                sanitized, self.settings.USER_GIVEN_NAME_ATTRIBUTE
            ),
            "sn": self._extract_attribute_value(
                sanitized, self.settings.USER_SURNAME_ATTRIBUTE
            ),
            "mail": self._extract_attribute_value(
                sanitized, self.settings.USER_MAIL_ATTRIBUTE
            ),
            "organizationalunit": self._extract_attribute_value(
                sanitized, self.settings.USER_ORGANIZATIONAL_UNIT_ATTRIBUTE
            ),
        }

    def _search(
        self,
        connection: Connection,
        search_base: str,
        search_filter: str,
        attributes: list[str],
    ) -> list[dict[str, Any]]:
        entries: list[dict[str, Any]] = []
        page_size = self._parse_int(
            self.settings.PAGE_SIZE, "MUCGPT_ASSISTANT_LDAP__PAGE_SIZE"
        )
        try:
            for entry in connection.extend.standard.paged_search(
                search_base=search_base,
                search_filter=search_filter,
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
            raise LDAPPersonLookupError(str(exc)) from exc
        return entries

    def _requested_attributes(self) -> list[str]:
        requested = {
            self._normalized_attribute_name(self.settings.USER_ID_ATTRIBUTE),
            self._normalized_attribute_name(self.settings.USER_GIVEN_NAME_ATTRIBUTE),
            self._normalized_attribute_name(self.settings.USER_SURNAME_ATTRIBUTE),
            self._normalized_attribute_name(self.settings.USER_MAIL_ATTRIBUTE),
            self._normalized_attribute_name(
                self.settings.USER_ORGANIZATIONAL_UNIT_ATTRIBUTE
            ),
        }
        requested.update(
            self._normalized_attribute_name(attribute)
            for attribute in self.settings.USER_SEARCH_ATTRIBUTES
            if (attribute or "").strip()
        )
        return sorted(requested)

    def _build_server(self) -> Server:
        host = self._normalized_host()
        port = self._parse_int(self.settings.PORT, "MUCGPT_ASSISTANT_LDAP__PORT")
        connect_timeout = self._parse_float(
            self.settings.CONNECT_TIMEOUT,
            "MUCGPT_ASSISTANT_LDAP__CONNECT_TIMEOUT",
        )

        tls = self._build_tls_context()

        return Server(
            host,
            port=port,
            use_ssl=self.settings.USE_SSL,
            tls=tls,
            connect_timeout=connect_timeout,
        )

    def _build_tls_context(self) -> Tls | None:
        if not self.settings.USE_SSL and not self.settings.START_TLS:
            return None

        validate = ssl.CERT_REQUIRED if self.settings.VERIFY_SSL else ssl.CERT_NONE
        if not self.settings.CA_CERT_FILE and validate == ssl.CERT_REQUIRED:
            raise LDAPPersonLookupError(
                "VERIFY_SSL is enabled but no CA_CERT_FILE was provided"
            )

        return Tls(validate=validate, ca_certs_file=self.settings.CA_CERT_FILE)

    def _build_connection(self, server: Server) -> Connection:
        password = (
            self.settings.BIND_PASSWORD.get_secret_value()
            if self.settings.BIND_PASSWORD
            else None
        )
        receive_timeout = self._parse_float(
            self.settings.READ_TIMEOUT,
            "MUCGPT_ASSISTANT_LDAP__READ_TIMEOUT",
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
                raise LDAPPersonLookupError(
                    f"Failed to open LDAP connection (host={server.host}, port={server.port}): {exc}"
                ) from exc
            if self.settings.START_TLS:
                connection.start_tls()
            if not connection.bind():
                raise LDAPPersonLookupError(
                    f"Failed to bind to LDAP server: {connection.last_error}"
                )
        except ldap_exceptions.LDAPException as exc:  # pragma: no cover - network
            raise LDAPPersonLookupError(str(exc)) from exc
        return connection

    def _sanitize_attributes(self, attributes: dict[str, Any]) -> dict[str, Any]:
        sanitized: dict[str, Any] = {}
        for key, value in attributes.items():
            normalized_key = self._normalized_attribute_name(key)
            sanitized[normalized_key] = self._sanitize_value(value)
        return sanitized

    def _sanitize_value(self, value: Any) -> Any:
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="ignore")
        if isinstance(value, list | tuple | set):
            return [self._sanitize_value(v) for v in value]
        return value

    def _extract_attribute_value(
        self, attributes: dict[str, Any], attribute_name: str
    ) -> str | None:
        key = self._normalized_attribute_name(attribute_name)
        value = attributes.get(key)
        if value is None:
            return None

        if isinstance(value, list):
            for item in value:
                if isinstance(item, str) and item.strip():
                    return item.strip()
            return None

        if isinstance(value, str):
            return value.strip() or None

        if value is None:
            return None

        return str(value)

    def _normalized_host(self) -> str:
        host = (self.settings.HOST or "").strip()
        if not host:
            raise LDAPPersonLookupError("MUCGPT_LDAP_HOST is not configured")

        if host.startswith("ldap://"):
            host = host.removeprefix("ldap://")
        elif host.startswith("ldaps://"):
            host = host.removeprefix("ldaps://")

        return host

    def _normalized_attribute_name(self, value: str | None) -> str:
        return (value or "").strip()

    def _parse_int(self, value: Any, env_name: str) -> int:
        try:
            return int(value)
        except Exception as exc:
            raise LDAPPersonLookupError(f"{env_name} must be an integer") from exc

    def _parse_float(self, value: Any, env_name: str) -> float:
        try:
            return float(value)
        except Exception as exc:
            raise LDAPPersonLookupError(f"{env_name} must be a number") from exc

    def _escape_filter_value(self, value: str) -> str:
        escaped: list[str] = []
        for char in value:
            if char == "*":
                escaped.append(r"\2a")
            elif char == "(":
                escaped.append(r"\28")
            elif char == ")":
                escaped.append(r"\29")
            elif char == "\\":
                escaped.append(r"\5c")
            elif char == "\x00":
                escaped.append(r"\00")
            else:
                escaped.append(char)
        return "".join(escaped)
