import base64
import json

import pytest

from core.auth import AuthenticationHelper


def _token(payload: dict) -> str:
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return f"header.{encoded_payload.rstrip('=')}.signature"


def test_role_restriction_is_disabled_by_default():
    result = AuthenticationHelper(role="required-role").authenticate(
        _token({"sub": "user-id"})
    )

    assert result.user_id == "user-id"
    assert result.roles == []


@pytest.mark.parametrize("use_role_restriction", [True, False])
def test_basic_access_is_unconditional(use_role_restriction):
    """A user without the required role must always get basic access,
    regardless of USE_ROLE_RESTRICTION - it's reserved for future admin gating."""
    helper = AuthenticationHelper(
        role="required-role",
        use_role_restriction=use_role_restriction,
    )

    result = helper.authenticate(_token({"sub": "user-id"}))

    assert result.user_id == "user-id"
    assert result.is_admin is False


def test_admin_flag_defaults_to_false():
    result = AuthenticationHelper(role="required-role").authenticate(
        _token(
            {
                "sub": "user-id",
                "resource_access": {"mucgpt": {"roles": ["mucgpt-user"]}},
            }
        )
    )

    assert result.is_admin is False


def test_admin_flag_is_set_when_admin_role_present():
    helper = AuthenticationHelper(role="required-role", admin_role="admin-role")

    result = helper.authenticate(
        _token(
            {
                "sub": "user-id",
                "resource_access": {"mucgpt": {"roles": ["admin-role"]}},
            }
        )
    )

    assert result.is_admin is True
