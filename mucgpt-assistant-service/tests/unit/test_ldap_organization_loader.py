from config.settings import LDAPSettings
from core.organization.ldap_loader import LDAPOrganizationLoader


def test_requested_attributes_include_configured_shortname() -> None:
    settings = LDAPSettings(
        DISPLAY_ATTRIBUTE="ou",
        SHORTNAME_ATTRIBUTE="directoryCode",
        PARENT_ATTRIBUTE="parentUnit",
        ADDITIONAL_ATTRIBUTES=["departmentName"],
        REQUIRED_ATTRIBUTES=["departmentCode"],
    )

    assert LDAPOrganizationLoader(settings)._requested_attributes() == [
        "departmentCode",
        "departmentName",
        "directoryCode",
        "ou",
        "parentUnit",
    ]


def test_shortname_is_required_for_directory_nodes(monkeypatch) -> None:
    settings = LDAPSettings(SHORTNAME_ATTRIBUTE="directoryCode")
    captured: dict[str, object] = {}

    class FakeTreeBuilder:
        def __init__(self, **kwargs) -> None:
            captured.update(kwargs)

        def build(self, entries):
            return []

        def sort_children(self, roots) -> None:
            pass

    monkeypatch.setattr(
        "core.organization.ldap_loader.OrganizationTreeBuilder", FakeTreeBuilder
    )
    loader = LDAPOrganizationLoader(settings)
    monkeypatch.setattr(loader, "_fetch_entries", lambda: [])

    loader.load_directory()

    assert captured["required_attributes"] == ["directoryCode"]
