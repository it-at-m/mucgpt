import base64
import json

import pytest

from core.auth import ACCESS_DENIED_MESSAGE, AuthenticationHelper
from core.auth_models import AuthError


def _token(payload: dict) -> str:
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return f"header.{encoded_payload.rstrip('=')}.signature"


def test_access_is_open_when_no_roles_are_configured():
    result = AuthenticationHelper(role=None, admin_role=None).authenticate(
        _token({"sub": "user-id"})
    )

    assert result.user_id == "user-id"
    assert result.roles == []


def test_basic_role_grants_access():
    helper = AuthenticationHelper(role="required-role")

    result = helper.authenticate(
        _token(
            {
                "sub": "user-id",
                "resource_access": {"mucgpt": {"roles": ["required-role"]}},
            }
        )
    )

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


def test_admin_role_grants_access_without_basic_role():
    helper = AuthenticationHelper(role="required-role", admin_role="admin-role")

    result = helper.authenticate(
        _token(
            {
                "sub": "user-id",
                "resource_access": {"mucgpt": {"roles": ["admin-role"]}},
            }
        )
    )

    assert result.user_id == "user-id"
    assert result.is_admin is True


def test_user_without_basic_or_admin_role_is_denied():
    helper = AuthenticationHelper(role="required-role", admin_role="admin-role")

    with pytest.raises(AuthError) as exc_info:
        helper.authenticate(
            _token(
                {
                    "sub": "user-id",
                    "resource_access": {"mucgpt": {"roles": ["different-role"]}},
                }
            )
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.error == ACCESS_DENIED_MESSAGE
