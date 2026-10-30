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
    """Loads person details from LDAP by the configured user ID attribute."""

    def __init__(self, settings: LDAPSettings) -> None:
        self.settings = settings

    def lookup_by_user_id(self, user_id: str) -> dict[str, str | None] | None:
        lookup_value = (user_id or "").strip()
        if not lookup_value:
            raise LDAPPersonLookupError("user_id must not be empty")

        if not self.settings.enabled:
            raise LDAPPersonLookupError("LDAP lookup is disabled")

        search_base = (
            self.settings.user_search_base or self.settings.search_base
        ).strip()
        if not search_base:
            raise LDAPPersonLookupError("LDAP user_search_base is not configured")

        id_attr = self._normalized_attribute_name(self.settings.user_id_attribute)
        escaped_lookup = self._escape_filter_value(lookup_value)
        search_filter = (
            f"(&{self.settings.user_search_filter}({id_attr}={escaped_lookup}))"
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
            "user_id": self._extract_attribute_value(
                sanitized, self.settings.user_id_attribute
            ),
            "givenName": self._extract_attribute_value(
                sanitized, self.settings.user_given_name_attribute
            ),
            "sn": self._extract_attribute_value(
                sanitized, self.settings.user_surname_attribute
            ),
            "mail": self._extract_attribute_value(
                sanitized, self.settings.user_mail_attribute
            ),
            "organizationalunit": self._extract_attribute_value(
                sanitized, self.settings.user_organizational_unit_attribute
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
            self.settings.page_size, "MUCGPT_ASSISTANT_LDAP__PAGE_SIZE"
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
            self._normalized_attribute_name(self.settings.user_id_attribute),
            self._normalized_attribute_name(self.settings.user_given_name_attribute),
            self._normalized_attribute_name(self.settings.user_surname_attribute),
            self._normalized_attribute_name(self.settings.user_mail_attribute),
            self._normalized_attribute_name(
                self.settings.user_organizational_unit_attribute
            ),
        }
        requested.update(
            self._normalized_attribute_name(attribute)
            for attribute in self.settings.user_search_attributes
            if (attribute or "").strip()
        )
        return sorted(requested)

    def _build_server(self) -> Server:
        host = self._normalized_host()
        port = self._parse_int(self.settings.port, "MUCGPT_ASSISTANT_LDAP__PORT")
        connect_timeout = self._parse_int(
            self.settings.connect_timeout,
            "MUCGPT_ASSISTANT_LDAP__CONNECT_TIMEOUT",
        )

        tls = self._build_tls_context()

        return Server(
            host,
            port=port,
            use_ssl=self.settings.use_ssl,
            tls=tls,
            connect_timeout=connect_timeout,
        )

    def _build_tls_context(self) -> Tls | None:
        if not self.settings.use_ssl and not self.settings.start_tls:
            return None

        validate = ssl.CERT_REQUIRED if self.settings.verify_ssl else ssl.CERT_NONE
        if not self.settings.ca_cert_file and validate == ssl.CERT_REQUIRED:
            raise LDAPPersonLookupError(
                "verify_ssl is enabled but no ca_cert_file was provided"
            )

        return Tls(validate=validate, ca_certs_file=self.settings.ca_cert_file)

    def _build_connection(self, server: Server) -> Connection:
        password = (
            self.settings.bind_password.get_secret_value()
            if self.settings.bind_password
            else None
        )
        receive_timeout = self._parse_int(
            self.settings.read_timeout,
            "MUCGPT_ASSISTANT_LDAP__READ_TIMEOUT",
        )
        try:
            connection = Connection(
                server,
                user=self.settings.bind_dn,
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
            try:
                if self.settings.start_tls:
                    connection.start_tls()
                if not connection.bind():
                    raise LDAPPersonLookupError(
                        f"Failed to bind to LDAP server: {connection.last_error}"
                    )
            except Exception:
                try:
                    connection.unbind()
                except ldap_exceptions.LDAPExceptionError:
                    pass
                raise
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
        host = (self.settings.host or "").strip()
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
