"""Tests for the FastAPI authentication dependency and admin guard."""

import base64
import json

import pytest
from fastapi import HTTPException

from config.settings import SSOSettings
from core.auth import (
    ACCESS_DENIED_MESSAGE,
    AuthenticationHelper,
    authenticate_user,
    require_admin,
)
from core.auth_models import AuthenticationResult, AuthError


def _token(payload: dict) -> str:
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return f"header.{encoded.rstrip('=')}.signature"


class TestParseJwtPayload:
    def test_bearer_prefix_is_stripped(self):
        payload = AuthenticationHelper(role=None).parse_jwt_payload("Bearer " + _token({"sub": "u"}))

        assert payload["sub"] == "u"

    def test_token_without_prefix_is_accepted(self):
        payload = AuthenticationHelper(role=None).parse_jwt_payload(_token({"sub": "u"}))

        assert payload["sub"] == "u"

    def test_token_with_wrong_part_count_is_rejected(self):
        with pytest.raises(AuthError, match="Invalid JWT token format"):
            AuthenticationHelper(role=None).parse_jwt_payload("only.two")

    def test_unparseable_payload_is_rejected(self):
        with pytest.raises(AuthError, match="Invalid JWT token"):
            AuthenticationHelper(role=None).parse_jwt_payload("header.!!!not-base64!!!.signature")


class TestRoleExtraction:
    def test_authorities_with_role_prefix_are_stripped(self):
        roles = AuthenticationHelper(role=None).getRoles(
            {"authorities": ["ROLE_mucgpt-user", "plain-authority"]}
        )

        assert roles == ["mucgpt-user", "plain-authority"]

    def test_resource_access_roles_are_included(self):
        roles = AuthenticationHelper(role=None).getRoles(
            {"resource_access": {"mucgpt": {"roles": ["mucgpt-admin"]}}}
        )

        assert roles == ["mucgpt-admin"]

    def test_name_falls_back_through_claim_chain(self):
        # givenname is returned as-is (not stripped); only the fallback
        # claims are stripped — pinned behavior.
        assert AuthenticationHelper(role=None).getName({"givenname": "Max"}) == "Max"
        assert (
            AuthenticationHelper(role=None).getName({"givenname": "  Max  "})
            == "  Max  "
        )
        assert AuthenticationHelper(role=None).getName({"name": "Fallback"}) == "Fallback"
        assert (
            AuthenticationHelper(role=None).getName({"preferred_username": "maxm"})
            == "maxm"
        )
        assert AuthenticationHelper(role=None).getName({}) == ""


class TestAuthenticateUserDependency:
    def test_success_returns_authentication_result(self):
        settings = SSOSettings(role="mucgpt-user")
        token = _token(
            {
                "user_id": "user-1",
                "organization_unit": "IT",
                "resource_access": {"mucgpt": {"roles": ["mucgpt-user"]}},
                "givenname": "Max Mustermann",
            }
        )

        result = authenticate_user("Bearer " + token, settings)

        assert isinstance(result, AuthenticationResult)
        assert result.user_id == "user-1"
        assert result.department == "IT"
        assert result.is_admin is False

    def test_missing_role_raises_forbidden(self):
        settings = SSOSettings(role="mucgpt-user")
        token = _token({"user_id": "user-1"})

        with pytest.raises(HTTPException) as exc_info:
            authenticate_user("Bearer " + token, settings)

        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == ACCESS_DENIED_MESSAGE

    def test_generic_error_maps_to_unauthorized(self, monkeypatch):
        settings = SSOSettings(role=None)

        class ExplodingHelper:
            def __init__(self, **kwargs):
                pass

            def authenticate(self, _token):
                raise RuntimeError("unexpected")

        monkeypatch.setattr("core.auth.AuthenticationHelper", ExplodingHelper)

        with pytest.raises(HTTPException) as exc_info:
            authenticate_user("Bearer x.y.z", settings)

        assert exc_info.value.status_code == 401


class TestRequireAdmin:
    def test_non_admin_is_forbidden(self):
        user = AuthenticationResult(user_id="u", token="t", department="d")

        with pytest.raises(HTTPException) as exc_info:
            require_admin(user)

        assert exc_info.value.status_code == 403

    def test_admin_passes_through(self):
        user = AuthenticationResult(
            user_id="u", token="t", department="d", is_admin=True
        )

        assert require_admin(user) is user
