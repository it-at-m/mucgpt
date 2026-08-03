import base64
import json

import pytest

from core.auth import AuthenticationHelper
from core.auth_models import AuthError


def _token(payload: dict) -> str:
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return f"header.{encoded_payload.rstrip('=')}.signature"


def test_role_restriction_is_disabled_by_default():
    result = AuthenticationHelper(role="required-role").authenticate(
        _token({"sub": "user-id"})
    )

    assert result.user_id == "user-id"
    assert result.roles == []


def test_role_restriction_can_be_enabled():
    helper = AuthenticationHelper(
        role="required-role",
        use_role_restriction=True,
    )

    with pytest.raises(AuthError):
        helper.authenticate(_token({"sub": "user-id"}))
