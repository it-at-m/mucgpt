from collections.abc import Sequence
from typing import Any

import pytest

from config.settings import LDAPSettings
from core.organization import OrganizationNode
from core.organization.ldap_loader import LDAPOrganizationLoader


def test_requested_attributes_include_configured_shortname() -> None:
    settings = LDAPSettings(
        display_attribute="ou",
        shortname_attribute="directoryCode",
        parent_attribute="parentUnit",
        additional_attributes=["departmentName"],
        required_attributes=["departmentCode"],
    )

    assert LDAPOrganizationLoader(settings)._requested_attributes() == [
        "departmentCode",
        "departmentName",
        "directoryCode",
        "ou",
        "parentUnit",
    ]


def test_shortname_is_required_for_directory_nodes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = LDAPSettings(shortname_attribute="directoryCode")
    captured: dict[str, object] = {}

    class FakeTreeBuilder:
        def __init__(self, **kwargs: object) -> None:
            captured.update(kwargs)

        def build(self, entries: Sequence[dict[str, Any]]) -> list[OrganizationNode]:
            return []

        def sort_children(self, roots: list[OrganizationNode]) -> None:
            pass

    monkeypatch.setattr(
        "core.organization.ldap_loader.OrganizationTreeBuilder", FakeTreeBuilder
    )
    loader = LDAPOrganizationLoader(settings)
    monkeypatch.setattr(loader, "_fetch_entries", lambda: [])

    loader.load_directory()

    assert captured["required_attributes"] == ["directoryCode"]
